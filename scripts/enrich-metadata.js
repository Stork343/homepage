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
    // 体检 C-1.4：子串命中此前无条件给 0.86，直接越过 queryCrossref 的 0.72 接受阈值。
    // 但「短标题是长标题的子串」恰恰说明候选更泛化、不是同一篇文章。实测事故：
    // Crossref 对 "Scale-dependent contraction of spatial wet-bulb temperature contrasts in
    // eastern China" 的头号命中是百科词条 "WET-BULB TEMPERATURE"
    // （DOI 10.1615/atoz.w.wet-bulb_temperature）—— 20 字符是 74 字符标题的子串 → 0.86 →
    // 被当成真 DOI 写进 publications.json 的 links.doi 与 JSON-LD 的 identifier。
    // 一旦发布，读者点 DOI 会落到《天体生物学百科》的湿球温度词条。
    // 现按长度比例缩放：只有较短一方占较长一方的绝大部分（标点 / 大小写 / 副标题级差异）
    // 才保留高分，泛化词条自然落到阈值以下。
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    const ratio = longer > 0 ? shorter / longer : 0;
    return ratio >= 0.75 ? 0.86 : Number((ratio * 0.86).toFixed(3));
  }
  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const intersection = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  const denom = Math.max(leftWords.size, rightWords.size, 1);
  return intersection / denom;
}

// 体检 D-7：此前两处 fetch 既无超时也无 AbortController。Crossref / arXiv 只要卡住
// 就会无限阻塞，而出版物是串行 enrich 的 —— 一条挂住，整轮都不产出。
// 现加超时；超时抛出的错误由 enrichPublication 里既有的 catch 吞掉并降级为
// "只用本地 links"，与网络错误的处理方式一致。
const FETCH_TIMEOUT_MS = Number(process.env.METADATA_FETCH_TIMEOUT_MS || 20000);
const USER_AGENT = "houjian-homepage-metadata-bot/1.0 (mailto:beidaihe77@qq.com)";

async function fetchWithTimeout(url) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);
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
    // 体检 C-1.4：候选没有可解析年份时，此前的 yearPenalty 恒为 0（三元表达式要求两侧
    // 都 isFinite）。而这恰恰是百科 / 词典 / 术语条目的典型特征 —— 它们通常没有
    // issued.date-parts。于是最可疑的候选反而一分不罚，能压过真正对得上的期刊论文：
    // 上面那个 WET-BULB TEMPERATURE 词条 year=null，penalty=0，最终得分 0.860，
    // 而同一次查询里唯一沾边的真论文（10.1029/2023jd040399，2024 年）只有 0.188。
    // 现补上「我知道自己的年份、候选却没有年份」这一情形的固定惩罚。
    let yearPenalty = 0;
    if (Number.isFinite(year) && Number.isFinite(pubYear)) {
      yearPenalty = Math.min(Math.abs(year - pubYear) * 0.06, 0.36);
    } else if (Number.isFinite(year) && pubYear === null) {
      yearPenalty = 0.18;
    }
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

