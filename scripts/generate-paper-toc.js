#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT, 'data', 'paper-pages.json');
const OUTPUT_FILE = path.join(ROOT, 'data', 'paper-toc.generated.json');

function normalizeItems(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const title = String(item && item.title ? item.title : '').trim();
      const pageNumber = Number.parseInt(item && (item.page || item.pageNumber), 10);
      const depth = Number.parseInt(item && item.depth, 10);
      if (!title || !Number.isFinite(pageNumber) || pageNumber <= 0) {
        return null;
      }
      return {
        title,
        page: pageNumber,
        depth: Number.isFinite(depth) && depth >= 0 ? depth : 0
      };
    })
    .filter(Boolean);
}

function buildPayload(source) {
  // 体检 D-6：本文件已降级为纯校验器，输出必须与 build-site-data.js 的 buildPaperToc()
  // 逐字节一致，否则 --check 会假红。此前这里回退到「今天」，而 build-site-data.js:243
  // 回退到 1970-01-01 —— data_version 一旦为空，两个生成器就会互判 OUTDATED。
  // 现完全对齐 build-site-data.js 的语义：updated 原样透传（允许为空串），
  // 只有 generated_at 才做 1970-01-01 回退。
  const updated = String(source.updated == null ? '' : source.updated);
  const papers = (Array.isArray(source.papers) ? source.papers : []).map((entry) => {
    const id = String(entry.id || '').trim();
    const relPath = String(entry.path || '').replace(/\\/g, '/').replace(/^\/?/, '');
    const items = normalizeItems(entry.toc);
    const payload = {
      id,
      path: relPath,
      auto_toc: Boolean(entry.auto_toc),
      toc_heading: entry.toc_heading ? String(entry.toc_heading) : Boolean(entry.auto_toc) ? 'Content' : '目录',
      items,
      source: Boolean(entry.auto_toc) ? 'prebuilt+runtime-fallback' : 'prebuilt-static'
    };
    if (Array.isArray(entry.pdf_candidates) && entry.pdf_candidates.length > 0) {
      payload.pdf_candidates = entry.pdf_candidates.map((item) => String(item));
    }
    return payload;
  });

  return {
    updated,
    generated_at: `${updated || '1970-01-01'}T00:00:00.000Z`,
    papers
  };
}

function serialize(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function readSource() {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Missing source file: ${SOURCE_FILE}`);
  }
  return JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
}

function main() {
  const args = new Set(process.argv.slice(2));

  // 体检 D-6：本文件降级为纯校验器。data/paper-toc.generated.json 此前有两个生成器
  // （build-site-data.js 的 buildPaperToc() 与此处的 buildPayload()），且日期回退语义
  // 不一致 —— data_version 一旦为空，两边就会互判 OUTDATED。现只保留 build-site-data.js
  // 这一个写入者；本脚本仍独立复算一遍并逐字节比对，等于给 SSOT 链条加了一道交叉校验，
  // 但已经不可能再产生「谁覆盖谁」的分歧写入。
  if (args.has('--write')) {
    console.error(
      [
        `REMOVED: ${path.relative(ROOT, __filename)} 不再写盘。`,
        'data/paper-toc.generated.json 的唯一写入者是 build-site-data.js，请改用：',
        '  node scripts/build-site-data.js --write',
        '本脚本只作为独立校验器保留（--check）。'
      ].join('\n')
    );
    process.exitCode = 1;
    return;
  }

  const source = readSource();
  const payload = buildPayload(source);

  if (!Array.isArray(payload.papers) || payload.papers.length === 0) {
    throw new Error('No paper entries were generated for toc cache.');
  }

  const output = serialize(payload);
  const rel = path.relative(ROOT, OUTPUT_FILE);
  const rerunHint = '(run: node scripts/build-site-data.js --write)';

  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`MISSING: ${rel} ${rerunHint}`);
    process.exitCode = 1;
    return;
  }

  const current = fs.readFileSync(OUTPUT_FILE, 'utf8');
  if (current !== output) {
    console.error(`OUTDATED: ${rel} ${rerunHint}`);
    process.exitCode = 1;
    return;
  }

  console.log(`OK: ${rel} is up-to-date (${payload.papers.length} papers).`);
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
