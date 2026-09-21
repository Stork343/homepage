#!/usr/bin/env node
"use strict";

// 体检 D-8：`check:syntax` 此前把脚本名硬编码在 package.json 的一长串 `&&` 里，
// 新增脚本不会自动纳入 —— 实际漏掉了 scripts/check-contrast.js、enrich-metadata.js、
// serve.js、sync-paper-seo.js 四个（serve.js 里一个未捕获的 URIError 就能打挂服务器，
// 恰恰是最该被语法门禁覆盖的那类文件）。
// 改为扫描目录，自我维护；用 execFileSync 而非 shell for 循环，保持跨平台。

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// 需要纳入语法检查的目录与零散文件
const SCAN_DIRS = ["scripts", "papers/shared", "tests/ui"];
const EXTRA_FILES = ["playwright.config.js"];

function collectTargets() {
  const targets = [];
  for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
    for (const entry of fs.readdirSync(abs).sort()) {
      if (!entry.endsWith(".js")) continue;
      const rel = path.join(dir, entry).split(path.sep).join("/");
      if (fs.statSync(path.join(abs, entry)).isFile()) targets.push(rel);
    }
  }
  for (const rel of EXTRA_FILES) {
    if (fs.existsSync(path.join(ROOT, rel))) targets.push(rel);
  }
  return targets;
}

function main() {
  const targets = collectTargets();
  if (targets.length === 0) {
    console.error("未找到任何待检查的 JS 文件，扫描配置可能已失效。");
    process.exit(1);
  }

  const failed = [];
  for (const rel of targets) {
    try {
      execFileSync(process.execPath, ["--check", path.join(ROOT, rel)], {
        stdio: ["ignore", "ignore", "pipe"]
      });
    } catch (err) {
      const detail = err.stderr ? err.stderr.toString().trim() : String(err.message);
      failed.push({ rel, detail });
    }
  }

  for (const { rel, detail } of failed) {
    console.error(`语法错误：${rel}`);
    console.error(detail.split("\n").map((l) => `    ${l}`).join("\n"));
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length}/${targets.length} 个文件语法检查失败。`);
    process.exit(1);
  }
  console.log(`OK: ${targets.length} 个 JS 文件语法检查通过。`);
}

main();
