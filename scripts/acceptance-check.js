#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = path.join(ROOT, "index.html");
const PAPER_CONFIG_JSON = path.join(ROOT, "data", "paper-pages.json");
const GENERATED_TOC_JSON = path.join(ROOT, "data", "paper-toc.generated.json");
const PUBLICATIONS_JSON = path.join(ROOT, "data", "publications.json");
// 体检 D-7 / 路线图 17：加载 SSOT，用于把「论文页数量」从写死的常量
// 换成与 site-master.json 的集合一致性断言。
const MASTER_JSON = path.join(ROOT, "data", "site-master.json");

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
  assertContains(indexHtml, "Home publication venue filter", /id=["']pub-venue-filter["']/i, "index.html");
  assertContains(indexHtml, "Home publication keyword filter", /id=["']pub-keyword-filter["']/i, "index.html");
  assertContains(indexHtml, "Home publication status filter", /id=["']pub-status-filter["']/i, "index.html");
  assertContains(indexHtml, "Home publication clear button", /id=["']pub-clear-btn["']/i, "index.html");
  assertContains(indexHtml, "Home citation export BibTeX button", /id=["']export-bibtex-btn["']/i, "index.html");
  assertContains(indexHtml, "Home citation export RIS button", /id=["']export-ris-btn["']/i, "index.html");
  assertContains(indexHtml, "Home citation export EndNote button", /id=["']export-endnote-btn["']/i, "index.html");
  assertContains(indexHtml, "Home citation export filtered scope", /id=["']export-filtered-only["']/i, "index.html");
  assertContains(indexHtml, "Home CSS version tag", /enhanced-main\.css\?v=[a-z0-9]+/i, "index.html");
  assertContains(indexHtml, "Home JS version tag", /scripts\/main\.js\?v=[a-z0-9]+/i, "index.html");

  // 体检 D-7 / 路线图 17：此处原先写死 `papers.length === 6`。新增第 7 个阅读页时，
  // 门禁会以一个与真实原因无关的理由失败（"Expected 6, got 7"），把排查引向错误方向；
  // 反过来，若某个阅读页被误删到只剩 5 个而 SSOT 里仍有 6 条声明，这条断言给出的
  // 也只是数字不符，指不出到底缺了哪一个。
  // 现改为与 SSOT 的**集合一致性**断言：paper-pages.json 的 id 集合必须与
  // site-master.json 中「未隐藏且声明了 paper_page」的出版物 id 集合完全相同，
  // 差异时逐个点名 missing / unexpected。
  // 谓词与 build-site-data.js:131 extractPaperPages 的过滤条件保持一致。
  const masterData = readJson(MASTER_JSON);
  const masterPaperIds = (Array.isArray(masterData.publications) ? masterData.publications : [])
    .filter((pub) => pub && !pub.hidden && pub.paper_page && typeof pub.paper_page === "object")
    .map((pub) => String(pub.id || "").trim())
    .filter(Boolean)
    .sort();
  const configuredPaperIds = papers
    .map((entry) => String(entry.id || "").trim())
    .filter(Boolean)
    .sort();
  if (masterPaperIds.length === 0) {
    fail("Paper pages id set", "site-master.json declares no non-hidden paper_page entries");
  } else if (masterPaperIds.join(",") !== configuredPaperIds.join(",")) {
    const missing = masterPaperIds.filter((id) => !configuredPaperIds.includes(id));
    const unexpected = configuredPaperIds.filter((id) => !masterPaperIds.includes(id));
    fail(
      "Paper pages id set",
      `paper-pages.json does not match the paper_page ids declared in site-master.json` +
        `${missing.length ? `; missing from paper-pages.json: ${missing.join(", ")}` : ""}` +
        `${unexpected.length ? `; not declared in site-master.json: ${unexpected.join(", ")}` : ""}`
    );
  } else {
    pass(
      "Paper pages id set",
      `${configuredPaperIds.length} paper pages match site-master.json: ${configuredPaperIds.join(", ")}`
    );
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
    assertContains(html, `${label} has SEO block`, /SEO:BEGIN[\s\S]*SEO:END/i, relPath);
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
    /* CNKI 四篇不再自存档出版社排版全文：这类页面必须显式声明降级标志、不得再引用
       本地 PDF，并且必须由 SSOT 下发至少一条官方获取渠道（DOI / CNKI / 代码仓库）。 */
    if (entry.no_local_fulltext) {
      const declaredNoFulltext = /window\.__PAPER_NO_LOCAL_FULLTEXT__\s*=\s*true/.test(html);
      if (!declaredNoFulltext) {
        fail(`${label} no-local-fulltext contract`, "__PAPER_NO_LOCAL_FULLTEXT__ = true 未声明");
      } else if (pdfUrl) {
        fail(`${label} no-local-fulltext contract`, `仍引用本地 PDF：${pdfUrl}`);
      } else {
        pass(`${label} no-local-fulltext contract`, "已声明降级，且未引用本地 PDF");
      }
      const officialLinks = (Array.isArray(entry.fulltext_links) ? entry.fulltext_links : []).filter((link) =>
        isHttpUrl(String((link && link.href) || ""))
      );
      if (officialLinks.length === 0) {
        fail(`${label} official fulltext links`, "声明了 no_local_fulltext 却没有任何官方获取渠道");
      } else {
        pass(`${label} official fulltext links`, officialLinks.map((link) => link.kind).join(", "));
      }
    } else if (!pdfUrl) {
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

  // 体检 D-7 / 路线图 17：以下 4 项此前都标着 "Manual check"，但它们的行为早已被
  // tests/ui/regression.spec.js 自动化，输出却仍在要求人工复核 —— 一份会让人重复劳动、
  // 进而被整段忽略的清单。现改为点名对应的真实测试（测试名逐个 grep 核实，非推断；
  // 刻意不写行号，因为新增用例就会让行号漂移）。
  // 仍保留在 MANUAL 计数里而不计入 PASS：acceptance-check 自身并没有验证它们，
  // 验证者是 Playwright，这个区分不该被抹掉。
  manual(
    "Automated elsewhere: dark mode",
    "Covered by regression.spec.js test 'Dark mode persists after refresh and is inherited by paper pages'."
  );
  manual(
    "Automated elsewhere: TOC jump",
    "Covered by regression.spec.js tests 'HCQR TOC links jump to the expected query page' and 'SVCQR TOC links jump to the expected query page'."
  );
  manual(
    "Automated elsewhere: bilingual display",
    "Covered by regression.spec.js test 'Language rules: SCI cards keep English in zh, profile name becomes English in EN mode'."
  );
  manual(
    "Automated elsewhere: citation export center",
    "Covered by regression.spec.js test 'Site-wide filters and citation export center work together'."
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
