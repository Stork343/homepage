#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const MASTER_FILE = path.join(ROOT, "data", "site-master.json");
const METADATA_CACHE_FILE = path.join(ROOT, "data", "metadata-cache.generated.json");
const OUTPUT_FILES = {
  publications: path.join(ROOT, "data", "publications.json"),
  paperPages: path.join(ROOT, "data", "paper-pages.json"),
  paperToc: path.join(ROOT, "data", "paper-toc.generated.json"),
  publicationsJsonLd: path.join(ROOT, "data", "publications-jsonld.generated.json"),
  paperSeo: path.join(ROOT, "data", "paper-seo.generated.json"),
  sitemap: path.join(ROOT, "sitemap.xml"),
  siteUpdated: path.join(ROOT, "data", "site-updated.generated.json"),
  indexHtml: path.join(ROOT, "index.html")
};

function todayInSiteTimeZone() {
  const timeZone = process.env.SITE_TIME_ZONE || "Asia/Shanghai";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function masterDataVersion(master) {
  return String(master && (master.data_version || master.updated) || "").trim();
}

function hashText(text) {
  const normalized = String(text).replace(/\r\n/g, "\n");
  return crypto.createHash("sha1").update(normalized, "utf8").digest("hex").slice(0, 10);
}

/* ═══ 体检 D-4 / 修复路线图第 26 条：消除 index.html 与 I18N 字典的双数据源 ═══

   index.html 里带 data-i18n / data-i18n-aria-label / data-i18n-placeholder 的静态文案，
   与 scripts/main.js 的 I18N.zh 字典是**同一批文案的两份拷贝**，实测已漂移 28 处：

   · 语言性漂移（15 处）：整个 footer 与 skip-link 的静态文本是英文
     （"Skip to main content" / "Information" / "Open Access" / "Sign me up" …），
     而页面 lang="zh-CN"、默认字典为 zh。后果是两件事：无 JS 时中文页配英文页脚；
     有 JS 时首帧渲染英文、随后被 applyI18nText 改写成中文 —— 用户能看见文案闪变。
   · 内容性漂移（6 处）：profile_desc 用半角标点而字典用全角；research_qr_desc
     写作「混合效应数据的分析」而字典是「混合效应数据分析」；
     publications_search_label 静态是「检索成果」而字典是「全站检索（按标题、作者、
     关键词）」；research_spa_desc / research_mixed_desc / placeholder 同类。
   · aria-label 漂移（7 处）：4 个筛选 select 的 aria-label 是英文单写
     （"Year filter" / "Venue filter" …），字典里已有中文却对不上。

   审计给的两条路是「加 CI 断言」或「构建时回填」。这里选回填，因为它顺带把断言
   也解决了：index.html 本就是本脚本的生成产物（见 outputs 里的 indexHtml 项），
   静态文案一旦由字典推导，check:data 跑的 --check 就会拿生成结果与磁盘文件逐字节比对，
   **任何漂移都会当场判红**，不需要再单独建一条门禁。

   为什么不把字典抽成 data/i18n.json 当 SSOT：main.js 是无打包器的纯浏览器脚本，
   字典必须在首帧同步可用（改成 fetch 会让文案闪变更严重，正是要修的东西）。
   故字典仍留在 main.js，构建时从源码中按括号配平取出该字面量再求值 ——
   不猜行号（行号会漂），且字典里若混进非字面量会立刻抛错而不是静默出错。 */
function extractI18nDict(jsSource) {
  const marker = "const I18N = {";
  const start = jsSource.indexOf(marker);
  if (start < 0) {
    throw new Error("build-site-data: 在 scripts/main.js 中找不到 `const I18N = {`，无法回填静态文案");
  }
  let i = jsSource.indexOf("{", start);
  let depth = 0;
  let end = -1;
  let quote = null;
  let escaped = false;
  for (; i < jsSource.length; i++) {
    const ch = jsSource[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "/" && jsSource[i + 1] === "/") {
      while (i < jsSource.length && jsSource[i + 1] !== "\n") i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) {
    throw new Error("build-site-data: I18N 字典字面量括号未配平，无法回填静态文案");
  }
  const dict = new Function(`return ${jsSource.slice(jsSource.indexOf("{", start), end + 1)}`)();
  if (!dict || typeof dict.zh !== "object" || dict.zh === null) {
    throw new Error("build-site-data: I18N 字典缺少 zh 分支，无法回填静态文案");
  }
  return dict;
}

function escapeHtmlText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function backfillI18nText(html, dict) {
  const zh = dict.zh;
  // 刻意比运行时更严：t(key) 在缺键时会退化成键名本身，把 "footer_info" 这种字符串
  // 直接显示给用户；构建期则宁可报错，让缺翻译在 CI 就暴露，而不是上线后才发现。
  const value = (key) => {
    if (typeof zh[key] !== "string" || !zh[key]) {
      throw new Error(`build-site-data: I18N.zh 缺少键 "${key}"，index.html 却引用了它`);
    }
    return zh[key];
  };
  const countAttr = (name) => (html.match(new RegExp(`[\\s]${name}="`, "g")) || []).length;

  let textCount = 0;
  let ariaCount = 0;
  let placeholderCount = 0;

  // 1) 文本节点。已实测确认这 62 个 [data-i18n] 节点**元素子节点数全为 0**
  //    （applyI18nText 用的是 node.textContent 赋值，若有子节点早就会被吃掉），
  //    故 [^<]* 足以覆盖整个文本，替换结果与运行时逐字节一致。
  //    注意副作用：原本为排版而写在元素内的换行与缩进会被压平 —— 这是必须的，
  //    因为 textContent 不含那些空白，留着就永远比不平、闪变也消不掉。
  html = html.replace(
    /(<[a-zA-Z][^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/[a-zA-Z][\w-]*>)/g,
    (whole, open, key, oldText, close) => {
      textCount++;
      return open + escapeHtmlText(value(key)) + close;
    }
  );

  // 2) aria-label。绝大多数目标本来就带该属性（纯替换）；唯一例外是
  //    #pub-search-input，它只有 data-i18n-aria-label 而没有 aria-label ——
  //    运行时由 setAttribute 创建，静态文件里则需在结束尖括号前插入。
  //    匹配属性时刻意要求前面是空白：否则 \baria-label 会命中
  //    data-i18n-aria-label 内部（"-" 与 "a" 之间就是一个词边界），把键名当成属性值。
  //    本次排查中我自己就先踩了这个坑，得到 8 条假阳性。
  html = html.replace(/<[a-zA-Z][^>]*\bdata-i18n-aria-label="([^"]+)"[^>]*>/g, (tag, key) => {
    ariaCount++;
    const attr = `aria-label="${escapeHtmlAttr(value(key))}"`;
    if (/(^|\s)aria-label="[^"]*"/.test(tag)) {
      return tag.replace(/(\s)aria-label="[^"]*"/, `$1${attr}`);
    }
    return tag.replace(/>$/, ` ${attr}>`);
  });

  // 3) placeholder，同 aria-label。
  html = html.replace(/<[a-zA-Z][^>]*\bdata-i18n-placeholder="([^"]+)"[^>]*>/g, (tag, key) => {
    placeholderCount++;
    const attr = `placeholder="${escapeHtmlAttr(value(key))}"`;
    if (/(^|\s)placeholder="[^"]*"/.test(tag)) {
      return tag.replace(/(\s)placeholder="[^"]*"/, `$1${attr}`);
    }
    return tag.replace(/>$/, ` ${attr}>`);
  });

  // 强断言：三类替换的命中数必须与源文件里对应属性的出现次数完全相等。
  // 少一处就说明正则没覆盖到某种写法（属性顺序、自闭合、跨行标签等），
  // 那会造成「一部分回填了、一部分没回填」的静默半吊子状态 —— 比不回填更难查。
  const expectedText = countAttr("data-i18n");
  const expectedAria = countAttr("data-i18n-aria-label");
  const expectedPlaceholder = countAttr("data-i18n-placeholder");
  if (textCount !== expectedText) {
    throw new Error(`build-site-data: data-i18n 文本回填 ${textCount} 处，但源文件有 ${expectedText} 处`);
  }
  if (ariaCount !== expectedAria) {
    throw new Error(`build-site-data: aria-label 回填 ${ariaCount} 处，但源文件有 ${expectedAria} 处`);
  }
  if (placeholderCount !== expectedPlaceholder) {
    throw new Error(`build-site-data: placeholder 回填 ${placeholderCount} 处，但源文件有 ${expectedPlaceholder} 处`);
  }
  return html;
}

