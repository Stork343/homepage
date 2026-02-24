// scripts/main.js
(function () {
  function getStorageItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function setStorageItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      // Ignore storage errors (private mode, disabled storage, etc.)
    }
  }

  function getInitialTheme() {
    const savedTheme = getStorageItem("homepage-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function readPublicationFilterStateFromUrl() {
    const url = new URL(window.location.href);
    const q = (url.searchParams.get("q") || "").trim();
    const year = (url.searchParams.get("year") || "all").trim();
    const status = (url.searchParams.get("status") || "all").trim();
    return { q, year, status };
  }

  const initialFilters = readPublicationFilterStateFromUrl();

  const state = {
    lang: getStorageItem("homepage-lang") || "zh",
    theme: getInitialTheme(),
    publications: [],
    filters: {
      q: initialFilters.q,
      year: initialFilters.year,
      status: initialFilters.status
    }
  };

  const I18N = {
    zh: {
      nav_about: "关于我",
      nav_research: "研究领域",
      nav_publications: "学术成果",
      nav_cv: "简历",
      nav_contact: "联系方式",
      profile_name: "侯健",
      profile_title: "统计学在读博士 | 初级统计师",
      profile_desc: "主要关注分位回归、鞍点逼近、混合效应建模等领域。",
      research_title: "研究领域",
      research_qr_title: "分位回归",
      research_qr_desc: "高维分位回归建模以及混合效应数据分析，特别关注非光滑估计与渐近推断。",
      research_spa_title: "鞍点逼近",
      research_spa_desc: "数值计算优化、半参数鞍点逼近方法与区间估计问题。",
      research_mixed_title: "混合效应",
      research_mixed_desc: "大规模全基因组关联分析，以及高维空间中可扩展贝叶斯/变分方法。",
      tag_longitudinal: "纵向数据",
      tag_repeated: "重复测量",
      tag_optimization: "优化算法",
      publications_title: "学术成果",
      publications_note: "按年份分组展示，支持 BibTeX 查看与引用复制。",
      publications_search_label: "检索成果",
      publications_search_placeholder: "按标题、作者、期刊或关键词检索…",
      publications_year_all: "全部年份",
      publications_status_all: "全部状态",
      publications_clear: "清空",
      publications_result_count: "显示 {shown} / {total} 篇",
      publications_empty: "没有匹配的成果，请调整筛选条件。",
      cv_title: "简历",
      cv_zh_title: "中文简历",
      cv_zh_desc: "下载最新中文 CV（PDF）",
      cv_en_title: "English CV",
      cv_en_desc: "Download the latest English CV (PDF)",
      cv_updated: "最近更新：2026-02-24",
      contact_title: "联系方式",
      contact_email_label: "邮箱",
      contact_affiliation_label: "机构",
      contact_affiliation_value: "中国人民大学统计学院",
      contact_address_label: "地址",
      contact_address_value: "中国北京市海淀区中关村大街59号，100872",
      contact_collab_label: "研究合作",
      contact_collab_value: "欢迎学术合作与交流",
      contact_collab_people: "主要合作者：TIAN Maozai, MENG Tan, WANG Zhihao",
      footer_text: "© 2026 HOU Jian. 最后更新：2026年2月",
      label_pdf: "PDF",
      label_code: "Code",
      label_doi: "DOI",
      label_html: "HTML",
      label_copy_citation: "复制引用",
      label_bibtex: "BibTeX",
      label_copy_bibtex: "复制 BibTeX",
      label_not_available: "暂不可用",
      theme_toggle_dark: "夜间",
      theme_toggle_light: "日间",
      theme_switch_to_dark: "切换到夜间",
      theme_switch_to_light: "切换到日间",
      label_loading: "正在加载成果列表...",
      label_load_failed: "成果列表加载失败，请稍后重试。",
      toast_citation_copied: "已复制引用",
      toast_bibtex_copied: "已复制 BibTeX",
      toast_copy_failed: "复制失败，请手动复制",
      toast_theme_dark: "已启用夜间模式",
      toast_theme_light: "已启用日间模式"
    },
    en: {
      nav_about: "About",
      nav_research: "Research",
      nav_publications: "Publications",
      nav_cv: "CV",
      nav_contact: "Contact",
      profile_name: "Hou Jian",
      profile_title: "PhD Candidate in Statistics | Junior Statistician",
      profile_desc: "Research interests include quantile regression, saddlepoint approximation, and mixed-effects modeling.",
      research_title: "Research Areas",
      research_qr_title: "Quantile Regression",
      research_qr_desc: "High-dimensional quantile regression and mixed-effects data analysis with a focus on non-smooth estimation and asymptotic inference.",
      research_spa_title: "Saddlepoint Approximation",
      research_spa_desc: "Numerical optimization, semiparametric saddlepoint methods, and interval estimation.",
      research_mixed_title: "Mixed Effects",
      research_mixed_desc: "Large-scale GWAS and scalable Bayesian/variational methods in high-dimensional spaces.",
      tag_longitudinal: "Longitudinal Data",
      tag_repeated: "Repeated Measures",
      tag_optimization: "Optimization",
      publications_title: "Publications",
      publications_note: "Grouped by year, with BibTeX view and quick citation copy.",
      publications_search_label: "Search Publications",
      publications_search_placeholder: "Search by title, author, venue, or keyword...",
      publications_year_all: "All Years",
      publications_status_all: "All Status",
      publications_clear: "Clear",
      publications_result_count: "Showing {shown} / {total} items",
      publications_empty: "No matching publications. Try a different filter.",
      cv_title: "Curriculum Vitae",
      cv_zh_title: "Chinese CV",
      cv_zh_desc: "Download latest Chinese CV (PDF)",
      cv_en_title: "English CV",
      cv_en_desc: "Download latest English CV (PDF)",
      cv_updated: "Last updated: 2026-02-24",
      contact_title: "Contact",
      contact_email_label: "Email",
      contact_affiliation_label: "Affiliation",
      contact_affiliation_value: "School of Statistics, Renmin University of China",
      contact_address_label: "Address",
      contact_address_value: "No. 59 Zhongguancun Street, Haidian District, Beijing 100872, China",
      contact_collab_label: "Collaboration",
      contact_collab_value: "Open to academic collaboration and discussion",
      contact_collab_people: "Main collaborators: TIAN Maozai, MENG Tan, WANG Zhihao",
      footer_text: "© 2026 HOU Jian. Last updated: February 2026",
      label_pdf: "PDF",
      label_code: "Code",
      label_doi: "DOI",
      label_html: "HTML",
      label_copy_citation: "Copy Citation",
      label_bibtex: "BibTeX",
      label_copy_bibtex: "Copy BibTeX",
      label_not_available: "Not available",
      theme_toggle_dark: "Dark",
      theme_toggle_light: "Light",
      theme_switch_to_dark: "Switch to dark mode",
      theme_switch_to_light: "Switch to light mode",
      label_loading: "Loading publications...",
      label_load_failed: "Failed to load publications. Please retry later.",
      toast_citation_copied: "Citation copied",
      toast_bibtex_copied: "BibTeX copied",
      toast_copy_failed: "Copy failed, please copy manually",
      toast_theme_dark: "Dark mode enabled",
      toast_theme_light: "Light mode enabled"
    }
  };

  const SORTED_LINK_KEYS = ["pdf", "code", "doi", "html"];
  const REVEAL_SELECTOR = [
    ".research-item",
    ".publication-card",
    ".project-card",
    ".cv-card",
    ".contact-item"
  ].join(", ");
  let revealObserver = null;

  function t(key) {
    return I18N[state.lang][key] || I18N.zh[key] || key;
  }

  function formatI18n(templateKey, values) {
    const template = t(templateKey);
    return String(template).replace(/\{(\w+)\}/g, function (_, name) {
      return Object.prototype.hasOwnProperty.call(values || {}, name) ? values[name] : "";
    });
  }

  function applyI18nText() {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key && t(key)) {
        node.textContent = t(key);
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-i18n-placeholder");
      if (key) {
        node.setAttribute("placeholder", t(key));
      }
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
      const key = node.getAttribute("data-i18n-aria-label");
      if (key) {
        node.setAttribute("aria-label", t(key));
      }
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === state.lang);
    });
    updateThemeToggle();
    renderPublicationFilterOptions();
  }

  function setLanguage(lang) {
    state.lang = lang === "en" ? "en" : "zh";
    setStorageItem("homepage-lang", state.lang);
    applyI18nText();
    renderPublications();
  }

  function showToast(message) {
    const toast = document.getElementById("copy-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.classList.remove("visible");
    }, 1700);
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    } catch (_) {
      showToast(t("toast_copy_failed"));
    }
  }

  function updateThemeToggle() {
    const themeToggle = document.getElementById("theme-toggle");
    if (!themeToggle) return;

    const isDark = state.theme === "dark";
    const buttonLabel = isDark ? t("theme_toggle_light") : t("theme_toggle_dark");
    const switchLabel = isDark ? t("theme_switch_to_light") : t("theme_switch_to_dark");

    themeToggle.textContent = `${isDark ? "☀" : "☾"} ${buttonLabel}`;
    themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    themeToggle.setAttribute("aria-label", switchLabel);
    themeToggle.title = switchLabel;
  }

  function setTheme(theme, options = {}) {
    const notify = Boolean(options.notify);
    state.theme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", state.theme);
    document.documentElement.style.colorScheme = state.theme;
    document.documentElement.classList.toggle("theme-dark", state.theme === "dark");
    if (document.body) {
      document.body.classList.toggle("theme-dark", state.theme === "dark");
    }
    setStorageItem("homepage-theme", state.theme);
    updateThemeToggle();

    if (notify) {
      showToast(state.theme === "dark" ? t("toast_theme_dark") : t("toast_theme_light"));
    }
  }

  function updateScrollProgress() {
    const root = document.documentElement;
    const totalScrollable = Math.max(0, root.scrollHeight - window.innerHeight);
    const progress = totalScrollable > 0 ? Math.min(100, (window.scrollY / totalScrollable) * 100) : 0;
    root.style.setProperty("--scroll-progress", `${progress.toFixed(2)}%`);
  }

  function initScrollProgress() {
    let rafId = 0;
    const requestUpdate = () => {
      if (rafId) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateScrollProgress();
      });
    };
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    requestUpdate();
  }

  function initRevealObserver() {
    if (!("IntersectionObserver" in window)) {
      revealObserver = null;
      return;
    }
    const reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      revealObserver = null;
      return;
    }
    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
  }

  function applyRevealAnimation(root) {
    const scope = root && typeof root.querySelectorAll === "function" ? root : document;
    const targets = Array.from(scope.querySelectorAll(REVEAL_SELECTOR));
    if (!targets.length) {
      return;
    }
    const reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targets.forEach((node, index) => {
      node.classList.add("reveal-item");
      node.style.setProperty("--reveal-delay", `${Math.min((index % 7) * 50, 300)}ms`);
      if (reduceMotion || !revealObserver) {
        node.classList.add("in-view");
        return;
      }
      if (node.dataset.revealBound === "1") {
        return;
      }
      node.dataset.revealBound = "1";
      revealObserver.observe(node);
    });
  }

  function createLinkOrPlaceholder(key, url) {
    const labelKey = `label_${key}`;
    if (url) {
      const link = document.createElement("a");
      link.className = "pub-link";
      link.href = url;
      link.textContent = t(labelKey);
      if (url.startsWith("http")) {
        link.target = "_blank";
        link.rel = "noopener";
      }
      return link;
    }

    const span = document.createElement("span");
    span.className = "pub-link is-disabled";
    span.textContent = t(labelKey);
    span.title = t("label_not_available");
    span.setAttribute("aria-disabled", "true");
    return span;
  }

  function createSeparator() {
    const separator = document.createElement("span");
    separator.className = "separator";
    separator.textContent = "·";
    return separator;
  }

  function getPublicationLanguage(pub) {
    return pub && pub.force_english_display ? "en" : state.lang;
  }

  function localizedText(value, lang) {
    if (value && typeof value === "object") {
      return value[lang] || value.en || value.zh || "";
    }
    return value || "";
  }

  function getStatusText(pub, lang) {
    const localized = localizedText(pub && pub.status, lang);
    if (localized) {
      return localized;
    }
    return lang === "zh" ? "已发表" : "Published";
  }

  function getStatusKey(pub) {
    const fromEn = localizedText(pub && pub.status, "en");
    if (fromEn) {
      return fromEn.trim().toLowerCase();
    }
    const fromZh = localizedText(pub && pub.status, "zh");
    if (fromZh) {
      return fromZh.trim().toLowerCase();
    }
    return "published";
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildSearchHaystack(pub) {
    const pieces = [
      localizedText(pub.title, "zh"),
      localizedText(pub.title, "en"),
      localizedText(pub.authors, "zh"),
      localizedText(pub.authors, "en"),
      localizedText(pub.venue, "zh"),
      localizedText(pub.venue, "en"),
      getStatusText(pub, "zh"),
      getStatusText(pub, "en"),
      String(pub.year || "")
    ];
    return normalizeSearchText(pieces.join(" "));
  }

  function writePublicationFiltersToUrl() {
    const url = new URL(window.location.href);
    if (state.filters.q) {
      url.searchParams.set("q", state.filters.q);
    } else {
      url.searchParams.delete("q");
    }
    if (state.filters.year && state.filters.year !== "all") {
      url.searchParams.set("year", state.filters.year);
    } else {
      url.searchParams.delete("year");
    }
    if (state.filters.status && state.filters.status !== "all") {
      url.searchParams.set("status", state.filters.status);
    } else {
      url.searchParams.delete("status");
    }
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function getFilteredPublications() {
    const query = normalizeSearchText(state.filters.q);
    return state.publications.filter((pub) => {
      if (state.filters.year !== "all" && String(pub.year || "") !== String(state.filters.year)) {
        return false;
      }
      if (state.filters.status !== "all" && getStatusKey(pub) !== state.filters.status) {
        return false;
      }
      if (query && !buildSearchHaystack(pub).includes(query)) {
        return false;
      }
      return true;
    });
  }

  function updatePublicationResultCount(shown, total) {
    const resultCount = document.getElementById("pub-result-count");
    if (!resultCount) {
      return;
    }
    resultCount.textContent = formatI18n("publications_result_count", {
      shown: String(shown),
      total: String(total)
    });
  }

  function renderPublicationFilterOptions() {
    const yearSelect = document.getElementById("pub-year-filter");
    const statusSelect = document.getElementById("pub-status-filter");
    if (!yearSelect || !statusSelect) {
      return;
    }

    const years = Array.from(new Set(state.publications.map((pub) => String(pub.year || ""))))
      .filter(Boolean)
      .sort((a, b) => Number(b) - Number(a));

    yearSelect.innerHTML = "";
    const yearAll = document.createElement("option");
    yearAll.value = "all";
    yearAll.textContent = t("publications_year_all");
    yearSelect.appendChild(yearAll);
    years.forEach((year) => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
    yearSelect.value = years.includes(String(state.filters.year)) ? String(state.filters.year) : "all";

    const statusPairs = Array.from(
      state.publications.reduce((acc, pub) => {
        const key = getStatusKey(pub);
        if (!acc.has(key)) {
          acc.set(key, getStatusText(pub, state.lang));
        }
        return acc;
      }, new Map())
    ).sort((a, b) => a[1].localeCompare(b[1]));

    statusSelect.innerHTML = "";
    const statusAll = document.createElement("option");
    statusAll.value = "all";
    statusAll.textContent = t("publications_status_all");
    statusSelect.appendChild(statusAll);
    statusPairs.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      statusSelect.appendChild(option);
    });
    statusSelect.value = statusPairs.some(([value]) => value === state.filters.status)
      ? state.filters.status
      : "all";
  }

  function updateScholarlyJsonLd() {
    const targetId = "publications-jsonld";
    const existing = document.getElementById(targetId);
    if (existing) {
      existing.remove();
    }
    if (!state.publications.length) {
      return;
    }
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = targetId;
    const baseUrl = "https://stork343.github.io/homepage/";
    const itemListElement = state.publications.map((pub, index) => {
      const articleUrl = pub.links && pub.links.article ? pub.links.article : null;
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "ScholarlyArticle",
          name: localizedText(pub.title, "en") || localizedText(pub.title, "zh"),
          author: String(localizedText(pub.authors, "en") || localizedText(pub.authors, "zh"))
            .split(",")
            .map((author) => ({
              "@type": "Person",
              name: author.trim()
            }))
            .filter((author) => author.name),
          datePublished: String(pub.year || ""),
          isPartOf: localizedText(pub.venue, "en") || localizedText(pub.venue, "zh"),
          url: articleUrl
            ? articleUrl.startsWith("http")
              ? articleUrl
              : `${baseUrl}${articleUrl.replace(/^\.?\//, "")}`
            : `${baseUrl}#publications`
        }
      };
    });
    script.textContent = JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Publications by Hou Jian",
        itemListElement
      },
      null,
      2
    );
    document.head.appendChild(script);
  }

  function createPublicationCard(pub) {
    const pubLang = getPublicationLanguage(pub);
    const card = document.createElement("article");
    card.className = "publication-card has-thumb";

    const title = document.createElement("h3");
    title.className = "publication-title";

    const articleLink = pub.links && pub.links.article ? pub.links.article : null;
    if (articleLink) {
      const a = document.createElement("a");
      a.href = articleLink;
      a.textContent = localizedText(pub.title, pubLang);
      if (articleLink.startsWith("http")) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      title.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.className = "publication-title-text";
      span.textContent = localizedText(pub.title, pubLang);
      title.appendChild(span);
    }

    const authors = document.createElement("p");
    authors.className = "publication-authors";
    authors.textContent = localizedText(pub.authors, pubLang);

    const venue = document.createElement("p");
    venue.className = "publication-venue";
    venue.textContent = localizedText(pub.venue, pubLang);

    const statusText = localizedText(pub.status, pubLang);
    if (statusText) {
      venue.appendChild(document.createTextNode(". "));
      const status = document.createElement("span");
      status.className = "publication-status";
      status.textContent = statusText;
      venue.appendChild(status);
    }

    const links = document.createElement("div");
    links.className = "publication-links";

    const linkNodes = [];
    SORTED_LINK_KEYS.forEach((key) => {
      const url = pub.links ? pub.links[key] : null;
      linkNodes.push(createLinkOrPlaceholder(key, url));
    });

    const copyCitationBtn = document.createElement("button");
    copyCitationBtn.type = "button";
    copyCitationBtn.className = "pub-link";
    copyCitationBtn.textContent = t("label_copy_citation");
    copyCitationBtn.addEventListener("click", () => {
      copyText(localizedText(pub.citation, pubLang), t("toast_citation_copied"));
    });

    const copyBibBtn = document.createElement("button");
    copyBibBtn.type = "button";
    copyBibBtn.className = "pub-link";
    copyBibBtn.textContent = t("label_copy_bibtex");
    copyBibBtn.addEventListener("click", () => {
      copyText(pub.bibtex || "", t("toast_bibtex_copied"));
    });

    linkNodes.forEach((node, index) => {
      links.appendChild(node);
      if (index < linkNodes.length - 1) {
        links.appendChild(createSeparator());
      }
    });

    links.appendChild(createSeparator());
    links.appendChild(copyCitationBtn);
    links.appendChild(createSeparator());
    links.appendChild(copyBibBtn);

    const bibDetails = document.createElement("details");
    bibDetails.className = "bibtex-details";

    const bibSummary = document.createElement("summary");
    bibSummary.textContent = t("label_bibtex");

    const bibPre = document.createElement("pre");
    bibPre.className = "bibtex-pre";
    bibPre.textContent = pub.bibtex || "";

    bibDetails.appendChild(bibSummary);
    bibDetails.appendChild(bibPre);

    const media = document.createElement("div");
    media.className = "pub-media";

    const picture = document.createElement("picture");
    if (pub.image && pub.image.webp) {
      const source = document.createElement("source");
      source.srcset = pub.image.webp;
      source.type = "image/webp";
      picture.appendChild(source);
    }

    const img = document.createElement("img");
    img.src = (pub.image && pub.image.src) || "";
    img.alt = localizedText(pub.image && pub.image.alt, pubLang);
    img.loading = "lazy";
    img.decoding = "async";
    img.fetchPriority = "low";
    if (pub.image && pub.image.width) {
      img.width = pub.image.width;
    }
    if (pub.image && pub.image.height) {
      img.height = pub.image.height;
    }

    picture.appendChild(img);
    media.appendChild(picture);

    card.appendChild(title);
    card.appendChild(authors);
    card.appendChild(venue);
    card.appendChild(links);
    card.appendChild(bibDetails);
    card.appendChild(media);

    return card;
  }

  function renderPublications() {
    const list = document.getElementById("publications-list");
    if (!list) return;

    if (!state.publications.length) {
      list.innerHTML = `<p class="publication-empty">${t("label_loading")}</p>`;
      updatePublicationResultCount(0, 0);
      return;
    }

    list.innerHTML = "";
    const filteredPublications = getFilteredPublications();
    updatePublicationResultCount(filteredPublications.length, state.publications.length);

    if (!filteredPublications.length) {
      list.innerHTML = `<p class="publication-empty">${t("publications_empty")}</p>`;
      return;
    }

    const grouped = filteredPublications.reduce((acc, pub) => {
      const year = String(pub.year || "Unknown");
      if (!acc[year]) acc[year] = [];
      acc[year].push(pub);
      return acc;
    }, {});

    Object.keys(grouped)
      .sort((a, b) => Number(b) - Number(a))
      .forEach((year) => {
        const group = document.createElement("div");
        group.className = "publication-year-group";

        const yearTitle = document.createElement("h3");
        yearTitle.className = "publication-year";
        yearTitle.textContent = year;

        const items = document.createElement("div");
        items.className = "publication-year-items";

        grouped[year].forEach((pub) => {
          items.appendChild(createPublicationCard(pub));
        });

        group.appendChild(yearTitle);
        group.appendChild(items);
        list.appendChild(group);
      });
    applyRevealAnimation(list);
    window.requestAnimationFrame(updateScrollProgress);
  }

  async function loadPublications() {
    const list = document.getElementById("publications-list");
    if (list) {
      list.innerHTML = `<p class="publication-empty">${t("label_loading")}</p>`;
    }

    let hadCachedData = false;
    const cacheKey = "homepage-publications-cache-v3";
    try {
      const cached = getStorageItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          state.publications = parsed;
          hadCachedData = true;
          renderPublicationFilterOptions();
          renderPublications();
        }
      }
    } catch (_) {
      // ignore cache parse errors
    }

    try {
      const response = await fetch("data/publications.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.publications = await response.json();
      setStorageItem(cacheKey, JSON.stringify(state.publications));
      renderPublicationFilterOptions();
      renderPublications();
      updateScholarlyJsonLd();
    } catch (_) {
      if (!hadCachedData && list) {
        list.innerHTML = `<p class="publication-empty">${t("label_load_failed")}</p>`;
        updatePublicationResultCount(0, 0);
      }
    }
  }

  function initNavigation() {
    const navbar = document.querySelector(".navbar");
    const navLinks = Array.from(document.querySelectorAll(".nav-link"));
    const sections = Array.from(document.querySelectorAll("main section[id]"));
    const navToggle = document.getElementById("nav-toggle");
    const navMenu = document.getElementById("nav-menu");

    function setActiveLink(id) {
      navLinks.forEach((link) => {
        const hrefId = link.getAttribute("href").slice(1);
        const isActive = hrefId === id;
        link.classList.toggle("active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    navLinks.forEach((link) => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        const id = this.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;

        const navHeight = navbar ? navbar.offsetHeight : 0;
        const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight + 1;
        window.scrollTo({ top, behavior: "smooth" });

        setActiveLink(id);
        history.replaceState(null, "", "#" + id);

        if (navMenu && navToggle) {
          navMenu.classList.remove("active");
          navToggle.classList.remove("active");
        }
      });
    });

    if ("IntersectionObserver" in window) {
      const navHeight = navbar ? navbar.offsetHeight : 0;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute("id");
              setActiveLink(id);
              history.replaceState(null, "", "#" + id);
            }
          });
        },
        {
          root: null,
          threshold: 0.3,
          rootMargin: `-${navHeight + 40}px 0px -50% 0px`
        }
      );
      sections.forEach((sec) => observer.observe(sec));
    }

    if (navToggle && navMenu) {
      navToggle.addEventListener("click", () => {
        navMenu.classList.toggle("active");
        navToggle.classList.toggle("active");
      });
    }
  }

  function initLanguageSwitch() {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLanguage(btn.dataset.lang || "zh");
      });
    });
  }

  function initThemeSwitch() {
    const themeToggle = document.getElementById("theme-toggle");
    if (!themeToggle) return;

    themeToggle.addEventListener("click", () => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      setTheme(nextTheme, { notify: true });
    });
  }

  function initPublicationSearch() {
    const input = document.getElementById("pub-search-input");
    const yearSelect = document.getElementById("pub-year-filter");
    const statusSelect = document.getElementById("pub-status-filter");
    const clearBtn = document.getElementById("pub-clear-btn");
    if (!input || !yearSelect || !statusSelect || !clearBtn) {
      return;
    }

    input.value = state.filters.q || "";
    yearSelect.value = state.filters.year || "all";
    statusSelect.value = state.filters.status || "all";

    let searchDebounceTimer = 0;
    const applyFilters = () => {
      state.filters.q = (input.value || "").trim();
      state.filters.year = yearSelect.value || "all";
      state.filters.status = statusSelect.value || "all";
      writePublicationFiltersToUrl();
      renderPublications();
    };

    input.addEventListener("input", () => {
      window.clearTimeout(searchDebounceTimer);
      searchDebounceTimer = window.setTimeout(applyFilters, 120);
    });

    yearSelect.addEventListener("change", applyFilters);
    statusSelect.addEventListener("change", applyFilters);

    clearBtn.addEventListener("click", () => {
      input.value = "";
      yearSelect.value = "all";
      statusSelect.value = "all";
      applyFilters();
      input.focus();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initScrollProgress();
    initRevealObserver();
    initNavigation();
    initLanguageSwitch();
    initThemeSwitch();
    initPublicationSearch();
    applyRevealAnimation(document);
    setTheme(state.theme);
    applyI18nText();
    await loadPublications();
  });
})();
