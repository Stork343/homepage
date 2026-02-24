#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MASTER_FILE = path.join(ROOT, "data", "site-master.json");
const CACHE_FILE = path.join(ROOT, "data", "metadata-cache.generated.json");

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ARXIV_PATTERN = /\barxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)\b/i;
const DIRECT_ARXIV_PATTERN = /\b([0-9]{4}\.[0-9]{4,5})(?:v\d+)?\b/;

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function localizedText(value, lang) {
  if (value && typeof value === "object") {
    return normalizeWhitespace(value[lang] || value.en || value.zh || "");
  }
  return normalizeWhitespace(value || "");
}

function extractDoiFromString(input) {
  const raw = String(input || "");
  const match = raw.match(DOI_PATTERN);
  return match ? match[0].replace(/[)>.,;]+$/, "") : "";
}

function extractArxivId(input) {
  const raw = String(input || "");
  const urlMatch = raw.match(ARXIV_PATTERN);
  if (urlMatch) {
    return urlMatch[1].replace(/v\d+$/i, "");
  }
  const directMatch = raw.match(DIRECT_ARXIV_PATTERN);
  return directMatch ? directMatch[1] : "";
}

function buildCandidateStrings(pub) {
  const links = pub && pub.links ? pub.links : {};
  return [
    links.doi,
    links.article,
    links.html,
    links.pdf,
    pub && pub.bibtex,
    localizedText(pub && pub.citation, "en"),
    localizedText(pub && pub.citation, "zh")
  ];
}

function similarityScore(a, b) {
  const left = normalizeWhitespace(String(a || "").toLowerCase());
  const right = normalizeWhitespace(String(b || "").toLowerCase());
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  if (left.includes(right) || right.includes(left)) {
    return 0.86;
  }
  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const intersection = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  const denom = Math.max(leftWords.size, rightWords.size, 1);
  return intersection / denom;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "houjian-homepage-metadata-bot/1.0 (mailto:beidaihe77@qq.com)"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "houjian-homepage-metadata-bot/1.0 (mailto:beidaihe77@qq.com)"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function queryCrossref(pub) {
  const title = localizedText(pub && pub.title, "en") || localizedText(pub && pub.title, "zh");
  if (!title) {
    return null;
  }
  const year = Number.parseInt(pub && pub.year, 10);
  const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(title)}&rows=8`;
  const payload = await fetchJson(url);
  const items =
    payload && payload.message && Array.isArray(payload.message.items) ? payload.message.items : [];
  if (items.length === 0) {
    return null;
  }

  let best = null;
  items.forEach((item) => {
    const itemTitle = normalizeWhitespace(
      Array.isArray(item && item.title) && item.title.length > 0 ? item.title[0] : ""
    );
    const doi = normalizeWhitespace(item && item.DOI);
    if (!itemTitle || !doi) {
      return;
    }
    const titleScore = similarityScore(title, itemTitle);
    const pubYear =
      Number.parseInt(
        item &&
          item.issued &&
          item.issued["date-parts"] &&
          item.issued["date-parts"][0] &&
          item.issued["date-parts"][0][0],
        10
      ) || null;
    const yearPenalty =
      Number.isFinite(year) && Number.isFinite(pubYear) ? Math.min(Math.abs(year - pubYear) * 0.06, 0.36) : 0;
    const score = Math.max(0, titleScore - yearPenalty);
    if (!best || score > best.score) {
      best = {
        doi,
        doi_url: `https://doi.org/${doi}`,
        source: "crossref",
        matched_title: itemTitle,
        score
      };
    }
  });

  if (!best || best.score < 0.72) {
    return null;
  }
  return best;
}

function parseArxivEntries(xmlText) {
  const entries = [];
  const blocks = String(xmlText || "").split("<entry>").slice(1);
  blocks.forEach((block) => {
    const body = block.split("</entry>")[0];
    const idMatch = body.match(/<id>\s*https?:\/\/arxiv\.org\/abs\/([^<\s]+)\s*<\/id>/i);
    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/i);
    if (!idMatch || !titleMatch) {
      return;
    }
    const id = String(idMatch[1] || "").replace(/v\d+$/i, "");
    const title = normalizeWhitespace(String(titleMatch[1] || "").replace(/\n/g, " "));
    if (!id || !title) {
      return;
    }
    entries.push({ id, title });
  });
  return entries;
}

async function queryArxiv(pub) {
  const title = localizedText(pub && pub.title, "en") || localizedText(pub && pub.title, "zh");
  if (!title) {
    return null;
  }
  const query = encodeURIComponent(`ti:\"${title}\"`);
  const url = `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=5`;
  const xmlText = await fetchText(url);
  const entries = parseArxivEntries(xmlText);
  if (entries.length === 0) {
    return null;
  }

  let best = null;
  entries.forEach((entry) => {
    const score = similarityScore(title, entry.title);
    if (!best || score > best.score) {
      best = {
        arxiv_id: entry.id,
        arxiv_abs: `https://arxiv.org/abs/${entry.id}`,
        arxiv_pdf: `https://arxiv.org/pdf/${entry.id}.pdf`,
        source: "arxiv-api",
        matched_title: entry.title,
        score
      };
    }
  });

  if (!best || best.score < 0.72) {
    return null;
  }
  return best;
}

