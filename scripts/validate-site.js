#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MASTER_JSON = path.join(ROOT, "data", "site-master.json");
const PUBLICATIONS_JSON = path.join(ROOT, "data", "publications.json");
const PAPER_CONFIG_JSON = path.join(ROOT, "data", "paper-pages.json");
const GENERATED_TOC_JSON = path.join(ROOT, "data", "paper-toc.generated.json");
const SEARCH_INDEX_JSON = path.join(ROOT, "data", "search-index.generated.json");
const PUBLICATIONS_JSONLD = path.join(ROOT, "data", "publications-jsonld.generated.json");
const PAPER_SEO_JSON = path.join(ROOT, "data", "paper-seo.generated.json");

function readJson(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function normalizeRelPath(rel) {
  return String(rel || "").replace(/\\/g, "/").replace(/^\.?\//, "");
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isPublishedPublication(pub) {
  return Boolean(pub && pub.publication_info && pub.publication_info.display) || pub.published === true;
}

function resolveCandidatePath(pageRelPath, candidate) {
  const baseDir = path.posix.dirname(normalizeRelPath(pageRelPath));
  const joined = path.posix.join(baseDir, String(candidate || "").trim());
  return normalizeRelPath(joined);
}

// 体检 A-6：qvsd 封面曾出现 image.width/height 声明 223x330、而磁盘上的图实际是
// 400x521（宽高比 0.676 vs 0.768），足以造成布局抖动，而且此前只能靠人工发现。
// 现按纯 JS 解析 PNG / JPEG / WebP 头部拿真实尺寸，把「声明尺寸必须等于真实尺寸」
// 与「webp 必须与主图同尺寸（否则 <picture> 回退会跳变）」变成门禁。
// 不依赖 sips / ImageMagick 等外部工具，因此在 ubuntu CI 上与 macOS 本地表现一致。
function readImageSize(filePath) {
  const buf = fs.readFileSync(filePath);

  // PNG：8 字节签名，IHDR 的宽/高在偏移 16 / 20（大端 uint32）
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // WebP：RIFF....WEBP + 三种 chunk 变体
  if (
    buf.length > 30 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    const fourcc = buf.toString("ascii", 12, 16);
    if (fourcc === "VP8X") {
      // 扩展格式：画布宽高是 24 位小端，存的是 width-1 / height-1
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
      };
    }
    if (fourcc === "VP8 ") {
      // 有损：起始码 9d 01 2a 之后是 14 位小端的宽与高
      const start = buf.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
      if (start > 0 && start + 7 <= buf.length) {
        return {
          width: buf.readUInt16LE(start + 3) & 0x3fff,
          height: buf.readUInt16LE(start + 5) & 0x3fff
        };
      }
      return null;
    }
    if (fourcc === "VP8L") {
      // 无损：偏移 20 是签名 0x2f，随后 32 位里低 14 位是 width-1、再 14 位是 height-1
      if (buf[20] !== 0x2f) return null;
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }

  // JPEG：扫描 SOFn 段（0xC0–0xCF，排除 0xC4 DHT / 0xC8 JPG / 0xCC DAC）
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      // 无长度的独立标记
      if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const segLen = buf.readUInt16BE(i + 2);
      if (segLen < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + segLen;
    }
    return null;
  }

  return null;
}

function run() {
  if (!fs.existsSync(MASTER_JSON)) {
    fail(`Missing file: ${MASTER_JSON}`);
    return;
  }
  if (!fs.existsSync(PUBLICATIONS_JSON)) {
    fail(`Missing file: ${PUBLICATIONS_JSON}`);
    return;
  }
  if (!fs.existsSync(PAPER_CONFIG_JSON)) {
    fail(`Missing file: ${PAPER_CONFIG_JSON}`);
    return;
  }
  if (!fs.existsSync(GENERATED_TOC_JSON)) {
    fail(`Missing file: ${GENERATED_TOC_JSON}`);
    return;
  }
  if (!fs.existsSync(SEARCH_INDEX_JSON)) {
    fail(`Missing file: ${SEARCH_INDEX_JSON}`);
    return;
  }
  if (!fs.existsSync(PUBLICATIONS_JSONLD)) {
    fail(`Missing file: ${PUBLICATIONS_JSONLD}`);
    return;
  }
  if (!fs.existsSync(PAPER_SEO_JSON)) {
    fail(`Missing file: ${PAPER_SEO_JSON}`);
    return;
  }

  const master = readJson(MASTER_JSON);
  const publications = readJson(PUBLICATIONS_JSON);
  const paperConfig = readJson(PAPER_CONFIG_JSON);
  const generatedToc = readJson(GENERATED_TOC_JSON);
  const searchIndex = readJson(SEARCH_INDEX_JSON);
  const publicationsJsonLd = readJson(PUBLICATIONS_JSONLD);
  const paperSeo = readJson(PAPER_SEO_JSON);
  const papers = Array.isArray(paperConfig.papers) ? paperConfig.papers : [];
  const generatedPapers = Array.isArray(generatedToc.papers) ? generatedToc.papers : [];
  const searchEntries = Array.isArray(searchIndex.entries) ? searchIndex.entries : [];
  const seoEntries = Array.isArray(paperSeo.papers) ? paperSeo.papers : [];

  if (!Array.isArray(master.publications) || master.publications.length === 0) {
    fail("data/site-master.json must contain non-empty publications array.");
    return;
  }
  if (!Array.isArray(publications)) {
    fail("data/publications.json must be an array.");
    return;
  }
  if (papers.length === 0) {
    fail("data/paper-pages.json must contain a non-empty papers array.");
    return;
  }
  if (generatedPapers.length === 0) {
    fail("data/paper-toc.generated.json must contain a non-empty papers array.");
    return;
  }
  if (searchEntries.length !== publications.length) {
    fail(
      `data/search-index.generated.json entries mismatch: ${searchEntries.length} != publications ${publications.length}`
    );
  }
  if (!Array.isArray(publicationsJsonLd.itemListElement) || publicationsJsonLd.itemListElement.length !== publications.length) {
    fail("data/publications-jsonld.generated.json itemListElement must match publications length.");
  }

  const generatedTocById = new Map();
  generatedPapers.forEach((entry) => {
    const id = String(entry && entry.id ? entry.id : "").trim();
    if (id) {
      generatedTocById.set(id, entry);
    }
  });

  const seoById = new Map();
  seoEntries.forEach((entry) => {
    const id = String(entry && entry.id ? entry.id : "").trim();
    if (id) {
      seoById.set(id, entry);
    }
  });

  const publicationById = new Map();
  publications.forEach((pub) => {
    if (pub && pub.id) {
      publicationById.set(String(pub.id), pub);
    }
  });
  const masterById = new Map();
  master.publications.forEach((pub) => {
    if (pub && pub.id) {
      masterById.set(String(pub.id), pub);
    }
  });

  master.publications.forEach((pub) => {
    if (!pub || pub.hidden) {
      return;
    }
    if (isPublishedPublication(pub)) {
      return;
    }
    const links = pub.links || {};
    if (links.pdf) {
      fail(`Unpublished publication ${pub.id} must not expose a PDF link: ${links.pdf}`);
    }
    if (links.html) {
      fail(`Unpublished publication ${pub.id} must not expose a full-text link: ${links.html}`);
    }
  });

  const seenIds = new Set();
  papers.forEach((entry) => {
    const id = String(entry.id || "").trim();
    if (!id) {
      fail("paper-pages.json contains an entry without id.");
      return;
    }
    if (seenIds.has(id)) {
      fail(`Duplicate paper id in paper-pages.json: ${id}`);
      return;
    }
    seenIds.add(id);

    const relPath = normalizeRelPath(entry.path);
    if (!relPath) {
      fail(`paper-pages.json entry ${id} missing path.`);
      return;
    }
    const absolute = path.join(ROOT, relPath);
    if (!fs.existsSync(absolute)) {
      fail(`paper-pages.json entry ${id} points to missing file: ${relPath}`);
      return;
    }

    const html = fs.readFileSync(absolute, "utf8");
    if (!html.includes(`window.__PAPER_ID__ = "${id}"`)) {
      fail(`${relPath} must expose window.__PAPER_ID__ = "${id}"`);
    }
    if (!html.includes('window.__PAPER_CONFIG_URL__ = "../../../data/paper-pages.json"')) {
      fail(`${relPath} must expose window.__PAPER_CONFIG_URL__`);
    }
    if (!html.includes('window.__PAPER_TOC_URL__ = "../../../data/paper-toc.generated.json"')) {
      fail(`${relPath} must expose window.__PAPER_TOC_URL__`);
    }
    if (!html.includes("SEO:BEGIN") || !html.includes("SEO:END")) {
      fail(`${relPath} must include synced SEO block markers.`);
    }

    if (!Array.isArray(entry.toc) || entry.toc.length === 0) {
      fail(`paper-pages.json entry ${id} has empty toc.`);
    }

    /* CNKI 四篇：出版社排版全文不再自存档。这类条目必须由 SSOT 下发官方获取渠道，
       不得再配置任何本地 PDF，且阅读页 HTML 必须显式声明降级标志。 */
    if (entry.no_local_fulltext) {
      const officialLinks = (Array.isArray(entry.fulltext_links) ? entry.fulltext_links : []).filter((link) =>
        isHttpUrl(String((link && link.href) || ""))
      );
      if (officialLinks.length === 0) {
        fail(`paper-pages.json entry ${id} sets no_local_fulltext but has no official fulltext link.`);
      }
      if (entry.pdf_url || (Array.isArray(entry.pdf_candidates) && entry.pdf_candidates.length > 0)) {
        fail(`paper-pages.json entry ${id} sets no_local_fulltext but still configures a PDF.`);
      }
      if (!/window\.__PAPER_NO_LOCAL_FULLTEXT__\s*=\s*true/.test(html)) {
        fail(`${relPath} must declare window.__PAPER_NO_LOCAL_FULLTEXT__ = true.`);
      }
    }

    const configuredPdfCandidates = [];
    if (entry.pdf_url) {
      configuredPdfCandidates.push(entry.pdf_url);
    }
    if (Array.isArray(entry.pdf_candidates)) {
      configuredPdfCandidates.push(...entry.pdf_candidates);
    }
    configuredPdfCandidates.forEach((candidate, index) => {
      const raw = String(candidate || "").trim();
      if (!raw) {
        fail(`paper-pages.json entry ${id} has empty pdf candidate at index ${index}.`);
        return;
      }
      if (isHttpUrl(raw)) {
        return;
      }
      const candidateRelPath = resolveCandidatePath(relPath, raw);
      const candidateAbsolute = path.join(ROOT, candidateRelPath);
      if (!fs.existsSync(candidateAbsolute)) {
        fail(
          `paper-pages.json entry ${id} pdf candidate not found: ${raw} (resolved: ${candidateRelPath})`
        );
      }
    });

    const pub = publicationById.get(id);
    if (!pub) {
      fail(`paper-pages.json entry ${id} not found in publications.json.`);
      return;
    }

    const pdfLink = normalizeRelPath(pub.links && pub.links.pdf);
    if (pdfLink && pdfLink !== relPath) {
      fail(`Mismatch for ${id}: publications.json pdf link (${pdfLink}) != paper-pages path (${relPath})`);
    }

    const generatedEntry = generatedTocById.get(id);
    if (!generatedEntry) {
      fail(`paper-toc.generated.json missing entry for ${id}.`);
    } else {
      const generatedPath = normalizeRelPath(generatedEntry.path);
      if (generatedPath !== relPath) {
        fail(`paper-toc.generated mismatch for ${id}: path ${generatedPath} != ${relPath}`);
      }
      const generatedItems = Array.isArray(generatedEntry.items) ? generatedEntry.items : [];
      if (generatedItems.length === 0) {
        fail(`paper-toc.generated entry ${id} has empty items.`);
      }
    }

    const seoEntry = seoById.get(id);
    if (!seoEntry) {
      fail(`paper-seo.generated.json missing entry for ${id}.`);
    } else {
      const seoPath = normalizeRelPath(seoEntry.path);
      if (seoPath !== relPath) {
        fail(`paper-seo.generated path mismatch for ${id}: ${seoPath} != ${relPath}`);
      }
    }
  });

  if (generatedTocById.size !== papers.length) {
    fail(
      `paper-toc.generated paper count mismatch: generated ${generatedTocById.size}, expected ${papers.length}`
    );
  }
  if (seoById.size !== papers.length) {
    fail(`paper-seo.generated paper count mismatch: seo ${seoById.size}, expected ${papers.length}`);
  }

  const allowedPdfFiles = new Set();
  masterById.forEach((pub) => {
    if (!isPublishedPublication(pub)) {
      return;
    }
    const pdfLink = pub && pub.links && pub.links.pdf;
    if (pdfLink && !isHttpUrl(pdfLink)) {
      allowedPdfFiles.add(normalizeRelPath(pdfLink));
    }
  });
  papers.forEach((entry) => {
    const pub = masterById.get(String(entry.id || ""));
    if (!pub || !isPublishedPublication(pub)) {
      return;
    }
    const html = fs.readFileSync(path.join(ROOT, entry.path), "utf8");
    const pdfUrlMatch = html.match(/window\.__PAPER_PDF_URL__\s*=\s*"([^"]+)"/);
    if (pdfUrlMatch) {
      allowedPdfFiles.add(resolveCandidatePath(entry.path, pdfUrlMatch[1]));
    }
    (Array.isArray(entry.pdf_candidates) ? entry.pdf_candidates : []).forEach((candidate) => {
      if (isHttpUrl(candidate)) {
        return;
      }
      allowedPdfFiles.add(resolveCandidatePath(entry.path, candidate));
    });
  });
  const papersRoot = path.join(ROOT, "papers");
  if (fs.existsSync(papersRoot)) {
    const stack = [papersRoot];
    while (stack.length > 0) {
      const dir = stack.pop();
      fs.readdirSync(dir, { withFileTypes: true }).forEach((dirent) => {
        const full = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
          stack.push(full);
        } else if (dirent.isFile() && dirent.name.toLowerCase().endsWith(".pdf")) {
          const rel = normalizeRelPath(path.relative(ROOT, full));
          if (!allowedPdfFiles.has(rel)) {
            fail(`Unreferenced or non-published PDF in public repo: ${rel}`);
          }
        }
      });
    }
  }

  const readerPath = path.join(ROOT, "papers", "shared", "paper-reader.js");
  if (fs.existsSync(readerPath)) {
    const reader = fs.readFileSync(readerPath, "utf8");
    const requiredSnippets = [
      "validateTocItems",
      "applyInitialDeepLink",
      "paperConfigPromise",
      "generatedTocPromise",
      "applyGeneratedTocToSidebar",
      "mapStaticTocToRealPages"
    ];
    requiredSnippets.forEach((snippet) => {
      if (!reader.includes(snippet)) {
        fail(`paper-reader.js missing required capability: ${snippet}`);
      }
    });
  } else {
    fail("Missing papers/shared/paper-reader.js");
  }

  // 体检 A-6：封面图的声明尺寸必须等于磁盘上图片的真实尺寸。
  // qvsd 曾声明 223x330 而实际是 400x521，宽高比不同会造成布局抖动。
  // 同时要求 webp 与主图同尺寸，否则 <picture> 在回退时会跳变。
  let imageSizeChecked = 0;
  master.publications.forEach((pub) => {
    if (!pub || !pub.image) return;
    const id = pub.id || "(unknown id)";
    ["src", "webp"].forEach((key) => {
      const raw = pub.image[key];
      if (typeof raw !== "string" || !raw.trim() || isHttpUrl(raw)) return;
      const rel = normalizeRelPath(raw.split("?")[0]);
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) {
        fail(`publication ${id}: image.${key} points at missing file ${rel}`);
        return;
      }
      let size = null;
      try {
        size = readImageSize(abs);
      } catch (err) {
        fail(`publication ${id}: cannot read ${rel} (${err.message})`);
        return;
      }
      if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
        fail(`publication ${id}: cannot parse real dimensions of ${rel} (unsupported format?)`);
        return;
      }
      imageSizeChecked += 1;
      const declaredW = Number(pub.image.width);
      const declaredH = Number(pub.image.height);
      if (key === "src") {
        if (declaredW !== size.width || declaredH !== size.height) {
          fail(
            `publication ${id}: image declares ${declaredW}x${declaredH} but ${rel} is really ` +
              `${size.width}x${size.height} (aspect ratio mismatch causes layout shift)`
          );
        }
      } else if (Number.isFinite(declaredW) && (size.width !== declaredW || size.height !== declaredH)) {
        fail(
          `publication ${id}: webp ${rel} is ${size.width}x${size.height} but the primary image ` +
            `declares ${declaredW}x${declaredH} (<picture> fallback would jump)`
        );
      }
    });
  });

  // 体检 A-5：data/ 目录白名单。OneDrive 冲突副本（*-HouJian的MacBook Pro.json）曾堆在
  // data/ 下共 4 个 100,935 B。当前所有脚本对 data/ 都走显式路径，所以尚未污染构建，
  // 但 .gitignore 的忽略规则会把它藏起来 —— 静默忽略正是地雷本身。
  // 现改为：data/ 下任何计划外文件都判失败，新增生成物时必须显式登记到这里。
  const DATA_ALLOWLIST = new Set([
    "site-master.json",
    "publications.json",
    "paper-pages.json",
    "paper-toc.generated.json",
    "search-index.generated.json",
    "publications-jsonld.generated.json",
    "paper-seo.generated.json",
    "site-updated.generated.json",
    "metadata-cache.generated.json"
  ]);
  const dataDir = path.join(ROOT, "data");
  if (fs.existsSync(dataDir)) {
    fs.readdirSync(dataDir)
      .filter((entry) => entry !== ".DS_Store")
      .forEach((entry) => {
        const abs = path.join(dataDir, entry);
        if (fs.statSync(abs).isDirectory()) {
          fail(`data/ must not contain subdirectory: ${entry}`);
          return;
        }
        if (!DATA_ALLOWLIST.has(entry)) {
          fail(
            `data/ contains unplanned file "${entry}" (OneDrive conflict copy or stray output?). ` +
              `Delete it, or register it in validate-site.js DATA_ALLOWLIST if it is a new generated artifact.`
          );
        }
      });
  }

  if (!process.exitCode) {
    ok(
      `Publications data, paper page config, and reader capabilities are valid ` +
        `(${imageSizeChecked} cover image dimensions verified).`
    );
  }
}

run();
