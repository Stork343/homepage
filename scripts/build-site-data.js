#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MASTER_FILE = path.join(ROOT, "data", "site-master.json");
const METADATA_CACHE_FILE = path.join(ROOT, "data", "metadata-cache.generated.json");
const OUTPUT_FILES = {
  publications: path.join(ROOT, "data", "publications.json"),
  paperPages: path.join(ROOT, "data", "paper-pages.json"),
  paperToc: path.join(ROOT, "data", "paper-toc.generated.json"),
  searchIndex: path.join(ROOT, "data", "search-index.generated.json"),
  publicationsJsonLd: path.join(ROOT, "data", "publications-jsonld.generated.json"),
  paperSeo: path.join(ROOT, "data", "paper-seo.generated.json"),
  sitemap: path.join(ROOT, "sitemap.xml")
};

function normalizeRelPath(input) {
  return String(input || "").replace(/\\/g, "/").replace(/^\.?\//, "");
}

function readMaster() {
  if (!fs.existsSync(MASTER_FILE)) {
    throw new Error(`Missing master file: ${MASTER_FILE}`);
  }
  return JSON.parse(fs.readFileSync(MASTER_FILE, "utf8"));
}

function readMetadataCacheById() {
  if (!fs.existsSync(METADATA_CACHE_FILE)) {
    return new Map();
  }
  const payload = JSON.parse(fs.readFileSync(METADATA_CACHE_FILE, "utf8"));
  const entries = Array.isArray(payload && payload.entries) ? payload.entries : [];
  return new Map(entries.map((entry) => [String(entry.id || ""), entry]));
}

function localizedText(value, lang) {
  if (value && typeof value === "object") {
    return String(value[lang] || value.en || value.zh || "").trim();
  }
  return String(value || "").trim();
}

function sanitizeForDescription(text, maxLength = 180) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function uniqueStringList(values) {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return;
    }
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function jsonText(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function extractPaperPages(publications) {
  return publications
    .filter((pub) => pub && pub.paper_page && typeof pub.paper_page === "object")
    .map((pub) => {
      const page = pub.paper_page;
      const output = {
        id: String(pub.id || "").trim(),
        path: normalizeRelPath(page.path),
        auto_toc: Boolean(page.auto_toc),
        toc_heading: String(page.toc_heading || (page.auto_toc ? "Content" : "目录")),
        toc: Array.isArray(page.toc) ? page.toc : []
      };
      if (page.pdf_url) {
        output.pdf_url = String(page.pdf_url);
      }
      if (Array.isArray(page.pdf_candidates) && page.pdf_candidates.length > 0) {
        output.pdf_candidates = page.pdf_candidates.map((item) => String(item));
      }
      return output;
    });
}

function buildPublications(master, metadataById) {
  const publications = Array.isArray(master.publications) ? master.publications : [];
  return publications.map((pub) => {
    const output = { ...pub };
    delete output.paper_page;
    const metadata = metadataById.get(String(pub.id || ""));
    if (!output.links || typeof output.links !== "object") {
      output.links = {};
    }
    if (metadata) {
      if (!output.links.doi && metadata.doi_url) {
        output.links.doi = metadata.doi_url;
      }
      if (!output.links.article && metadata.arxiv_abs) {
        output.links.article = metadata.arxiv_abs;
      }
      if (!output.links.html && metadata.arxiv_abs) {
        output.links.html = metadata.arxiv_abs;
      }
      if (!output.links.pdf && metadata.arxiv_pdf) {
        output.links.pdf = metadata.arxiv_pdf;
      }
      output.metadata = {
        ...(output.metadata && typeof output.metadata === "object" ? output.metadata : {}),
        doi: metadata.doi || "",
        arxiv_id: metadata.arxiv_id || "",
        source: metadata.source || "",
        checked_at: metadata.checked_at || ""
      };
    }
    output.keywords = {
      zh: uniqueStringList(
        Array.isArray(pub && pub.keywords && pub.keywords.zh)
          ? pub.keywords.zh
          : Array.isArray(pub && pub.keywords)
            ? pub.keywords
            : []
      ),
      en: uniqueStringList(
        Array.isArray(pub && pub.keywords && pub.keywords.en)
          ? pub.keywords.en
          : Array.isArray(pub && pub.keywords)
            ? pub.keywords
            : []
      )
    };
    return output;
  });
}

function buildPaperPages(master) {
  return {
    updated: String(master.updated || ""),
    papers: extractPaperPages(Array.isArray(master.publications) ? master.publications : [])
  };
}

function buildPaperToc(master) {
  const papers = extractPaperPages(Array.isArray(master.publications) ? master.publications : []);
  return {
    updated: String(master.updated || ""),
    generated_at: `${String(master.updated || "1970-01-01")}T00:00:00.000Z`,
    papers: papers.map((entry) => ({
      id: entry.id,
      path: entry.path,
      auto_toc: entry.auto_toc,
      toc_heading: entry.toc_heading,
      items: (Array.isArray(entry.toc) ? entry.toc : [])
        .map((item) => ({
          title: String(item && item.title ? item.title : "").trim(),
          page: Number.parseInt(item && (item.page || item.pageNumber), 10),
          depth: Number.isFinite(Number.parseInt(item && item.depth, 10))
            ? Math.max(0, Number.parseInt(item.depth, 10))
            : 0
        }))
        .filter((item) => item.title && Number.isFinite(item.page) && item.page > 0),
      source: entry.auto_toc ? "prebuilt+runtime-fallback" : "prebuilt-static",
      ...(Array.isArray(entry.pdf_candidates) && entry.pdf_candidates.length > 0
        ? { pdf_candidates: entry.pdf_candidates }
        : {})
    }))
  };
}

function buildSearchIndex(master, publications) {
  const paperPages = extractPaperPages(Array.isArray(master.publications) ? master.publications : []);
  const pathById = new Map(paperPages.map((entry) => [entry.id, entry.path]));
  return {
    updated: String(master.updated || ""),
    generated_at: `${String(master.updated || "1970-01-01")}T00:00:00.000Z`,
    entries: publications.map((pub) => {
      const id = String(pub.id || "").trim();
      const keywordsZh = uniqueStringList(pub && pub.keywords && pub.keywords.zh);
      const keywordsEn = uniqueStringList(pub && pub.keywords && pub.keywords.en);
      return {
        id,
        year: Number(pub.year || 0),
        title: {
          zh: localizedText(pub.title, "zh"),
          en: localizedText(pub.title, "en")
        },
        authors: {
          zh: localizedText(pub.authors, "zh"),
          en: localizedText(pub.authors, "en")
        },
        venue: {
          zh: localizedText(pub.venue, "zh"),
          en: localizedText(pub.venue, "en")
        },
        status: {
          zh: localizedText(pub.status, "zh"),
          en: localizedText(pub.status, "en")
        },
        keywords: {
          zh: keywordsZh,
          en: keywordsEn
        },
        links: {
          article: pub && pub.links ? pub.links.article || null : null,
          pdf: pub && pub.links ? pub.links.pdf || null : null
        },
        paper_path: pathById.get(id) || null
      };
    })
  };
}

function buildPublicationsJsonLd(master, publications) {
  const baseUrl = String(master && master.site && master.site.base_url ? master.site.base_url : "").replace(
    /\/+$/,
    "/"
  );
  const itemListElement = publications.map((pub, index) => {
    const id = String(pub.id || "").trim();
    const articleUrl = pub && pub.links ? String(pub.links.article || "") : "";
    const doiLink = pub && pub.links ? String(pub.links.doi || "") : "";
    const authors = String(localizedText(pub.authors, "en") || localizedText(pub.authors, "zh"))
      .split(",")
      .map((name) => String(name || "").trim())
      .filter(Boolean)
      .map((name) => ({ "@type": "Person", name }));
    const canonical =
      articleUrl && /^https?:\/\//i.test(articleUrl)
        ? articleUrl
        : `${baseUrl}#publication-${id || index + 1}`;
    const scholarly = {
      "@type": "ScholarlyArticle",
      name: localizedText(pub.title, "en") || localizedText(pub.title, "zh"),
      author: authors,
      datePublished: String(pub.year || ""),
      isPartOf: localizedText(pub.venue, "en") || localizedText(pub.venue, "zh"),
      url: canonical
    };
    if (doiLink) {
      scholarly.identifier = doiLink;
    }
    return {
      "@type": "ListItem",
      position: index + 1,
      item: scholarly
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Publications by Hou Jian",
    itemListElement
  };
}

function buildPaperSeo(master, publications) {
  const baseUrl = String(master && master.site && master.site.base_url ? master.site.base_url : "").replace(
    /\/+$/,
    "/"
  );

  const paperPages = extractPaperPages(Array.isArray(master.publications) ? master.publications : []);
  const pageById = new Map(paperPages.map((entry) => [entry.id, entry]));

  const papers = [];
  for (const pub of publications) {
    const id = String(pub.id || "").trim();
    const page = pageById.get(id);
    if (!page) {
      continue;
    }
    const relPath = normalizeRelPath(page.path);
    const canonical = `${baseUrl}${relPath}`;
    const titleEn = localizedText(pub.title, "en");
    const titleZh = localizedText(pub.title, "zh");
    const venueEn = localizedText(pub.venue, "en");
    const venueZh = localizedText(pub.venue, "zh");
    const authorsEn = localizedText(pub.authors, "en");
    const descriptionZh = sanitizeForDescription(
      `${titleZh || titleEn}. 作者: ${localizedText(pub.authors, "zh") || authorsEn}. ${venueZh || venueEn}, ${pub.year}.`
    );
    const descriptionEn = sanitizeForDescription(
      `${titleEn || titleZh}. Authors: ${authorsEn || localizedText(pub.authors, "zh")}. ${venueEn || venueZh}, ${
        pub.year
      }.`
    );
    const keywordList = uniqueStringList([
      ...uniqueStringList(pub && pub.keywords && pub.keywords.zh),
      ...uniqueStringList(pub && pub.keywords && pub.keywords.en)
    ]);
    const imageSrc =
      pub && pub.image
        ? normalizeRelPath(pub.image.webp || pub.image.src || "")
        : "";
    const ogImage = imageSrc ? `${baseUrl}${imageSrc}` : `${baseUrl}hj.webp`;
    const doiLink = pub && pub.links ? String(pub.links.doi || "") : "";
    const articleRaw = pub && pub.links ? String(pub.links.article || "") : "";
    const articleUrl = articleRaw
      ? /^https?:\/\//i.test(articleRaw)
        ? articleRaw
        : `${baseUrl}${normalizeRelPath(articleRaw)}`
      : "";
    const scholarlyArticle = {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      name: titleEn || titleZh,
      headline: titleEn || titleZh,
      inLanguage: "en",
      datePublished: String(pub.year || ""),
      author: String(authorsEn || localizedText(pub.authors, "zh"))
        .split(",")
        .map((name) => String(name || "").trim())
        .filter(Boolean)
        .map((name) => ({ "@type": "Person", name })),
      isPartOf: {
        "@type": "Periodical",
        name: venueEn || venueZh
      },
      url: canonical,
      image: ogImage
    };
    if (doiLink) {
      scholarlyArticle.identifier = doiLink;
      scholarlyArticle.sameAs = uniqueStringList([doiLink, articleUrl]).filter(Boolean);
    } else if (articleUrl) {
      scholarlyArticle.sameAs = [articleUrl];
    }

    papers.push({
      id,
      path: relPath,
      title: {
        zh: titleZh || titleEn,
        en: titleEn || titleZh
      },
      description: {
        zh: descriptionZh,
        en: descriptionEn
      },
      keywords: keywordList,
      canonical,
      og_image: ogImage,
      scholarly_article: scholarlyArticle
    });
  }

  return {
    updated: String(master.updated || ""),
    papers
  };
}

function buildSitemap(master) {
  const baseUrl = String(master && master.site && master.site.base_url ? master.site.base_url : "").replace(
    /\/+$/,
    "/"
  );
  const paperPages = extractPaperPages(Array.isArray(master.publications) ? master.publications : []);
  const urlEntries = [
    { loc: baseUrl },
    ...paperPages.map((entry) => ({ loc: `${baseUrl}${normalizeRelPath(entry.path)}` }))
  ];
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];
  urlEntries.forEach((entry) => {
    lines.push("  <url>");
    lines.push(`    <loc>${entry.loc}</loc>`);
    lines.push("  </url>");
  });
  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

function ensureParent(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function writeOrCheck(filePath, nextText, writeMode) {
  ensureParent(filePath);
  if (writeMode) {
    fs.writeFileSync(filePath, nextText, "utf8");
    console.log(`WROTE: ${path.relative(ROOT, filePath)}`);
    return true;
  }
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${path.relative(ROOT, filePath)} (run: node scripts/build-site-data.js --write)`);
    return false;
  }
  const current = fs.readFileSync(filePath, "utf8");
  if (current !== nextText) {
    console.error(`OUTDATED: ${path.relative(ROOT, filePath)} (run: node scripts/build-site-data.js --write)`);
    return false;
  }
  console.log(`OK: ${path.relative(ROOT, filePath)} is up-to-date.`);
  return true;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const writeMode = args.has("--write");
  const checkMode = args.has("--check") || !writeMode;

  const master = readMaster();
  const metadataById = readMetadataCacheById();
  const publications = buildPublications(master, metadataById);
  const paperPages = buildPaperPages(master);
  const paperToc = buildPaperToc(master);
  const searchIndex = buildSearchIndex(master, publications);
  const publicationsJsonLd = buildPublicationsJsonLd(master, publications);
  const paperSeo = buildPaperSeo(master, publications);
  const sitemap = buildSitemap(master);

  const outputs = [
    [OUTPUT_FILES.publications, jsonText(publications)],
    [OUTPUT_FILES.paperPages, jsonText(paperPages)],
    [OUTPUT_FILES.paperToc, jsonText(paperToc)],
    [OUTPUT_FILES.searchIndex, jsonText(searchIndex)],
    [OUTPUT_FILES.publicationsJsonLd, jsonText(publicationsJsonLd)],
    [OUTPUT_FILES.paperSeo, jsonText(paperSeo)],
    [OUTPUT_FILES.sitemap, sitemap]
  ];

  if (checkMode) {
    let allOk = true;
    outputs.forEach(([filePath, nextText]) => {
      const ok = writeOrCheck(filePath, nextText, false);
      if (!ok) {
        allOk = false;
      }
    });
    if (!allOk) {
      process.exitCode = 1;
    }
    return;
  }

  outputs.forEach(([filePath, nextText]) => {
    writeOrCheck(filePath, nextText, true);
  });
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