function mergeDetectedMetadata(pub, detected) {
  const links = pub && pub.links ? pub.links : {};
  const candidateStrings = buildCandidateStrings(pub);
  let doi = "";
  let arxivId = "";
  candidateStrings.forEach((value) => {
    if (!doi) {
      doi = extractDoiFromString(value);
    }
    if (!arxivId) {
      arxivId = extractArxivId(value);
    }
  });

  const output = {
    id: String(pub.id || ""),
    checked_at: new Date().toISOString(),
    doi: doi || detected.doi || "",
    doi_url: doi ? `https://doi.org/${doi}` : detected.doi_url || "",
    arxiv_id: arxivId || detected.arxiv_id || "",
    arxiv_abs: arxivId ? `https://arxiv.org/abs/${arxivId}` : detected.arxiv_abs || "",
    arxiv_pdf: arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : detected.arxiv_pdf || "",
    source: detected.source || "local-links",
    confidence: Number.isFinite(detected.score) ? Number(detected.score.toFixed(3)) : 1
  };
  return output;
}

async function enrichPublication(pub) {
  const localMeta = mergeDetectedMetadata(pub, {});
  const needsDoi = !localMeta.doi;
  const needsArxiv = !localMeta.arxiv_id;

  const detected = {};
  if (needsDoi) {
    try {
      const crossref = await queryCrossref(pub);
      if (crossref) {
        detected.doi = crossref.doi;
        detected.doi_url = crossref.doi_url;
        detected.source = detected.source ? `${detected.source}+crossref` : "crossref";
        detected.score = crossref.score;
      }
    } catch (error) {
      /* ignore metadata network errors for robustness */
    }
  }
  if (needsArxiv) {
    try {
      const arxiv = await queryArxiv(pub);
      if (arxiv) {
        detected.arxiv_id = arxiv.arxiv_id;
        detected.arxiv_abs = arxiv.arxiv_abs;
        detected.arxiv_pdf = arxiv.arxiv_pdf;
        detected.source = detected.source ? `${detected.source}+arxiv-api` : "arxiv-api";
        detected.score = Math.max(detected.score || 0, arxiv.score || 0);
      }
    } catch (error) {
      /* ignore metadata network errors for robustness */
    }
  }

  return mergeDetectedMetadata(pub, detected);
}

function applyCacheToMaster(master, cacheById) {
  const nextMaster = { ...master };
  nextMaster.publications = (Array.isArray(master.publications) ? master.publications : []).map((pub) => {
    const id = String(pub.id || "");
    const cached = cacheById.get(id);
    if (!cached) {
      return pub;
    }
    const next = JSON.parse(JSON.stringify(pub));
    if (!next.links || typeof next.links !== "object") {
      next.links = {};
    }
    if (!next.links.doi && cached.doi_url) {
      next.links.doi = cached.doi_url;
    }
    if (cached.arxiv_id) {
      if (!next.links.article) {
        next.links.article = cached.arxiv_abs;
      }
      if (!next.links.html) {
        next.links.html = cached.arxiv_abs;
      }
      if (!next.links.pdf) {
        next.links.pdf = cached.arxiv_pdf;
      }
    }
    return next;
  });
  return nextMaster;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeCache = args.has("--write-cache") || !args.has("--check");
  const applyToMaster = args.has("--apply");

  if (!fs.existsSync(MASTER_FILE)) {
    throw new Error(`Missing source: ${path.relative(ROOT, MASTER_FILE)}`);
  }
  const master = JSON.parse(fs.readFileSync(MASTER_FILE, "utf8"));
  const publications = Array.isArray(master.publications) ? master.publications : [];
  if (publications.length === 0) {
    throw new Error("No publications found in site-master.json.");
  }

  const enriched = [];
  for (const pub of publications) {
    const meta = await enrichPublication(pub);
    enriched.push(meta);
    const label = `${meta.id}: doi=${meta.doi || "N/A"}, arxiv=${meta.arxiv_id || "N/A"}`;
    console.log(`META ${label}`);
  }

  const cachePayload = {
    updated: new Date().toISOString(),
    source: "site-master.json",
    entries: enriched
  };

  if (writeCache) {
    fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cachePayload, null, 2)}\n`, "utf8");
    console.log(`WROTE: ${path.relative(ROOT, CACHE_FILE)}`);
  }

  if (applyToMaster) {
    const cacheById = new Map(enriched.map((entry) => [String(entry.id || ""), entry]));
    const nextMaster = applyCacheToMaster(master, cacheById);
    fs.writeFileSync(MASTER_FILE, `${JSON.stringify(nextMaster, null, 2)}\n`, "utf8");
    console.log(`UPDATED: ${path.relative(ROOT, MASTER_FILE)}`);
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
