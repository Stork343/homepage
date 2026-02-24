#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLICATIONS_JSON = path.join(ROOT, "data", "publications.json");
const PAPER_CONFIG_JSON = path.join(ROOT, "data", "paper-pages.json");

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

function resolveCandidatePath(pageRelPath, candidate) {
  const baseDir = path.posix.dirname(normalizeRelPath(pageRelPath));
  const joined = path.posix.join(baseDir, String(candidate || "").trim());
  return normalizeRelPath(joined);
}

function run() {
  if (!fs.existsSync(PUBLICATIONS_JSON)) {
    fail(`Missing file: ${PUBLICATIONS_JSON}`);
    return;
  }
  if (!fs.existsSync(PAPER_CONFIG_JSON)) {
    fail(`Missing file: ${PAPER_CONFIG_JSON}`);
    return;
  }

  const publications = readJson(PUBLICATIONS_JSON);
  const paperConfig = readJson(PAPER_CONFIG_JSON);
  const papers = Array.isArray(paperConfig.papers) ? paperConfig.papers : [];

  if (!Array.isArray(publications)) {
    fail("data/publications.json must be an array.");
    return;
  }
  if (papers.length === 0) {
    fail("data/paper-pages.json must contain a non-empty papers array.");
    return;
  }

  const publicationById = new Map();
  publications.forEach((pub) => {
    if (pub && pub.id) {
      publicationById.set(String(pub.id), pub);
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

    if (!Array.isArray(entry.toc) || entry.toc.length === 0) {
      fail(`paper-pages.json entry ${id} has empty toc.`);
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
  });

  const readerPath = path.join(ROOT, "papers", "shared", "paper-reader.js");
  if (fs.existsSync(readerPath)) {
    const reader = fs.readFileSync(readerPath, "utf8");
    const requiredSnippets = [
      "validateTocItems",
      "applyInitialDeepLink",
      "paperConfigPromise",
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

  if (!process.exitCode) {
    ok("Publications data, paper page config, and reader capabilities are valid.");
  }
}

run();
