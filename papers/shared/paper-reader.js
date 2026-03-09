;(async () => {
  try {
    const rootEl = document.documentElement;
    const bodyEl = document.body;
    const topbarEl = document.querySelector(".topbar");
    const sidePanelEl = document.getElementById("sidePanel");
    const sideHandle = document.getElementById("sideToggleHandle");
    let downloadLink = null;
    let themeToggleBtn = null;
    let themeLabel = null;

    function toAbsoluteUrl(value) {
      const raw = String(value || "").trim();
      if (!raw) {
        return "";
      }
      try {
        return new URL(raw, window.location.href).toString();
      } catch (error) {
        return "";
      }
    }

    function dedupeUrlList(values) {
      const output = [];
      const seen = new Set();
      values.forEach((value) => {
        const absolute = toAbsoluteUrl(value);
        if (!absolute || seen.has(absolute)) {
          return;
        }
        seen.add(absolute);
        output.push(absolute);
      });
      return output;
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => {
        switch (char) {
          case "&":
            return "&amp;";
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case '"':
            return "&quot;";
          case "'":
            return "&#39;";
          default:
            return char;
        }
      });
    }

    function normalizeMetaKey(value) {
      return String(value || "")
        .replace(/[:：]/g, "")
        .trim()
        .toLowerCase();
    }

    function getHomeHref() {
      return new URL("../../../index.html#publications", window.location.href).toString();
    }

    const iconMarkup = {
      brand: `
        <svg class="tf-svg-icon tf-svg-icon-brand" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18"></circle>
          <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
          <path d="M12 2a10 10 0 0 1 8.66 5H3.34A10 10 0 0 1 12 2Z" fill="currentColor" opacity="0.38"></path>
        </svg>
      `,
      pagePrev: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      pageNext: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      zoomOut: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path>
        </svg>
      `,
      zoomIn: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path>
        </svg>
      `,
      search: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2.2"></circle>
          <path d="m15 15 4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
        </svg>
      `,
      print: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 9V5h10v4M7 17H5V11h14v6h-2M8 14h8v5H8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
        </svg>
      `,
      fullscreenEnter: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M20 20h-5v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      fullscreenExit: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 9H4V4M15 9h5V4M9 15H4v5M20 20h-5v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      download: `
        <svg class="tf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 4v10M8 10l4 4 4-4M5 18h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      handleOpen: `
        <svg class="tf-svg-icon tf-svg-icon-handle" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14 7 9 12l5 5M19 7l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      handleClosed: `
        <svg class="tf-svg-icon tf-svg-icon-handle" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m10 7 5 5-5 5M5 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      details: `
        <svg class="tf-svg-icon tf-svg-icon-rail" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"></circle>
          <path d="M12 10v6M12 7.4h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `,
      relations: `
        <svg class="tf-svg-icon tf-svg-icon-rail" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 7h12M6 12h12M6 17h12M4 7h.01M4 12h.01M4 17h.01" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"></path>
        </svg>
      `,
      figures: `
        <svg class="tf-svg-icon tf-svg-icon-rail" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="5" width="16" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"></rect>
          <path d="m7 15 3-3 2 2 3-4 2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
          <circle cx="9" cy="9" r="1.3" fill="currentColor"></circle>
        </svg>
      `,
      link: `
        <svg class="tf-svg-icon tf-svg-icon-rail" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10 14 8 16a3 3 0 1 1-4-4l3-3a3 3 0 0 1 4 0M14 10l2-2a3 3 0 1 1 4 4l-3 3a3 3 0 0 1-4 0M9 15l6-6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `
    };

    function readMetaEntries() {
      return Array.from(document.querySelectorAll(".side-panel .meta-list .meta-item"))
        .map((item) => {
          const labelEl = item.querySelector(".meta-label");
          const valueEl = item.querySelector(".meta-value");
          const linkEl = valueEl ? valueEl.querySelector("a[href]") : null;
          return {
            key: normalizeMetaKey(labelEl ? labelEl.textContent : ""),
            label: labelEl ? labelEl.textContent.trim() : "",
            text: valueEl ? valueEl.textContent.trim() : "",
            href: linkEl ? linkEl.href : "",
            item
          };
        })
        .filter((entry) => entry.key && entry.text);
    }

    function buildReaderChrome() {
      const homeHref = getHomeHref();
      const metaEntries = readMetaEntries();
      const titleEntry = metaEntries.find((entry) => entry.key === "title");
      const authorsEntry = metaEntries.find((entry) => entry.key === "authors");
      const journalEntry = metaEntries.find((entry) => entry.key === "journal");
      const doiEntry = metaEntries.find((entry) => entry.key === "doi");
      const articleEntry = metaEntries.find((entry) => entry.key === "article");

      const paperTitle =
        (titleEntry && titleEntry.text) ||
        String(document.title || "")
          .replace(/\s*-\s*PDF\s*$/i, "")
          .trim();
      const journalText = (journalEntry && journalEntry.text) || "Journal article";
      const journalName = journalText.split(",")[0].trim() || journalText;
      const journalMeta = journalText.replace(/^([^,]+),\s*/, "").trim() || "Research Article";
      const coverUrl =
        (document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "").trim() ||
        (document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") || "").trim();

      if (topbarEl) {
        topbarEl.innerHTML = `
          <div class="tf-topbar-brand">
            <a class="tf-brand-link" id="homeLink" href="${escapeHtml(homeHref)}" aria-label="Back to publications">
              <span class="tf-brand-mark" aria-hidden="true">${iconMarkup.brand}</span>
              <span class="tf-brand-copy">
                <strong>Paper Reader</strong>
                <span>Academic archive</span>
              </span>
            </a>
          </div>
          <div class="tf-topbar-center">
            <div class="tf-format-pill" aria-hidden="true">PDF <span class="tf-format-caret">▾</span></div>
            <div class="reader-group tf-page-group">
              <button class="btn btn-ghost tf-icon-btn" id="prevPageBtn" title="Previous page" type="button" aria-label="Previous page">
                <span class="btn-icon">${iconMarkup.pagePrev}</span>
              </button>
              <span class="tf-page-label">Page</span>
              <label class="reader-page-jump" title="Jump to page">
                <input id="pageNumberInput" type="number" min="1" step="1" value="1" aria-label="Page number"/>
                <span>/</span>
                <span id="totalPages">-</span>
              </label>
              <button class="btn btn-ghost tf-icon-btn" id="nextPageBtn" title="Next page" type="button" aria-label="Next page">
                <span class="btn-icon">${iconMarkup.pageNext}</span>
              </button>
            </div>
          </div>
          <div class="tf-topbar-actions">
            <button class="btn btn-ghost tf-icon-btn" id="fullscreenBtn" title="Enter fullscreen" type="button" aria-label="Enter fullscreen">
              <span class="btn-icon">${iconMarkup.fullscreenEnter}</span>
            </button>
            <button class="btn btn-ghost tf-icon-btn" id="zoomOutBtn" title="Zoom out" type="button" aria-label="Zoom out">
              <span class="btn-icon">${iconMarkup.zoomOut}</span>
            </button>
            <button class="btn btn-ghost tf-icon-btn" id="zoomInBtn" title="Zoom in" type="button" aria-label="Zoom in">
              <span class="btn-icon">${iconMarkup.zoomIn}</span>
            </button>
            <button class="btn btn-ghost tf-icon-btn tf-percent-btn" id="resetZoomBtn" title="Reset zoom" type="button" aria-label="Reset zoom">100%</button>
            <button class="btn btn-ghost tf-icon-btn" id="findToggleBtn" title="Search document" type="button" aria-label="Search document">
              <span class="btn-icon">${iconMarkup.search}</span>
            </button>
            <button class="btn btn-ghost tf-icon-btn" id="printBtn" title="Print PDF" type="button" aria-label="Print PDF">
              <span class="btn-icon">${iconMarkup.print}</span>
            </button>
          </div>
        `;
      }

      const homeLink = document.getElementById("homeLink");
      if (homeLink) {
        homeLink.addEventListener("click", (event) => {
          if (window.history.length > 1) {
            event.preventDefault();
            window.history.back();
          }
        });
      }

      if (!sidePanelEl) {
        return;
      }
      const sideInnerEl = sidePanelEl.querySelector(".side-panel-inner");
      if (!sideInnerEl) {
        return;
      }

      const sections = Array.from(sideInnerEl.querySelectorAll(".side-panel-section"));
      const abstractSection = sections.find((section) => /abstract/i.test(section.querySelector("h3")?.textContent || ""));
      const tocSection = sections.find((section) => /content/i.test(section.querySelector("h3")?.textContent || ""));
      const metaListEl = sideInnerEl.querySelector(".meta-list");
      const metaListClone = metaListEl ? metaListEl.cloneNode(true) : null;
      const tocListClone = tocSection && tocSection.querySelector(".toc-list") ? tocSection.querySelector(".toc-list").cloneNode(true) : null;
      const abstractHtml = abstractSection
        ? Array.from(abstractSection.children)
            .filter((child) => {
              const tag = child.tagName.toLowerCase();
              return tag !== "h3" && tag !== "style" && !child.classList.contains("meta-list");
            })
            .map((child) => child.outerHTML)
            .join("")
        : '<p class="tf-empty-copy">Abstract will appear here when available.</p>';

      if (metaListClone) {
        metaListClone.classList.add("reader-meta-list");
        Array.from(metaListClone.querySelectorAll(".meta-item")).forEach((item) => {
          const key = normalizeMetaKey(item.querySelector(".meta-label")?.textContent || "");
          if (key === "title" || key === "authors" || key === "article") {
            item.remove();
            return;
          }
          const labelEl = item.querySelector(".meta-label");
          const valueEl = item.querySelector(".meta-value");
          if (labelEl) {
            labelEl.style.setProperty("color", "#b6c1d4", "important");
            labelEl.style.setProperty("font-style", "normal", "important");
            labelEl.style.setProperty("font-weight", "500", "important");
          }
          if (valueEl) {
            valueEl.style.setProperty("color", "#ffffff", "important");
          }
          Array.from(item.querySelectorAll("a[href]")).forEach((link) => {
            link.style.setProperty("color", "#ffffff", "important");
          });
        });
      }

      sideInnerEl.innerHTML = `
        <div class="tf-sidebar-tabs" role="tablist" aria-label="Sidebar panels">
          <button class="tf-sidebar-tab is-active" type="button" role="tab" aria-selected="true" data-panel="details">DETAILS</button>
          <button class="tf-sidebar-tab" type="button" role="tab" aria-selected="false" data-panel="relations">RELATIONS</button>
        </div>
        <div class="tf-sidebar-panels">
          <section class="tf-sidebar-panel reader-details-panel is-active" data-panel="details" role="tabpanel">
            <div class="tf-sidebar-journal-card">
              <div class="tf-sidebar-cover">
                ${
                  coverUrl
                    ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(journalName)} cover"/>`
                    : '<div class="tf-sidebar-cover-fallback">PDF</div>'
                }
              </div>
              <div class="tf-sidebar-journal-copy">
                <div class="tf-sidebar-journal-name">${escapeHtml(journalName)}</div>
                <div class="tf-sidebar-journal-meta">${escapeHtml(journalMeta)}</div>
              </div>
            </div>

            <div class="tf-sidebar-kicker">ARTICLE</div>
            <h1 class="tf-sidebar-article-title">${escapeHtml(paperTitle)}</h1>
            ${
              articleEntry && articleEntry.href
                ? `<a class="tf-sidebar-link" href="${escapeHtml(articleEntry.href)}" target="_blank" rel="noopener">View article page</a>`
                : doiEntry && doiEntry.href
                  ? `<a class="tf-sidebar-link" href="${escapeHtml(doiEntry.href)}" target="_blank" rel="noopener">Open DOI page</a>`
                  : ""
            }
            ${authorsEntry && authorsEntry.text ? `<div class="tf-sidebar-authors">${escapeHtml(authorsEntry.text)}</div>` : ""}

            ${
              metaListClone && metaListClone.children.length
                ? `<div class="side-panel-section reader-meta-section"><h3>Article details</h3>${metaListClone.outerHTML}</div>`
                : ""
            }

            <div class="side-panel-section reader-abstract-section">
              <h3>Abstract</h3>
              <div class="tf-sidebar-abstract">${abstractHtml}</div>
            </div>
          </section>

          <section class="tf-sidebar-panel reader-relations-panel" data-panel="relations" role="tabpanel" hidden>
            <div class="side-panel-section reader-relations-section">
              <h3>${escapeHtml((tocSection && tocSection.querySelector("h3")?.textContent) || "Content")}</h3>
              ${
                tocListClone && tocListClone.children.length
                  ? tocListClone.outerHTML
                  : '<div class="tf-empty-copy">Section links will appear after the PDF loads.</div>'
              }
            </div>
          </section>
        </div>
      `;

      const existingRail = document.querySelector(".tf-side-rail");
      if (existingRail) {
        existingRail.remove();
      }
      const rail = document.createElement("div");
      rail.className = "tf-side-rail";
      rail.innerHTML = `
        <button class="tf-rail-btn tf-rail-toggle" type="button" data-action="toggle-sidebar" title="Collapse sidebar" aria-label="Collapse sidebar">${iconMarkup.handleOpen}</button>
        <button class="tf-rail-btn is-active" type="button" data-panel="details" title="Show details" aria-label="Show details">${iconMarkup.details}</button>
        <button class="tf-rail-btn" type="button" data-panel="relations" title="Show relations" aria-label="Show relations">${iconMarkup.relations}</button>
        <button class="tf-rail-btn" type="button" data-action="cover" title="Go to first page" aria-label="Go to first page">${iconMarkup.figures}</button>
        ${
          articleEntry && articleEntry.href
            ? `<a class="tf-rail-btn tf-rail-link" href="${escapeHtml(articleEntry.href)}" target="_blank" rel="noopener" title="Open article page" aria-label="Open article page">${iconMarkup.link}</a>`
            : ""
        }
      `;
      bodyEl.appendChild(rail);

      const panelTabs = Array.from(document.querySelectorAll(".tf-sidebar-tab[data-panel]"));
      const panelButtons = Array.from(document.querySelectorAll(".tf-rail-btn[data-panel]"));
      const panels = Array.from(document.querySelectorAll(".tf-sidebar-panel[data-panel]"));

      function activateSidebarPanel(panelName) {
        const nextPanel = panelName === "relations" ? "relations" : "details";
        sidePanelEl.setAttribute("data-active-panel", nextPanel);
        panelTabs.forEach((tab) => {
          const active = tab.dataset.panel === nextPanel;
          tab.classList.toggle("is-active", active);
          tab.setAttribute("aria-selected", String(active));
        });
        panelButtons.forEach((button) => {
          button.classList.toggle("is-active", button.dataset.panel === nextPanel);
        });
        panels.forEach((panel) => {
          const active = panel.dataset.panel === nextPanel;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      }

      panelTabs.forEach((tab) => {
        tab.addEventListener("click", () => activateSidebarPanel(tab.dataset.panel || "details"));
      });
      panelButtons.forEach((button) => {
        button.addEventListener("click", () => {
          activateSidebarPanel(button.dataset.panel || "details");
          bodyEl.classList.add("sidebar-open");
        });
      });
      Array.from(document.querySelectorAll(".tf-rail-btn[data-action='toggle-sidebar']")).forEach((button) => {
        button.addEventListener("click", () => {
          setSidebarOpen(!bodyEl.classList.contains("sidebar-open"));
        });
      });
      Array.from(document.querySelectorAll(".tf-rail-btn[data-action='cover']")).forEach((button) => {
        button.addEventListener("click", () => {
          if (window.viewer && typeof window.viewer.scrollPageIntoView === "function") {
            window.viewer.scrollPageIntoView({ pageNumber: 1 });
          }
        });
      });
      activateSidebarPanel("details");
    }

    const seedPdfCandidates = dedupeUrlList([
      window.__PAPER_PDF_URL__,
      ...(Array.isArray(window.__PAPER_PDF_CANDIDATES__) ? window.__PAPER_PDF_CANDIDATES__ : [])
    ]);
    if (seedPdfCandidates.length === 0) {
      throw new Error("Missing __PAPER_PDF_URL__ (or __PAPER_PDF_CANDIDATES__) for paper reader.");
    }
    let pdfCandidates = seedPdfCandidates.slice();
    let activePdfUrl = pdfCandidates[0];

    buildReaderChrome();
    downloadLink = document.getElementById("downloadLink");
    themeToggleBtn = document.getElementById("themeToggleBtn");
    themeLabel = document.getElementById("themeLabel");
    if (downloadLink) {
      downloadLink.href = activePdfUrl;
    }

    function readStoredTheme() {
      try {
        const saved = localStorage.getItem("homepage-theme");
        if (saved === "dark" || saved === "light") {
          return saved;
        }
      } catch (error) {
        /* ignore */
      }
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    function applyTheme(theme) {
      const normalized = theme === "dark" ? "dark" : "light";
      rootEl.setAttribute("data-theme", normalized);
      if (themeToggleBtn && themeLabel) {
        themeToggleBtn.setAttribute("aria-pressed", String(normalized === "dark"));
        themeToggleBtn.title = normalized === "dark" ? "切换到浅色模式" : "切换到深色模式";
        themeLabel.textContent = normalized === "dark" ? "日间" : "夜间";
      }
      try {
        localStorage.setItem("homepage-theme", normalized);
      } catch (error) {
        /* ignore */
      }
    }

    applyTheme(readStoredTheme());
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        applyTheme(rootEl.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    }

    let findBarEl = document.getElementById("findBar");
    if (!findBarEl && topbarEl) {
      findBarEl = document.createElement("div");
      findBarEl.id = "findBar";
      findBarEl.className = "find-bar";
      findBarEl.innerHTML = `
        <input class="find-input" id="findInput" type="search" placeholder="Search document text..." aria-label="Search document text"/>
        <button class="btn btn-ghost" id="findPrevBtn" type="button" title="Previous match (Shift+Enter)">Previous</button>
        <button class="btn btn-ghost" id="findNextBtn" type="button" title="Next match (Enter)">Next</button>
        <label class="find-check"><input id="findCase" type="checkbox"/>Match case</label>
        <label class="find-check"><input id="findHighlightAll" type="checkbox" checked/>Highlight all</label>
        <span class="find-status" id="findStatus">0 / 0</span>
        <button class="btn btn-ghost" id="findCloseBtn" type="button">Close</button>
      `;
      topbarEl.insertAdjacentElement("afterend", findBarEl);
    }

    const overlay = document.getElementById("loadingOverlay");
    const percentEl = document.getElementById("loadingPercent");
    const barFillEl = document.getElementById("loadingBarFill");
    const zoomIndicator = document.getElementById("zoomIndicator");
    const viewerContainer = document.getElementById("viewerContainer");

    if (overlay) {
      const loadingLabel = overlay.querySelector(".loading-text span");
      if (loadingLabel) {
        loadingLabel.innerHTML = '<span class="spinner"></span> Loading PDF';
      }
    }

    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const pageNumberInput = document.getElementById("pageNumberInput");
    const totalPagesEl = document.getElementById("totalPages");
    const zoomOutBtn = document.getElementById("zoomOutBtn");
    const zoomInBtn = document.getElementById("zoomInBtn");
    const fitWidthBtn = document.getElementById("fitWidthBtn");
    const fitPageBtn = document.getElementById("fitPageBtn");
    const resetZoomBtn = document.getElementById("resetZoomBtn");
    const findToggleBtn = document.getElementById("findToggleBtn");
    const printBtn = document.getElementById("printBtn");
    const fullscreenBtn = document.getElementById("fullscreenBtn");

    const findInput = document.getElementById("findInput");
    const findPrevBtn = document.getElementById("findPrevBtn");
    const findNextBtn = document.getElementById("findNextBtn");
    const findCase = document.getElementById("findCase");
    const findHighlightAll = document.getElementById("findHighlightAll");
    const findCloseBtn = document.getElementById("findCloseBtn");
    const findStatus = document.getElementById("findStatus");

    const primaryTocList = document.querySelector(".side-panel .toc-list");
    let staticTocButtons = primaryTocList ? Array.from(primaryTocList.querySelectorAll(".toc-link")) : [];
    const tocSectionTitleEl = primaryTocList
      ? primaryTocList.closest(".side-panel-section")?.querySelector("h3")
      : null;
    const tocSectionTitle = (tocSectionTitleEl ? tocSectionTitleEl.textContent : "").trim();
    let prefersAutoToc = Boolean(window.__PAPER_AUTO_TOC__) || /^content$/i.test(tocSectionTitle);

    function refreshStaticTocButtons() {
      staticTocButtons = primaryTocList ? Array.from(primaryTocList.querySelectorAll(".toc-link")) : [];
      staticTocButtons.forEach((btn) => {
        if (!btn.dataset.titleRaw) {
          btn.dataset.titleRaw = stripPageSuffix(btn.textContent || "");
        }
        bindTocButton(btn);
      });
      syncTocState();
    }

    function getTocEntries() {
      return staticTocButtons
        .map((button) => ({
          button,
          pageNumber: Number.parseInt(button.dataset.page || "", 10)
        }))
        .filter((entry) => Number.isFinite(entry.pageNumber) && entry.pageNumber > 0)
        .sort((a, b) => a.pageNumber - b.pageNumber);
    }

    function setTocProgress(currentPage, totalPages) {
      if (!primaryTocList) {
        return;
      }
      const safeCurrent = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
      const safeTotal =
        Number.isFinite(totalPages) && totalPages > 0 ? totalPages : Number.isFinite(safeCurrent) ? safeCurrent : 1;
      const progress = safeTotal > 1 ? (safeCurrent - 1) / (safeTotal - 1) : 0;
      const bounded = Math.max(0, Math.min(1, progress));
      primaryTocList.style.setProperty("--toc-progress", String(bounded));
    }

    function setActiveTocByPage(currentPage) {
      const entries = getTocEntries();
      staticTocButtons.forEach((button) => {
        button.classList.remove("is-active", "is-past");
      });
      if (entries.length === 0) {
        return;
      }

      const safeCurrent = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : entries[0].pageNumber;
      let activeEntry = entries[0];
      for (const entry of entries) {
        if (entry.pageNumber <= safeCurrent) {
          activeEntry = entry;
        } else {
          break;
        }
      }

      entries.forEach((entry) => {
        if (entry.pageNumber < activeEntry.pageNumber) {
          entry.button.classList.add("is-past");
        }
      });
      activeEntry.button.classList.add("is-active");
    }

    function syncTocState(pageNumber, totalPages) {
      const fallbackPage =
        window.viewer && Number.isFinite(window.viewer.currentPageNumber)
          ? Number(window.viewer.currentPageNumber)
          : 1;
      const current = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : fallbackPage;
      const total =
        Number.isFinite(totalPages) && totalPages > 0
          ? totalPages
          : pdfDocument && Number.isFinite(pdfDocument.numPages)
            ? pdfDocument.numPages
            : 1;
      setTocProgress(current, total);
      setActiveTocByPage(current);
    }

    function derivePaperId() {
      if (window.__PAPER_ID__) {
        return String(window.__PAPER_ID__).trim();
      }
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return parts[parts.length - 2];
      }
      return "";
    }

    function normalizePath(path) {
      const value = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
      return value.startsWith("homepage/") ? value.slice("homepage/".length) : value;
    }

    async function loadPaperConfig() {
      const paperId = derivePaperId();
      if (!paperId) {
        return null;
      }
      const configUrl = window.__PAPER_CONFIG_URL__ || "../../../data/paper-pages.json";
      try {
        const response = await fetch(new URL(configUrl, window.location.href).toString(), {
          cache: "no-cache"
        });
        if (!response.ok) {
          return null;
        }
        const payload = await response.json();
        const entries = Array.isArray(payload) ? payload : Array.isArray(payload.papers) ? payload.papers : [];
        if (entries.length === 0) {
          return null;
        }
        const currentPath = normalizePath(window.location.pathname);
        return (
          entries.find((entry) => String(entry.id || "").trim() === paperId) ||
          entries.find((entry) => currentPath.endsWith(normalizePath(entry.path || ""))) ||
          null
        );
      } catch (error) {
        return null;
      }
    }

    async function loadGeneratedTocEntry() {
      const paperId = derivePaperId();
      if (!paperId) {
        return null;
      }
      const tocUrl = window.__PAPER_TOC_URL__ || "../../../data/paper-toc.generated.json";
      try {
        const response = await fetch(new URL(tocUrl, window.location.href).toString(), {
          cache: "no-cache"
        });
        if (!response.ok) {
          return null;
        }
        const payload = await response.json();
        const entries = Array.isArray(payload) ? payload : Array.isArray(payload.papers) ? payload.papers : [];
        if (entries.length === 0) {
          return null;
        }
        const currentPath = normalizePath(window.location.pathname);
        return (
          entries.find((entry) => String(entry.id || "").trim() === paperId) ||
          entries.find((entry) => currentPath.endsWith(normalizePath(entry.path || ""))) ||
          null
        );
      } catch (error) {
        return null;
      }
    }

    function buildPdfCandidates(config) {
      const configCandidates = [];
      if (config && typeof config === "object") {
        if (Array.isArray(config.pdf_candidates)) {
          configCandidates.push(...config.pdf_candidates);
        }
        if (config.pdf_url) {
          configCandidates.push(config.pdf_url);
        }
      }
      return dedupeUrlList([...seedPdfCandidates, ...configCandidates]);
    }

    const paperConfigPromise = loadPaperConfig();
    const generatedTocPromise = loadGeneratedTocEntry();

    let pdfDocument = null;
    let pageTextCache = null;
    let prebuiltTocApplied = false;
    let suppressScaleIndicator = true;

    function showOverlay() {
      if (overlay) {
        overlay.classList.remove("hidden");
      }
    }

    function hideOverlay() {
      if (overlay) {
        overlay.classList.add("hidden");
      }
    }

    function showZoomIndicator(text) {
      if (!zoomIndicator) {
        return;
      }
      if (text) {
        zoomIndicator.textContent = text;
      }
      zoomIndicator.classList.add("show");
      window.clearTimeout(showZoomIndicator.timerId);
      showZoomIndicator.timerId = window.setTimeout(() => {
        zoomIndicator.classList.remove("show");
      }, 850);
    }
    showZoomIndicator.timerId = 0;

    function setFindStatus(current, total) {
      if (!findStatus) {
        return;
      }
      const safeCurrent = Number.isFinite(current) ? current : 0;
      const safeTotal = Number.isFinite(total) ? total : 0;
      findStatus.textContent = `${safeCurrent} / ${safeTotal}`;
    }

    function setFindOpen(opened) {
      bodyEl.classList.toggle("find-open", opened);
      if (opened && findInput) {
        findInput.focus();
        findInput.select();
      }
    }

    function setSidebarOpen(opened) {
      bodyEl.classList.toggle("sidebar-open", opened);
      if (sideHandle) {
        sideHandle.innerHTML = opened ? iconMarkup.handleOpen : iconMarkup.handleClosed;
        sideHandle.setAttribute("aria-label", opened ? "Collapse sidebar" : "Expand sidebar");
        sideHandle.setAttribute("aria-expanded", String(opened));
      }
      Array.from(document.querySelectorAll(".tf-rail-toggle")).forEach((button) => {
        button.innerHTML = opened ? iconMarkup.handleOpen : iconMarkup.handleClosed;
        button.title = opened ? "Collapse sidebar" : "Expand sidebar";
        button.setAttribute("aria-label", opened ? "Collapse sidebar" : "Expand sidebar");
        button.setAttribute("aria-pressed", String(opened));
      });
    }

    setSidebarOpen(bodyEl.classList.contains("sidebar-open"));

    if (sideHandle) {
      sideHandle.addEventListener("click", () => {
        setSidebarOpen(!bodyEl.classList.contains("sidebar-open"));
      });
    }

    if (findToggleBtn) {
      findToggleBtn.addEventListener("click", () => {
        setFindOpen(!bodyEl.classList.contains("find-open"));
      });
    }
    if (findCloseBtn) {
      findCloseBtn.addEventListener("click", () => setFindOpen(false));
    }

    function normalizeForMatch(input) {
      return String(input || "")
        .toLowerCase()
        .replace(/[\u3000\s]+/g, "")
        .replace(/[“”"'`~!@#$%^&*()_+\-=\[\]{};:,.<>/?\\|，。；：、？！《》【】（）]/g, "");
    }

    function stripHeadingPrefix(text) {
      return String(text || "")
        .replace(/^[第]?[一二三四五六七八九十百零0-9]+[章节部分篇节]?[、.．:：)）]\s*/u, "")
        .replace(/^[0-9]+(\.[0-9]+)*\s*/u, "")
        .trim();
    }

    function stripPageSuffix(text) {
      return String(text || "")
        .replace(/\s*[（(]第\s*\d+\s*页[）)]\s*$/u, "")
        .replace(/\s*\(p\.?\s*\d+\)\s*$/iu, "")
        .trim();
    }

    function hasHeadingPrefix(text) {
      const value = String(text || "").trim();
      return (
        /^[第]?[一二三四五六七八九十百零0-9]+[章节部分篇节]?[、.．:：)）]/u.test(value) ||
        /^[0-9]+(\.[0-9]+)*/u.test(value)
      );
    }

    function toChineseNumber(num) {
      const n = Number.parseInt(num, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return "";
      }
      const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
      if (n <= 10) {
        return n === 10 ? "十" : chars[n];
      }
      if (n < 20) {
        return `十${chars[n - 10]}`;
      }
      if (n < 100) {
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return `${chars[tens]}十${ones ? chars[ones] : ""}`;
      }
      return String(n);
    }

    function isUsableKey(key) {
      if (!key) {
        return false;
      }
      if (/[\u4e00-\u9fff]/u.test(key)) {
        return key.length >= 2;
      }
      if (/[a-z]/i.test(key)) {
        return key.length >= 4;
      }
      return key.length >= 2;
    }

    function buildMatchKeys(rawTitle, orderIndex) {
      const cleanedRaw = stripPageSuffix(rawTitle);
      const stripped = stripHeadingPrefix(cleanedRaw);
      const normalizedRaw = normalizeForMatch(cleanedRaw);
      const normalizedStripped = normalizeForMatch(stripped);
      const sectionNum = orderIndex + 1;
      const numberedArabic = normalizeForMatch(`${sectionNum}.${stripped}`);
      const numberedChinese = normalizeForMatch(`${toChineseNumber(sectionNum)}、${stripped}`);

      const keys = [];
      const push = (value) => {
        if (isUsableKey(value) && !keys.includes(value)) {
          keys.push(value);
        }
      };

      if (hasHeadingPrefix(cleanedRaw)) {
        push(normalizedRaw);
        push(normalizedStripped);
      } else {
        push(numberedArabic);
        push(numberedChinese);
        push(normalizedRaw);
        push(normalizedStripped);
      }
      return keys;
    }

    function findPageByKey(pageTexts, key, fromPage = 1) {
      if (!Array.isArray(pageTexts) || pageTexts.length === 0 || !key) {
        return null;
      }
      for (let p = fromPage; p <= pageTexts.length; p += 1) {
        if (pageTexts[p - 1].includes(key)) {
          return p;
        }
      }
      for (let p = 1; p < fromPage; p += 1) {
        if (pageTexts[p - 1].includes(key)) {
          return p;
        }
      }
      return null;
    }

    function bindTocButton(button) {
      if (!button || button.dataset.bound === "1") {
        return;
      }
      button.dataset.bound = "1";
      button.addEventListener("click", () => {
        const pageNumber = Number.parseInt(button.dataset.page || "", 10);
        if (Number.isFinite(pageNumber) && pageNumber > 0) {
          syncTocState(pageNumber);
          if (window.viewer && typeof window.viewer.scrollPageIntoView === "function") {
            window.viewer.scrollPageIntoView({ pageNumber });
          }
        }
      });
    }

    refreshStaticTocButtons();

    function normalizeHeadingDisplay(text) {
      let value = String(text || "").replace(/\s+/g, " ").trim();
      if (/[\u4e00-\u9fff]/u.test(value)) {
        value = value.replace(/\s+/g, "");
      }
      value = value.replace(/^[\-–—·•●\s]+/u, "").replace(/\s*[.:：。；;]+$/u, "").trim();
      return value;
    }

    function extractPageLines(items) {
      const rows = [];
      const threshold = 2.2;
      for (const item of items || []) {
        const text = String(item && item.str ? item.str : "").trim();
        if (!text) {
          continue;
        }
        const transform = Array.isArray(item.transform) ? item.transform : [];
        const x = Number(transform[4]) || 0;
        const y = Number(transform[5]) || 0;
        const width = Number(item.width) || 0;

        let targetRow = null;
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (Math.abs(rows[i].y - y) <= threshold) {
            targetRow = rows[i];
            break;
          }
        }
        if (!targetRow) {
          targetRow = { y, parts: [] };
          rows.push(targetRow);
        }
        targetRow.parts.push({ x, width, text });
      }

      rows.sort((a, b) => b.y - a.y);
      return rows
        .map((row) => {
          row.parts.sort((a, b) => a.x - b.x);
          let merged = "";
          let prev = null;
          for (const part of row.parts) {
            if (prev) {
              const prevEnd = prev.x + prev.width;
              const gap = part.x - prevEnd;
              const needSpace =
                gap > 3 &&
                /[A-Za-z0-9]$/.test(prev.text) &&
                /^[A-Za-z0-9(]/.test(part.text);
              if (needSpace) {
                merged += " ";
              }
            }
            merged += part.text;
            prev = part;
          }
          return normalizeHeadingDisplay(merged);
        })
        .filter(Boolean);
    }

    function isNumberedHeading(text) {
      const value = String(text || "").trim();
      if (!value || value.length > 90) {
        return false;
      }
      return (
        /^[一二三四五六七八九十百零]{1,3}[、.．:：)]/u.test(value) ||
        /^第[一二三四五六七八九十百零0-9]+[章节部分篇][、.．:：)]?/u.test(value) ||
        /^\d+(\.\d+){0,2}[.)]?\s+[A-Z][A-Za-z\s\-&/]{1,80}$/u.test(value)
      );
    }

    function isKeywordHeading(text) {
      const value = String(text || "").trim();
      if (!value || value.length > 90) {
        return false;
      }
      const compact = normalizeForMatch(value);
      if (
        /^(doi|www|http|journal|vol|收稿|基金|作者简介|关键词|key\s*words|copyright)/iu.test(
          compact
        )
      ) {
        return false;
      }
      return (
        /^(introduction|model|method|methods|methodology|estimationmethod|estimationandalgorithms|asymptotictheory|simulationstudy|simulation|realworlddata|realdata|realdataanalysis|discussion|conclusion|conclusions|proofsoftheorems|appendix|appendices|references)$/i.test(
          compact
        ) ||
        /^(引言|研究方法|方法|模型|理论基础|理论方法|模拟研究|实证分析|结论|结论与展望|参考文献)$/u.test(
          value
        )
      );
    }

    function isPrimaryHeading(title) {
      const value = String(title || "").trim();
      return (
        /^[一二三四五六七八九十百零]{1,3}[、.．:：)]/u.test(value) ||
        /^第[一二三四五六七八九十百零0-9]+[章节部分篇]/u.test(value) ||
        /^\d+[.)]?\s+[A-Z]/u.test(value) ||
        isKeywordHeading(value)
      );
    }

    function inferHeadingDepth(title) {
      const value = String(title || "").trim();
      const match = value.match(/^(\d+(\.\d+){0,2})/);
      if (!match) {
        return 0;
      }
      const dotCount = (match[1].match(/\./g) || []).length;
      return Math.min(dotCount, 3);
    }

    function isLikelyGarbledTitle(title) {
      const value = String(title || "").trim();
      if (!value) {
        return true;
      }
      if (/[�￾￿□■▢�]/u.test(value)) {
        return true;
      }
      if (/[\u0000-\u001f]/u.test(value)) {
        return true;
      }
      if (!/[A-Za-z\u4e00-\u9fff0-9]/u.test(value)) {
        return true;
      }
      return value.length > 110;
    }

    function validateTocItems(items, minCount = 3) {
      if (!Array.isArray(items)) {
        return { ok: false, items: [] };
      }
      const deduped = [];
      const seen = new Set();
      let lastPage = 1;

      for (const item of items) {
        const title = normalizeHeadingDisplay(stripPageSuffix(item && item.title ? item.title : ""));
        const pageNumber = Number.parseInt(item && item.pageNumber ? item.pageNumber : "", 10);
        if (!title || isLikelyGarbledTitle(title)) {
          continue;
        }
        if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
          continue;
        }
        const key = `${normalizeForMatch(stripHeadingPrefix(title) || title)}@${pageNumber}`;
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        deduped.push({
          title,
          pageNumber,
          depth: Number.isFinite(item && item.depth) ? item.depth : inferHeadingDepth(title)
        });
      }

      if (deduped.length < minCount) {
        return { ok: false, items: deduped };
      }

      // Ensure TOC pages do not jump backwards too aggressively.
      let monotonicPenalty = 0;
      for (const item of deduped) {
        if (item.pageNumber + 1 < lastPage) {
          monotonicPenalty += 1;
        }
        lastPage = Math.max(lastPage, item.pageNumber);
      }
      if (monotonicPenalty > Math.floor(deduped.length / 3)) {
        return { ok: false, items: deduped };
      }

      return { ok: true, items: deduped };
    }

    function isSuspiciousTocMapping(buttons) {
      if (!Array.isArray(buttons) || buttons.length < 4) {
        return false;
      }
      const pages = buttons
        .map((btn) => Number.parseInt(btn.dataset.page || "", 10))
        .filter((page) => Number.isFinite(page) && page > 0);
      if (pages.length < 4) {
        return false;
      }
      const uniquePages = new Set(pages);
      if (uniquePages.size <= 2) {
        return true;
      }
      const min = Math.min(...pages);
      const max = Math.max(...pages);
      return max - min <= 1;
    }

    function renderPrimaryTocItems(items) {
      if (!primaryTocList || !Array.isArray(items) || items.length === 0) {
        return false;
      }
      primaryTocList.innerHTML = "";
      for (const item of items) {
        const title = stripPageSuffix(item.title || "未命名");
        const pageNumber = Number.parseInt(item.pageNumber || "", 10);
        if (!title || !Number.isFinite(pageNumber) || pageNumber <= 0) {
          continue;
        }
        const li = document.createElement("li");
        if (Number.isFinite(item.depth) && item.depth > 0) {
          li.className = `outline-depth-${Math.min(item.depth, 3)}`;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "toc-link";
        btn.dataset.page = String(pageNumber);
        btn.dataset.titleRaw = title;
        btn.textContent = title;
        const isChinese = /[\u4e00-\u9fff]/u.test(title);
        btn.title = isChinese ? `跳转到第${pageNumber}页` : `Go to page ${pageNumber}`;
        bindTocButton(btn);
        li.appendChild(btn);
        primaryTocList.appendChild(li);
      }
      refreshStaticTocButtons();
      return primaryTocList.children.length > 0;
    }

    function applyPaperConfigToSidebar(config) {
      if (!config || typeof config !== "object") {
        return;
      }
      if (typeof config.auto_toc === "boolean") {
        prefersAutoToc = config.auto_toc;
      }
      if (tocSectionTitleEl && config.toc_heading) {
        tocSectionTitleEl.textContent = String(config.toc_heading);
      }
      if (Array.isArray(config.toc) && config.toc.length > 0) {
        const normalized = config.toc.map((item) => ({
          title: item && item.title ? String(item.title) : "",
          pageNumber: item && item.page ? Number(item.page) : Number(item && item.pageNumber),
          depth: Number.isFinite(item && item.depth) ? item.depth : 0
        }));
        const checked = validateTocItems(normalized, 1);
        if (checked.items.length > 0) {
          renderPrimaryTocItems(checked.items);
        }
      }
    }

    function applyGeneratedTocToSidebar(entry) {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      if (tocSectionTitleEl && entry.toc_heading) {
        tocSectionTitleEl.textContent = String(entry.toc_heading);
      }
      const rawItems = Array.isArray(entry.items) ? entry.items : Array.isArray(entry.toc) ? entry.toc : [];
      if (rawItems.length === 0) {
        return false;
      }
      const normalized = rawItems.map((item) => ({
        title: item && item.title ? String(item.title) : "",
        pageNumber: item && item.page ? Number(item.page) : Number(item && item.pageNumber),
        depth: Number.isFinite(item && item.depth) ? item.depth : 0
      }));
      const checked = validateTocItems(normalized, 1);
      if (checked.items.length === 0) {
        return false;
      }
      return renderPrimaryTocItems(checked.items);
    }

    function readDeepLinkState() {
      const url = new URL(window.location.href);
      const rawPage = Number.parseInt(url.searchParams.get("page") || "", 10);
      const rawSec = url.searchParams.get("sec") || "";
      const hashSec = url.hash && url.hash.startsWith("#sec-") ? decodeURIComponent(url.hash.slice(5)) : "";
      return {
        page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : null,
        sec: (rawSec || hashSec || "").trim()
      };
    }

    function findSectionTargetPage(sectionText) {
      if (!sectionText || staticTocButtons.length === 0) {
        return null;
      }
      const sectionKey = normalizeForMatch(stripHeadingPrefix(sectionText) || sectionText);
      if (!sectionKey) {
        return null;
      }
      for (const btn of staticTocButtons) {
        const rawTitle = stripPageSuffix(btn.dataset.titleRaw || btn.textContent || "");
        const titleKey = normalizeForMatch(stripHeadingPrefix(rawTitle) || rawTitle);
        if (!titleKey) {
          continue;
        }
        if (titleKey === sectionKey || titleKey.includes(sectionKey) || sectionKey.includes(titleKey)) {
          const pageNumber = Number.parseInt(btn.dataset.page || "", 10);
          if (Number.isFinite(pageNumber) && pageNumber > 0) {
            return pageNumber;
          }
        }
      }
      return null;
    }

    function syncPageQuery(pageNumber) {
      if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set("page", String(pageNumber));
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

    async function applyInitialDeepLink() {
      const state = readDeepLinkState();
      const sectionPage = findSectionTargetPage(state.sec);
      const targetPage = sectionPage || state.page;
      if (!Number.isFinite(targetPage) || targetPage <= 0) {
        return;
      }
      const total = pdfDocument ? pdfDocument.numPages : 0;
      const safeTarget = total > 0 ? Math.max(1, Math.min(total, targetPage)) : targetPage;
      window.viewer.scrollPageIntoView({ pageNumber: safeTarget });
      syncPageQuery(safeTarget);
    }

    async function buildPageTextCache() {
      if (pageTextCache || !pdfDocument) {
        return pageTextCache || { fullTexts: [], headTexts: [], pageLines: [] };
      }
      const fullTexts = [];
      const headTexts = [];
      const pageLines = [];

      for (let p = 1; p <= pdfDocument.numPages; p += 1) {
        try {
          const page = await pdfDocument.getPage(p);
          const textContent = await page.getTextContent();
          const items = Array.isArray(textContent.items) ? textContent.items : [];
          const text = items.map((item) => item.str || "").join(" ");
          const normalized = normalizeForMatch(text);
          fullTexts.push(normalized);
          headTexts.push(normalized.slice(0, 2200));
          pageLines.push(extractPageLines(items));
        } catch (error) {
          fullTexts.push("");
          headTexts.push("");
          pageLines.push([]);
        }
      }
      pageTextCache = { fullTexts, headTexts, pageLines };
      return pageTextCache;
    }

    async function mapStaticTocToRealPages() {
      if (!pdfDocument || staticTocButtons.length === 0) {
        return;
      }

      const { fullTexts, headTexts } = await buildPageTextCache();
      if (fullTexts.length === 0) {
        return;
      }

      let cursorPage = 1;
      staticTocButtons.forEach((btn, index) => {
        const rawTitle = stripPageSuffix(btn.dataset.titleRaw || btn.textContent || "");
        const keys = buildMatchKeys(rawTitle, index);

        let foundPage = null;
        for (const key of keys) {
          foundPage = findPageByKey(headTexts, key, cursorPage);
          if (foundPage) {
            break;
          }
        }
        if (!foundPage) {
          for (const key of keys) {
            foundPage = findPageByKey(fullTexts, key, cursorPage);
            if (foundPage) {
              break;
            }
          }
        }

        if (!foundPage) {
          const fallback = Number.parseInt(btn.dataset.page || "", 10);
          if (Number.isFinite(fallback) && fallback >= 1 && fallback <= fullTexts.length) {
            foundPage = fallback;
          } else {
            foundPage = cursorPage;
          }
        }

        btn.dataset.page = String(foundPage);
        cursorPage = Math.max(cursorPage, foundPage);

        const isChinese = /[\u4e00-\u9fff]/u.test(rawTitle);
        btn.textContent = rawTitle;
        btn.title = isChinese ? `跳转到第${foundPage}页` : `Go to page ${foundPage}`;
      });
    }

    async function resolveDestinationToPage(dest) {
      if (!dest || !pdfDocument) {
        return null;
      }
      let resolved = dest;
      if (typeof resolved === "string") {
        resolved = await pdfDocument.getDestination(resolved);
      }
      if (!Array.isArray(resolved) || !resolved[0]) {
        return null;
      }
      try {
        const pageIndex = await pdfDocument.getPageIndex(resolved[0]);
        return pageIndex + 1;
      } catch (error) {
        return null;
      }
    }

    async function extractOutlineItems() {
      if (!pdfDocument) {
        return [];
      }

      let outline = null;
      try {
        outline = await pdfDocument.getOutline();
      } catch (error) {
        outline = null;
      }
      if (!outline || outline.length === 0) {
        return [];
      }

      const collected = [];
      let count = 0;
      const maxItems = 120;

      async function walk(items, depth = 0) {
        for (const item of items) {
          if (count >= maxItems) {
            return;
          }
          const pageNumber = await resolveDestinationToPage(item.dest);
          if (pageNumber) {
            const title = normalizeHeadingDisplay(stripPageSuffix(item.title || "未命名"));
            if (title) {
              collected.push({
                title,
                pageNumber,
                depth: Math.min(depth, 3)
              });
              count += 1;
            }
          }
          if (Array.isArray(item.items) && item.items.length > 0) {
            await walk(item.items, depth + 1);
          }
        }
      }

      await walk(outline, 0);

      const unique = [];
      const seen = new Set();
      for (const item of collected) {
        const key = `${normalizeForMatch(item.title)}@${item.pageNumber}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        unique.push(item);
      }
      return unique;
    }

    async function extractHeuristicTocItems() {
      if (!pdfDocument) {
        return [];
      }
      const { pageLines } = await buildPageTextCache();
      if (!Array.isArray(pageLines) || pageLines.length === 0) {
        return [];
      }

      const items = [];
      const seen = new Set();
      for (let pageIndex = 0; pageIndex < pageLines.length; pageIndex += 1) {
        for (const rawLine of pageLines[pageIndex]) {
          const title = normalizeHeadingDisplay(rawLine);
          if (!title || title.length < 2 || title.length > 90) {
            continue;
          }
          if (!isNumberedHeading(title) && !isKeywordHeading(title)) {
            continue;
          }
          const key = normalizeForMatch(stripHeadingPrefix(title) || title);
          if (!key || key.length < 2 || seen.has(key)) {
            continue;
          }
          seen.add(key);
          items.push({
            title,
            pageNumber: pageIndex + 1,
            depth: inferHeadingDepth(title)
          });
        }
      }

      const primaryItems = items.filter((item) => isPrimaryHeading(item.title));
      const filtered = primaryItems.length >= 4 ? primaryItems : items;
      return filtered.slice(0, 32);
    }

    const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.mjs");
    const viewerModule = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/web/pdf_viewer.mjs");
    const { EventBus, PDFLinkService, PDFFindController, PDFViewer } = viewerModule;

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.mjs";

    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const findController = new PDFFindController({ eventBus, linkService });
    const viewer = new PDFViewer({
      container: viewerContainer,
      eventBus,
      linkService,
      findController,
      textLayerMode: 1,
      annotationMode: 2
    });

    linkService.setViewer(viewer);
    window.viewer = viewer;

    function updatePageControls() {
      if (!pdfDocument) {
        return;
      }
      const current = viewer.currentPageNumber;
      const total = pdfDocument.numPages;
      if (pageNumberInput) {
        pageNumberInput.value = String(current);
        pageNumberInput.max = String(total);
        const pageDigits = Math.max(String(current).length, String(total).length, 2);
        pageNumberInput.style.width = `${pageDigits + 1.35}ch`;
      }
      if (totalPagesEl) {
        totalPagesEl.textContent = String(total);
      }
      if (prevPageBtn) {
        prevPageBtn.disabled = current <= 1;
      }
      if (nextPageBtn) {
        nextPageBtn.disabled = current >= total;
      }
      if (topbarEl) {
        const safeProgress = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
        topbarEl.style.setProperty("--reader-progress", String(safeProgress));
      }
      syncTocState(current, total);
    }

    function setScale(scaleValue) {
      viewer.currentScaleValue = scaleValue;
      const percent = Math.round(viewer.currentScale * 100);
      showZoomIndicator(`${percent}%`);
    }

    function runFind(findPrevious = false, forceNewSearch = false) {
      if (!findInput) {
        return;
      }
      const query = findInput.value.trim();
      if (!query) {
        setFindStatus(0, 0);
        return;
      }
      findController.executeCommand(forceNewSearch ? "find" : "findagain", {
        query,
        phraseSearch: true,
        caseSensitive: Boolean(findCase && findCase.checked),
        highlightAll: Boolean(findHighlightAll && findHighlightAll.checked),
        findPrevious,
        matchDiacritics: false
      });
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => {
        if (viewer.currentPageNumber > 1) {
          viewer.currentPageNumber -= 1;
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => {
        if (pdfDocument && viewer.currentPageNumber < pdfDocument.numPages) {
          viewer.currentPageNumber += 1;
        }
      });
    }

    if (pageNumberInput) {
      const jumpToPage = () => {
        if (!pdfDocument) {
          return;
        }
        const raw = Number(pageNumberInput.value);
        if (!Number.isFinite(raw)) {
          updatePageControls();
          return;
        }
        const target = Math.max(1, Math.min(pdfDocument.numPages, Math.trunc(raw)));
        viewer.currentPageNumber = target;
        pageNumberInput.value = String(target);
      };
      pageNumberInput.addEventListener("change", jumpToPage);
      pageNumberInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          jumpToPage();
        }
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        setScale(Math.min(viewer.currentScale * 1.1, 4.0));
      });
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        setScale(Math.max(viewer.currentScale / 1.1, 0.25));
      });
    }
    if (fitWidthBtn) {
      fitWidthBtn.addEventListener("click", () => setScale("page-width"));
    }
    if (fitPageBtn) {
      fitPageBtn.addEventListener("click", () => setScale("page-fit"));
    }
    if (resetZoomBtn) {
      resetZoomBtn.addEventListener("click", () => setScale(1.0));
    }

    if (findInput) {
      findInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runFind(event.shiftKey, true);
        }
      });
      findInput.addEventListener("input", () => {
        if (!findInput.value.trim()) {
          setFindStatus(0, 0);
        }
      });
    }
    if (findNextBtn) {
      findNextBtn.addEventListener("click", () => runFind(false, true));
    }
    if (findPrevBtn) {
      findPrevBtn.addEventListener("click", () => runFind(true, true));
    }
    if (findCase) {
      findCase.addEventListener("change", () => runFind(false, true));
    }
    if (findHighlightAll) {
      findHighlightAll.addEventListener("change", () => runFind(false, true));
    }

    if (printBtn) {
      printBtn.addEventListener("click", () => {
        const printWindow = window.open(activePdfUrl, "_blank", "noopener");
        if (!printWindow) {
          return;
        }
        const triggerPrint = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (error) {
            console.error("Print failed:", error);
          }
        };
        printWindow.addEventListener("load", () => setTimeout(triggerPrint, 300), { once: true });
      });
    }

    function updateFullscreenState() {
      if (!fullscreenBtn) {
        return;
      }
      const isFullscreen = Boolean(document.fullscreenElement);
      fullscreenBtn.innerHTML = `<span class="btn-icon">${isFullscreen ? iconMarkup.fullscreenExit : iconMarkup.fullscreenEnter}</span>`;
      fullscreenBtn.title = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
      fullscreenBtn.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", async () => {
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          } else {
            await document.exitFullscreen();
          }
        } catch (error) {
          console.error("Fullscreen failed:", error);
        }
      });
    }
    document.addEventListener("fullscreenchange", updateFullscreenState);
    updateFullscreenState();

    eventBus.on("pagechanging", ({ pageNumber }) => {
      updatePageControls();
      if (Number.isFinite(pageNumber) && pageNumber > 0) {
        syncPageQuery(pageNumber);
        syncTocState(pageNumber, pdfDocument ? pdfDocument.numPages : null);
      }
    });
    eventBus.on("scalechanging", ({ scale }) => {
      if (!suppressScaleIndicator && typeof scale === "number") {
        showZoomIndicator(`${Math.round(scale * 100)}%`);
      }
    });
    eventBus.on("updatefindmatchescount", ({ matchesCount }) => {
      if (!matchesCount) {
        setFindStatus(0, 0);
        return;
      }
      setFindStatus(matchesCount.current || 0, matchesCount.total || 0);
    });

    showOverlay();

    const [paperConfig, generatedTocEntry] = await Promise.all([paperConfigPromise, generatedTocPromise]);
    applyPaperConfigToSidebar(paperConfig);
    prebuiltTocApplied = applyGeneratedTocToSidebar(generatedTocEntry) || prebuiltTocApplied;
    pdfCandidates = buildPdfCandidates(paperConfig);
    activePdfUrl = pdfCandidates[0];
    if (downloadLink) {
      downloadLink.href = activePdfUrl;
    }

    let lastLoadError = null;
    for (const candidateUrl of pdfCandidates) {
      activePdfUrl = candidateUrl;
      if (downloadLink) {
        downloadLink.href = activePdfUrl;
      }
      const loadingTask = pdfjsLib.getDocument({
        url: candidateUrl,
        cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/standard_fonts/"
      });

      loadingTask.onProgress = ({ loaded, total }) => {
        if (!total || !percentEl || !barFillEl) {
          return;
        }
        const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
        percentEl.textContent = `${percent}%`;
        barFillEl.style.width = `${percent}%`;
      };

      try {
        pdfDocument = await loadingTask.promise;
        lastLoadError = null;
        break;
      } catch (error) {
        lastLoadError = error;
        console.warn("Failed to load PDF candidate:", candidateUrl, error);
      }
    }

    if (!pdfDocument) {
      if (percentEl) {
        percentEl.textContent = "失败";
      }
      if (barFillEl) {
        barFillEl.style.width = "100%";
      }
      if (overlay) {
        const box = overlay.querySelector(".loading-box");
        if (box) {
          box.innerHTML = `
            <div class="loading-text"><span>PDF 加载失败</span></div>
            <div style="font-size:12px;color:#6b7280;line-height:1.6;margin-bottom:10px;">Please check your connection, or download the PDF directly.</div>
            <a class="btn" href="${activePdfUrl}" download><span class="btn-icon">↓</span> Download PDF</a>
          `;
        }
      }
      console.error("Failed to load all PDF candidates:", lastLoadError);
      throw lastLoadError || new Error("Failed to load PDF.");
    }

    viewer.setDocument(pdfDocument);
    linkService.setDocument(pdfDocument, null);

    eventBus.on("pagesinit", async () => {
      viewer.currentScaleValue = "page-fit";
      updatePageControls();
      setTimeout(hideOverlay, 300);
      window.setTimeout(() => {
        suppressScaleIndicator = false;
      }, 500);

      let tocBuiltFromPdf = prebuiltTocApplied;
      if (prefersAutoToc) {
        try {
          const outlineValidation = validateTocItems(await extractOutlineItems(), 3);
          if (outlineValidation.ok && renderPrimaryTocItems(outlineValidation.items)) {
            tocBuiltFromPdf = true;
          }
        } catch (error) {
          console.warn("Failed to build TOC from PDF outline:", error);
        }
      }

      if (prefersAutoToc && !tocBuiltFromPdf) {
        try {
          const headingValidation = validateTocItems(await extractHeuristicTocItems(), 3);
          if (headingValidation.ok && renderPrimaryTocItems(headingValidation.items)) {
            tocBuiltFromPdf = true;
          }
        } catch (error) {
          console.warn("Failed to build TOC from PDF headings:", error);
        }
      }

      if (!tocBuiltFromPdf) {
        try {
          await mapStaticTocToRealPages();
        } catch (error) {
          console.warn("Failed to map static toc:", error);
        }
      }

      if (isSuspiciousTocMapping(staticTocButtons) && paperConfig && Array.isArray(paperConfig.toc)) {
        const fallbackValidation = validateTocItems(
          paperConfig.toc.map((item) => ({
            title: item && item.title ? item.title : "",
            pageNumber: Number(item && item.page ? item.page : item && item.pageNumber),
            depth: Number.isFinite(item && item.depth) ? item.depth : 0
          })),
          1
        );
        if (fallbackValidation.items.length > 0) {
          renderPrimaryTocItems(fallbackValidation.items);
        }
      }

      await applyInitialDeepLink();
      syncTocState(viewer.currentPageNumber, pdfDocument ? pdfDocument.numPages : null);
    });

    // Keep page controls in sync if TOC buttons are clicked before pagesinit finishes.
    eventBus.on("pagerendered", () => {
      updatePageControls();
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
      if (tagName === "input" || tagName === "textarea" || (target && target.isContentEditable)) {
        return;
      }

      if (event.key === "Escape") {
        if (bodyEl.classList.contains("find-open")) {
          event.preventDefault();
          setFindOpen(false);
          return;
        }
        if (bodyEl.classList.contains("sidebar-open")) {
          event.preventDefault();
          setSidebarOpen(false);
          return;
        }
      }

      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setFindOpen(true);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevPageBtn && prevPageBtn.click();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextPageBtn && nextPageBtn.click();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomInBtn && zoomInBtn.click();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomOutBtn && zoomOutBtn.click();
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        fitWidthBtn && fitWidthBtn.click();
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (event.shiftKey) {
          setFindOpen(true);
          return;
        }
        fitPageBtn && fitPageBtn.click();
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetZoomBtn && resetZoomBtn.click();
      }
    });
  } catch (error) {
    console.error("Paper reader initialization failed:", error);
  }
})();