// 把 links.doi 归一成可比较的裸 DOI：剥掉 https://doi.org/ 前缀与首尾空白。
// 注意本仓库有 4 条 CNKI 出版物的 links.doi 里放的其实是 kns.cnki.net 的 URL
// （数据质量问题，另行处理），归一后与缓存里的空 doi 不构成冲突，故不会被误报。
function normalizeDoi(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    // CNKI 用自己的 DOI 解析代理，形如 https://link.cnki.net/doi/<裸DOI>，
    // 与 Crossref 返回的裸 DOI 指向同一篇文章。不剥这层前缀就会把它误报成漂移。
    .replace(/^https?:\/\/link\.cnki\.net\/doi\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

// 体检 C-1.4：--check 此前没有任何比较逻辑 —— 它把整套联网 enrich 原样跑一遍
// （照样对全部出版物发起真实的 Crossref / arXiv 请求），然后不写盘、恒退 0。
// 一个永远返回成功的检查等于没有检查。现改为纯离线比较：缓存 vs SSOT，
// 发现漂移即非零退出，且全程不发任何网络请求。
function runOfflineCheck(master) {
  const problems = [];
  const notes = [];
  const publications = Array.isArray(master.publications) ? master.publications : [];

  let cache = null;
  if (!fs.existsSync(CACHE_FILE)) {
    problems.push(
      `缓存文件不存在：${path.relative(ROOT, CACHE_FILE)}（运行 npm run metadata:enrich 生成）`
    );
    return { problems, notes, publicationCount: publications.length, entryCount: 0 };
  }
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch (error) {
    problems.push(`缓存文件不是合法 JSON：${error.message}`);
    return { problems, notes, publicationCount: publications.length, entryCount: 0 };
  }

  const entries = Array.isArray(cache.entries) ? cache.entries : [];
  const byId = new Map(entries.map((entry) => [String(entry.id || ""), entry]));

  publications.forEach((pub) => {
    const id = String((pub && pub.id) || "");
    if (!id) return;
    const entry = byId.get(id);
    if (!entry) {
      problems.push(`缺少缓存条目：${id}`);
      return;
    }
    const masterDoi = normalizeDoi(pub.links && pub.links.doi);
    const cacheDoi = normalizeDoi(entry.doi);
    if (masterDoi && cacheDoi && masterDoi !== cacheDoi) {
      problems.push(`DOI 漂移：${id} —— 缓存 ${cacheDoi} vs SSOT ${masterDoi}`);
    }
    if (!entry.checked_at) {
      notes.push(`${id}: 缓存条目没有 checked_at，无法判断新鲜度`);
    }
  });

  const masterIds = new Set(publications.map((pub) => String((pub && pub.id) || "")));
  entries.forEach((entry) => {
    const id = String(entry.id || "");
    if (id && !masterIds.has(id)) {
      problems.push(`孤儿缓存条目：${id} 已不在 site-master.json 中`);
    }
  });

  if (cache.updated) {
    const ageDays = (Date.now() - Date.parse(cache.updated)) / 86400000;
    const label = Number.isFinite(ageDays) ? `${ageDays.toFixed(1)} 天前` : "时间无法解析";
    notes.push(`缓存生成于 ${cache.updated}（${label}），共 ${entries.length} 条`);
    if (Number.isFinite(ageDays) && ageDays > 90) {
      notes.push("缓存已超过 90 天，建议重跑 npm run metadata:enrich 刷新");
    }
  }

  return { problems, notes, publicationCount: publications.length, entryCount: entries.length };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");
  // 体检 C-1.4：原句是 args.has("--write-cache") || !args.has("--check")，
  // 意味着「不带任何参数裸跑」也会直接覆盖缓存文件。现改为只有显式
  // --write-cache 才写盘，裸跑退化为不写盘的联网试运行。
  const writeCache = args.has("--write-cache");
  const applyToMaster = args.has("--apply");

  if (!fs.existsSync(MASTER_FILE)) {
    throw new Error(`Missing source: ${path.relative(ROOT, MASTER_FILE)}`);
  }
  const master = JSON.parse(fs.readFileSync(MASTER_FILE, "utf8"));
  const publications = Array.isArray(master.publications) ? master.publications : [];
  if (publications.length === 0) {
    throw new Error("No publications found in site-master.json.");
  }

  if (checkOnly) {
    const { problems, notes, publicationCount, entryCount } = runOfflineCheck(master);
    notes.forEach((note) => console.log(`INFO ${note}`));
    problems.forEach((problem) => console.error(`DRIFT ${problem}`));
    if (problems.length > 0) {
      console.error(
        `\nmetadata cache check FAILED: ${problems.length} 处漂移` +
          `（SSOT ${publicationCount} 条出版物 / 缓存 ${entryCount} 条，离线比较，未联网）`
      );
      process.exitCode = 1;
    } else {
      console.log(
        `OK: metadata cache 与 site-master.json 一致` +
          `（${publicationCount} 条出版物 / ${entryCount} 条缓存，离线比较，未联网）`
      );
    }
    return;
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
