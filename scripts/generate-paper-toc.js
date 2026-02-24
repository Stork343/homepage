#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT, 'data', 'paper-pages.json');
const OUTPUT_FILE = path.join(ROOT, 'data', 'paper-toc.generated.json');

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

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
  const updated = String(source.updated || formatDate(new Date()));
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
    generated_at: `${updated}T00:00:00.000Z`,
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
  const writeMode = args.has('--write');
  const checkMode = args.has('--check') || !writeMode;

  const source = readSource();
  const payload = buildPayload(source);

  if (!Array.isArray(payload.papers) || payload.papers.length === 0) {
    throw new Error('No paper entries were generated for toc cache.');
  }

  const output = serialize(payload);

  if (writeMode) {
    fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
    console.log(`WROTE: ${path.relative(ROOT, OUTPUT_FILE)} (${payload.papers.length} papers)`);
    return;
  }

  if (checkMode) {
    if (!fs.existsSync(OUTPUT_FILE)) {
      console.error(`MISSING: ${path.relative(ROOT, OUTPUT_FILE)} (run: node scripts/generate-paper-toc.js --write)`);
      process.exitCode = 1;
      return;
    }

    const current = fs.readFileSync(OUTPUT_FILE, 'utf8');
    if (current !== output) {
      console.error(`OUTDATED: ${path.relative(ROOT, OUTPUT_FILE)} (run: node scripts/generate-paper-toc.js --write)`);
      process.exitCode = 1;
      return;
    }

    console.log(`OK: ${path.relative(ROOT, OUTPUT_FILE)} is up-to-date.`);
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