function buildIndexHtml(root) {
  const indexPath = path.join(root, "index.html");
  const cssPath = path.join(root, "enhanced-main.css");
  const jsPath = path.join(root, "scripts", "main.js");
  const jsSource = fs.readFileSync(jsPath, "utf8");
  let html = fs.readFileSync(indexPath, "utf8");
  const cssHash = hashText(fs.readFileSync(cssPath, "utf8"));
  const jsHash = hashText(jsSource);
  html = html.replace(/(enhanced-main\.css\?v=)[^"']+/g, `$1${cssHash}`);
  html = html.replace(/(scripts\/main\.js\?v=)[^"']+/g, `$1${jsHash}`);
  // footer_text 刻意回填**静态兜底值**（"© 2026 HOU Jian."）而非带日期的模板渲染结果：
  // site-updated.generated.json 写的是 todayInSiteTimeZone()，每天都在变（--check 模式
  // 也因此对它专门豁免）。若把当天日期烤进 index.html，这个文件就会天天不同、
  // check:data 天天判红。日期由 loadSiteMeta() 在运行时取到后调 applyI18nText() 补上，
  // 属有意的渐进增强，不是文案闪变。
  return backfillI18nText(html, extractI18nDict(jsSource));
}

/* 六个阅读页共享 papers/shared/ 下的 paper-reader.js 与 paper-theme.css，
   各自的 ?v= 缓存串此前纯手工维护且已过期（改过共享文件却不换串，回访用户
   永远拿旧缓存）。改为与 index.html 同一套 sha1(10) 内容哈希自动同步。 */
function readerAssetHashes(root) {
  return {
    js: hashText(fs.readFileSync(path.join(root, "papers", "shared", "paper-reader.js"), "utf8")),
    css: hashText(fs.readFileSync(path.join(root, "papers", "shared", "paper-theme.css"), "utf8"))
  };
}

function buildPaperPageHtml(root, relPath, hashes) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing paper page: ${relPath}`);
  }
  return fs
    .readFileSync(filePath, "utf8")
    .replace(/(paper-reader\.js\?v=)[^"']+/g, `$1${hashes.js}`)
    .replace(/(paper-theme\.css\?v=)[^"']+/g, `$1${hashes.css}`);
}

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
    .filter((pub) => pub && !pub.hidden && pub.paper_page && typeof pub.paper_page === "object")
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
      /* 「本站未存档全文」的意图由阅读页自己声明（与 __PAPER_PDF_URL__ 同源），
         生成器只负责把这个意图连同 SSOT 里的官方获取渠道一起下发给 paper-reader.js。
         不能用「paper_page 里有没有配 pdf_url / pdf_candidates」来推断 —— hcqr 的本地
         PDF 写在页面 HTML 的 __PAPER_PDF_URL__ 里，据此推断会把它误判为没有全文，
         进而让好好的阅读页显示「本站未存档全文」。 */
      const pageHtmlPath = path.join(ROOT, output.path);
      const declaresNoLocalFulltext =
        fs.existsSync(pageHtmlPath) &&
        /window\.__PAPER_NO_LOCAL_FULLTEXT__\s*=\s*true/.test(fs.readFileSync(pageHtmlPath, "utf8"));
      if (declaresNoLocalFulltext) {
        const pageLinks = pub.links && typeof pub.links === "object" ? pub.links : {};
        output.no_local_fulltext = true;
        output.fulltext_links = [
          ["doi", pageLinks.doi],
          ["article", pageLinks.article],
          ["code", pageLinks.code]
        ]
          .filter(([, href]) => typeof href === "string" && /^https?:\/\//i.test(href.trim()))
          .map(([kind, href]) => ({ kind, href: href.trim() }));
      }
      return output;
    });
}

function buildPublications(master, metadataById) {
  const publications = (Array.isArray(master.publications) ? master.publications : []).filter(
    (pub) => !pub || !pub.hidden
  );
  return publications.map((pub) => {
    const output = { ...pub };
    delete output.paper_page;
    delete output.published;
    const statusZh = localizedText(pub.status, "zh");
    const statusEn = localizedText(pub.status, "en");
    const isManuscript =
      /手稿/i.test(statusZh) ||
      /manuscript/i.test(statusZh) ||
      /manuscript/i.test(statusEn);
    const isPublished =
      Boolean(pub && pub.publication_info && pub.publication_info.display) ||
      pub.published === true;
    const metadata = metadataById.get(String(pub.id || ""));
    if (!output.links || typeof output.links !== "object") {
      output.links = {};
    }
    if (metadata) {
      if (!output.links.doi && metadata.doi_url) {
        output.links.doi = metadata.doi_url;
      }
      output.metadata = {
        ...(output.metadata && typeof output.metadata === "object" ? output.metadata : {}),
        doi: metadata.doi || "",
        arxiv_id: metadata.arxiv_id || "",
        source: metadata.source || "",
        checked_at: metadata.checked_at || ""
      };
    }
    if (isManuscript) {
      output.links.pdf = null;
    }
    if (!isPublished) {
      output.links.pdf = null;
      output.links.html = null;
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
    updated: masterDataVersion(master),
    papers: extractPaperPages(Array.isArray(master.publications) ? master.publications : [])
  };
}

function buildPaperToc(master) {
  const papers = extractPaperPages(Array.isArray(master.publications) ? master.publications : []);
  return {
    updated: masterDataVersion(master),
    generated_at: `${masterDataVersion(master) || "1970-01-01"}T00:00:00.000Z`,
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
    const publicationInfo =
      pub && pub.publication_info && typeof pub.publication_info === "object"
        ? pub.publication_info
        : null;
    const publicationDisplayZh = localizedText(publicationInfo && publicationInfo.display, "zh");
    const publicationDisplayEn = localizedText(publicationInfo && publicationInfo.display, "en");
    const publicationSummaryZh = [venueZh || venueEn, publicationDisplayZh || String(pub.year || "")]
      .filter(Boolean)
      .join(", ");
    const publicationSummaryEn = [venueEn || venueZh, publicationDisplayEn || String(pub.year || "")]
      .filter(Boolean)
      .join(", ");
    const descriptionZh = sanitizeForDescription(
      `${titleZh || titleEn}. 作者: ${localizedText(pub.authors, "zh") || authorsEn}. ${publicationSummaryZh}.`
    );
    const descriptionEn = sanitizeForDescription(
      `${titleEn || titleZh}. Authors: ${authorsEn || localizedText(pub.authors, "zh")}. ${publicationSummaryEn}.`
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
    const datePublished = String((publicationInfo && publicationInfo.date_published) || pub.year || "");
    const volumeNumber = String((publicationInfo && publicationInfo.volume) || "").trim();
    const articleNumber = String((publicationInfo && publicationInfo.article_number) || "").trim();
    const scholarlyArticle = {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      name: titleEn || titleZh,
      headline: titleEn || titleZh,
      inLanguage: "en",
      datePublished,
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
    if (volumeNumber) {
      scholarlyArticle.isPartOf.volumeNumber = volumeNumber;
    }
    if (articleNumber) {
      scholarlyArticle.pagination = articleNumber;
    }
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
    updated: masterDataVersion(master),
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
  const publicationsJsonLd = buildPublicationsJsonLd(master, publications);
  const paperSeo = buildPaperSeo(master, publications);
  const sitemap = buildSitemap(master);

  const readerHashes = readerAssetHashes(ROOT);

  const outputs = [
    [OUTPUT_FILES.publications, jsonText(publications)],
    [OUTPUT_FILES.paperPages, jsonText(paperPages)],
    [OUTPUT_FILES.paperToc, jsonText(paperToc)],
    [OUTPUT_FILES.publicationsJsonLd, jsonText(publicationsJsonLd)],
    [OUTPUT_FILES.paperSeo, jsonText(paperSeo)],
    [OUTPUT_FILES.sitemap, sitemap],
    [OUTPUT_FILES.siteUpdated, jsonText({ updated: todayInSiteTimeZone() })],
    [OUTPUT_FILES.indexHtml, buildIndexHtml(ROOT)],
    // 阅读页 HTML 也纳入同一套检查/写入：?v= 与共享资源内容哈希不一致即判红
    ...paperPages.papers.map((page) => [
      path.join(ROOT, page.path),
      buildPaperPageHtml(ROOT, page.path, readerHashes)
    ])
  ];

  if (checkMode) {
    let allOk = true;
    outputs.forEach(([filePath, nextText]) => {
      if (filePath === OUTPUT_FILES.siteUpdated) {
        if (!fs.existsSync(filePath)) {
          console.error(`MISSING: ${path.relative(ROOT, filePath)} (run: node scripts/build-site-data.js --write)`);
          allOk = false;
        } else {
          try {
            JSON.parse(fs.readFileSync(filePath, "utf8"));
            console.log(`OK: ${path.relative(ROOT, filePath)} exists (date refreshes on write).`);
          } catch (error) {
            console.error(`INVALID JSON: ${path.relative(ROOT, filePath)}`);
            allOk = false;
          }
        }
        return;
      }
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
