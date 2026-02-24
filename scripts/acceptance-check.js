#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = path.join(ROOT, "index.html");
const PAPER_CONFIG_JSON = path.join(ROOT, "data", "paper-pages.json");
const GENERATED_TOC_JSON = path.join(ROOT, "data", "paper-toc.generated.json");
const PUBLICATIONS_JSON = path.join(ROOT, "data", "publications.json");

const results = [];

function addResult(type, item, detail) {
  results.push({ type, item, detail: detail || "" });
}

function pass(item, detail) {
  addResult("PASS", item, detail);
}

function fail(item, detail) {
  addResult("FAIL", item, detail);
}

function warn(item, detail) {
  addResult("WARN", item, detail);
}

function manual(item, detail) {
  addResult("MANUAL", item, detail);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeRelPath(rel) {
  return String(rel || "").replace(/\\/g, "/").replace(/^\.?\//, "");
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function extractLiteral(html, name) {
  const pattern = new RegExp(
    `window\\.${name}\\s*=\\s*([\"'])(.*?)\\1\\s*;`,
    "m"
  );
  const match = html.match(pattern);
  return match ? match[2] : "";
}

function extractArrayLiteral(html, name) {
  const pattern = new RegExp(`window\\.${name}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;`, "m");
  const match = html.match(pattern);
  if (!match) {
    return [];
  }
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function assertContains(html, item, regex, detail) {
  if (regex.test(html)) {
    pass(item, detail);
  } else {
    fail(item, detail);
  }
}

function run() {
  if (!fs.existsSync(INDEX_HTML)) {
    fail("Home page exists", INDEX_HTML);
    printAndExit();
    return;
  }
  if (!fs.existsSync(PAPER_CONFIG_JSON)) {
    fail("Paper config exists", PAPER_CONFIG_JSON);
    printAndExit();
    return;
  }
  if (!fs.existsSync(GENERATED_TOC_JSON)) {
    fail("Generated TOC cache exists", GENERATED_TOC_JSON);
    printAndExit();
    return;
  }
  if (!fs.existsSync(PUBLICATIONS_JSON)) {
    fail("Publications data exists", PUBLICATIONS_JSON);
    printAndExit();
    return;
  }

  const indexHtml = readText(INDEX_HTML);
  const paperConfig = readJson(PAPER_CONFIG_JSON);
  const generatedToc = readJson(GENERATED_TOC_JSON);
  const publications = readJson(PUBLICATIONS_JSON);
  const papers = Array.isArray(paperConfig.papers) ? paperConfig.papers : [];
  const generatedPapers = Array.isArray(generatedToc.papers) ? generatedToc.papers : [];
  const generatedById = new Map(generatedPapers.map((entry) => [String(entry.id || ""), entry]));
  const publicationById = new Map(
    (Array.isArray(publications) ? publications : []).map((entry) => [String(entry.id || ""), entry])
  );

  assertContains(indexHtml, "Home main content anchor", /id=["']main-content["']/i, "index.html");
  assertContains(indexHtml, "Home theme toggle", /id=["']theme-toggle["']/i, "index.html");
  assertContains(indexHtml, "Home publication search input", /id=["']pub-search-input["']/i, "index.html");
  assertContains(indexHtml, "Home publication year filter", /id=["']pub-year-filter["']/i, "index.html");
  assertContains(indexHtml, "Home publication status filter", /id=["']pub-status-filter["']/i, "index.html");
  assertContains(indexHtml, "Home publication clear button", /id=["']pub-clear-btn["']/i, "index.html");
  assertContains(indexHtml, "Home CSS version tag", /enhanced-main\.css\?v=\d+/i, "index.html");
  assertContains(indexHtml, "Home JS version tag", /scripts\/main\.js\?v=\d+/i, "index.html");

  if (papers.length === 6) {
    pass("Paper pages count", "paper-pages.json has 6 configured paper pages");
  } else {
    fail("Paper pages count", `Expected 6, got ${papers.length}`);
  }
  if (generatedPapers.length === papers.length) {
    pass("Generated TOC paper count", `paper-toc.generated.json has ${generatedPapers.length} paper entries`);
  } else {
    fail(
      "Generated TOC paper count",
      `paper-toc.generated.json has ${generatedPapers.length}, expected ${papers.length}`
    );
  }

  for (const entry of papers) {
    const id = String(entry.id || "");
    const relPath = normalizeRelPath(entry.path);
    const absPath = path.join(ROOT, relPath);
    const label = `Paper ${id || relPath}`;

    if (!id || !relPath) {
      fail(`${label} config validity`, "Missing id or path");
      continue;
    }
    if (!fs.existsSync(absPath)) {
      fail(`${label} file exists`, relPath);
      continue;
    }
    pass(`${label} file exists`, relPath);

    const html = readText(absPath);
    assertContains(
      html,
      `${label} exposes __PAPER_ID__`,
      new RegExp(`window\\.__PAPER_ID__\\s*=\\s*[\"']${id}[\"']`, "m"),
      relPath
    );
    assertContains(
      html,
      `${label} exposes __PAPER_CONFIG_URL__`,
      /window\.__PAPER_CONFIG_URL__\s*=\s*["']\.\.\/\.\.\/\.\.\/data\/paper-pages\.json["']/m,
      relPath
    );
    assertContains(
      html,
      `${label} exposes __PAPER_TOC_URL__`,
      /window\.__PAPER_TOC_URL__\s*=\s*["']\.\.\/\.\.\/\.\.\/data\/paper-toc\.generated\.json["']/m,
      relPath
    );
    assertContains(
      html,
      `${label} has paper reader script version`,
      /paper-reader\.js\?v=\d+/i,
      relPath
    );
    assertContains(html, `${label} has TOC list`, /class=["']toc-list["']/i, relPath);
    assertContains(html, `${label} has paper theme toggle`, /id=["']themeToggleBtn["']/i, relPath);

    if (entry.auto_toc) {
      assertContains(html, `${label} TOC heading (Content)`, />\s*Content\s*<\/h3>/i, relPath);
    } else {
      assertContains(html, `${label} TOC heading (目录)`, />\s*目录\s*<\/h3>/i, relPath);
    }

    const generatedEntry = generatedById.get(id);
    if (!generatedEntry) {
      fail(`${label} generated TOC mapping`, `${id} not found in paper-toc.generated.json`);
    } else {
      pass(`${label} generated TOC mapping`, `${id} found in paper-toc.generated.json`);
      const generatedPath = normalizeRelPath(generatedEntry.path);
      if (generatedPath !== relPath) {
        fail(`${label} generated TOC path`, `cache=${generatedPath}, page=${relPath}`);
      } else {
        pass(`${label} generated TOC path`, generatedPath);
      }
      const generatedItems = Array.isArray(generatedEntry.items) ? generatedEntry.items : [];
      if (generatedItems.length > 0) {
        pass(`${label} generated TOC items`, `${generatedItems.length} entries`);
      } else {
        fail(`${label} generated TOC items`, "no prebuilt TOC items");
      }
    }

    const pub = publicationById.get(id);
    if (!pub) {
      fail(`${label} publication mapping`, `${id} not found in publications.json`);
    } else {
      pass(`${label} publication mapping`, `${id} found in publications.json`);
      const pubPdf = normalizeRelPath(pub.links && pub.links.pdf);
      if (pubPdf && pubPdf !== relPath) {
        fail(`${label} publications link mapping`, `links.pdf=${pubPdf}, page=${relPath}`);
      } else {
        pass(`${label} publications link mapping`, `links.pdf=${pubPdf || "(empty)"}`);
      }
    }

    const pageDir = path.posix.dirname(relPath);
    const pdfUrl = extractLiteral(html, "__PAPER_PDF_URL__");
    if (!pdfUrl) {
      fail(`${label} __PAPER_PDF_URL__`, "Not found");
    } else if (isHttpUrl(pdfUrl)) {
      warn(`${label} local PDF asset`, `Primary PDF is remote URL: ${pdfUrl}`);
    } else {
      const pdfRelPath = normalizeRelPath(path.posix.join(pageDir, pdfUrl));
      const pdfAbsPath = path.join(ROOT, pdfRelPath);
      if (!fs.existsSync(pdfAbsPath)) {
        fail(`${label} local PDF exists`, pdfRelPath);
      } else {
        const size = fs.statSync(pdfAbsPath).size;
        if (size > 100 * 1024) {
          pass(`${label} local PDF size`, `${pdfRelPath} (${size} bytes)`);
        } else {
          fail(`${label} local PDF size`, `${pdfRelPath} too small (${size} bytes)`);
        }
      }
    }

    const pageCandidates = extractArrayLiteral(html, "__PAPER_PDF_CANDIDATES__");
    const configCandidates = Array.isArray(entry.pdf_candidates) ? entry.pdf_candidates : [];
    const mergedCandidates = Array.from(
      new Set([...pageCandidates, ...configCandidates].map((candidate) => String(candidate || "").trim()))
    ).filter(Boolean);
    if (mergedCandidates.length > 0) {
      const localCandidates = mergedCandidates.filter((candidate) => !isHttpUrl(candidate));
      const remoteCandidates = mergedCandidates.filter((candidate) => isHttpUrl(candidate));
      for (const localCandidate of localCandidates) {
        const rel = normalizeRelPath(path.posix.join(pageDir, localCandidate));
        const abs = path.join(ROOT, rel);
        if (fs.existsSync(abs)) {
          const size = fs.statSync(abs).size;
          if (size > 100 * 1024) {
            pass(`${label} PDF fallback local candidate`, `${rel} (${size} bytes)`);
          } else {
            fail(`${label} PDF fallback local candidate`, `${rel} too small (${size} bytes)`);
          }
        } else {
          fail(`${label} PDF fallback local candidate`, `${rel} missing`);
        }
      }
      for (const remoteCandidate of remoteCandidates) {
        warn(`${label} PDF fallback remote candidate`, remoteCandidate);
      }
    }
  }

  // Extra guard for the previously corrupted SCI asset.
  const svcqrPdf = path.join(ROOT, "papers", "2025", "svcqr", "svcqr.pdf");
  if (fs.existsSync(svcqrPdf)) {
    const size = fs.statSync(svcqrPdf).size;
    if (size > 1 * 1024 * 1024) {
      pass("SVCQR PDF integrity", `svcqr.pdf looks valid (${size} bytes)`);
    } else {
      fail("SVCQR PDF integrity", `svcqr.pdf unexpectedly small (${size} bytes)`);
    }
  } else {
    fail("SVCQR PDF integrity", "svcqr.pdf missing");
  }

  manual(
    "Manual check: dark mode",
    "Toggle index and paper page dark mode and verify contrast + persistence after refresh."
  );
  manual(
    "Manual check: TOC jump",
    "Open hcqr/svcqr pages, click 3+ TOC entries, verify jumps land on correct section start pages."
  );
  manual(
    "Manual check: bilingual display",
    "Switch language on home page and verify SCI cards remain English titles while name rendering follows English mode rules."
  );

  printAndExit();
}

function printAndExit() {
  const failCount = results.filter((item) => item.type === "FAIL").length;
  const warnCount = results.filter((item) => item.type === "WARN").length;
  const passCount = results.filter((item) => item.type === "PASS").length;
  const manualCount = results.filter((item) => item.type === "MANUAL").length;

  console.log("=== Acceptance Check Summary ===");
  console.log(`PASS: ${passCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`MANUAL: ${manualCount}`);
  console.log("");

  for (const item of results) {
    const prefix = `[${item.type}]`;
    const detail = item.detail ? ` - ${item.detail}` : "";
    console.log(`${prefix} ${item.item}${detail}`);
  }

  process.exitCode = failCount > 0 ? 1 : 0;
}

run();
