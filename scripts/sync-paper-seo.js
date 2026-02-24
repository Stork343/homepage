#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SEO_FILE = path.join(ROOT, "data", "paper-seo.generated.json");
const BEGIN_MARKER = "  <!-- SEO:BEGIN -->";
const END_MARKER = "  <!-- SEO:END -->";

function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSeoBlock(entry) {
  const title = escapeAttr(entry && entry.title && (entry.title.en || entry.title.zh || ""));
  const descriptionZh = escapeAttr(entry && entry.description && entry.description.zh);
  const descriptionEn = escapeAttr(entry && entry.description && entry.description.en);
  const canonical = escapeAttr(entry && entry.canonical);
  const ogImage = escapeAttr(entry && entry.og_image);
  const keywords = escapeAttr(Array.isArray(entry && entry.keywords) ? entry.keywords.join(", ") : "");
  const jsonLd = JSON.stringify(entry && entry.scholarly_article ? entry.scholarly_article : {}, null, 2);

  return [
    BEGIN_MARKER,
    `  <meta name="description" content="${descriptionZh}"/>`,
    `  <meta name="keywords" content="${keywords}"/>`,
    '  <meta property="og:type" content="article"/>',
    '  <meta property="og:locale" content="zh_CN"/>',
    '  <meta property="og:locale:alternate" content="en_US"/>',
    `  <meta property="og:title" content="${title}"/>`,
    `  <meta property="og:description" content="${descriptionEn || descriptionZh}"/>`,
    `  <meta property="og:url" content="${canonical}"/>`,
    `  <meta property="og:image" content="${ogImage}"/>`,
    '  <meta name="twitter:card" content="summary_large_image"/>',
    `  <meta name="twitter:title" content="${title}"/>`,
    `  <meta name="twitter:description" content="${descriptionEn || descriptionZh}"/>`,
    `  <meta name="twitter:image" content="${ogImage}"/>`,
    `  <link rel="canonical" href="${canonical}"/>`,
    '  <script type="application/ld+json">',
    jsonLd
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
    "  </script>",
    END_MARKER
  ].join("\n");
}

function replaceSeoBlock(html, blockText) {
  const start = html.indexOf(BEGIN_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start >= 0 && end > start) {
    const tailIndex = end + END_MARKER.length;
    return `${html.slice(0, start)}${blockText}${html.slice(tailIndex)}`;
  }
  const titleClose = html.indexOf("</title>");
  if (titleClose < 0) {
    return html;
  }
  const insertAt = titleClose + "</title>".length;
  return `${html.slice(0, insertAt)}\n${blockText}${html.slice(insertAt)}`;
}

function normalizeLineEndings(input) {
  return String(input || "").replace(/\r\n/g, "\n");
}

function main() {
  const args = new Set(process.argv.slice(2));
  const writeMode = args.has("--write");
  const checkMode = args.has("--check") || !writeMode;

  if (!fs.existsSync(SEO_FILE)) {
    throw new Error(`Missing SEO source: ${path.relative(ROOT, SEO_FILE)}. Run data build first.`);
  }

  const seoPayload = JSON.parse(fs.readFileSync(SEO_FILE, "utf8"));
  const papers = Array.isArray(seoPayload.papers) ? seoPayload.papers : [];
  if (papers.length === 0) {
    throw new Error("No paper SEO entries found.");
  }

  let allOk = true;
  papers.forEach((entry) => {
    const relPath = String(entry.path || "").trim();
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.error(`MISSING: ${relPath}`);
      allOk = false;
      return;
    }
    const current = normalizeLineEndings(fs.readFileSync(absPath, "utf8"));
    const block = buildSeoBlock(entry);
    const next = normalizeLineEndings(replaceSeoBlock(current, block));

    if (checkMode) {
      if (next !== current) {
        console.error(`OUTDATED: ${relPath} (run: node scripts/sync-paper-seo.js --write)`);
        allOk = false;
      } else {
        console.log(`OK: ${relPath} SEO block is up-to-date.`);
      }
      return;
    }

    fs.writeFileSync(absPath, next, "utf8");
    console.log(`WROTE: ${relPath}`);
  });

  if (!allOk) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
