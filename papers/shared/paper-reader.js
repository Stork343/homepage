;(async () => {
  try {
    const PDF_URL = window.__PAPER_PDF_URL__;
    if (!PDF_URL) {
      throw new Error("Missing __PAPER_PDF_URL__ for paper reader.");
    }

    const rootEl = document.documentElement;
    const bodyEl = document.body;
    const topbarEl = document.querySelector(".topbar");
    const topbarRightEl = document.querySelector(".topbar-right");
    const sideHandle = document.getElementById("sideToggleHandle");
    const downloadLink = document.getElementById("downloadLink");
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeLabel = document.getElementById("themeLabel");
    const panelInner = document.querySelector(".side-panel-inner");

    if (downloadLink) {
      downloadLink.href = PDF_URL;
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

    if (topbarRightEl) {
      topbarRightEl.innerHTML = `
        <div class="reader-group">
          <button class="btn btn-ghost" id="prevPageBtn" title="上一页 (←)" type="button"><span class="btn-icon">←</span></button>
          <label class="reader-page-jump" title="输入页码后回车跳转">
            <input id="pageNumberInput" type="number" min="1" step="1" value="1" aria-label="页码"/>
            <span>/</span>
            <span id="totalPages">-</span>
          </label>
          <button class="btn btn-ghost" id="nextPageBtn" title="下一页 (→)" type="button"><span class="btn-icon">→</span></button>
        </div>
        <div class="reader-group">
          <button class="btn btn-ghost" id="zoomOutBtn" title="缩小 (-)" type="button"><span class="btn-icon">－</span></button>
          <button class="btn btn-ghost" id="zoomInBtn" title="放大 (+)" type="button"><span class="btn-icon">＋</span></button>
          <button class="btn btn-ghost" id="fitWidthBtn" title="适宽 (W)" type="button">适宽</button>
          <button class="btn btn-ghost" id="fitPageBtn" title="适页 (F)" type="button">适页</button>
          <button class="btn btn-ghost" id="resetZoomBtn" title="100% (R)" type="button">100%</button>
        </div>
        <div class="reader-group">
          <button class="btn btn-ghost" id="findToggleBtn" title="检索 (/ 或 Shift+F)" type="button">检索</button>
          <button class="btn btn-ghost" id="printBtn" title="打印" type="button">打印</button>
          <button class="btn btn-ghost" id="fullscreenBtn" title="全屏" type="button">全屏</button>
        </div>
      `;
    }

    let findBarEl = document.getElementById("findBar");
    if (!findBarEl && topbarEl) {
      findBarEl = document.createElement("div");
      findBarEl.id = "findBar";
      findBarEl.className = "find-bar";
      findBarEl.innerHTML = `
        <input class="find-input" id="findInput" type="search" placeholder="检索文档内容..." aria-label="检索文档内容"/>
        <button class="btn btn-ghost" id="findPrevBtn" type="button" title="上一个匹配 (Shift+Enter)">上一个</button>
        <button class="btn btn-ghost" id="findNextBtn" type="button" title="下一个匹配 (Enter)">下一个</button>
        <label class="find-check"><input id="findCase" type="checkbox"/>区分大小写</label>
        <label class="find-check"><input id="findHighlightAll" type="checkbox" checked/>全部高亮</label>
        <span class="find-status" id="findStatus">0 / 0</span>
        <button class="btn btn-ghost" id="findCloseBtn" type="button">关闭</button>
      `;
      topbarEl.insertAdjacentElement("afterend", findBarEl);
    }

    const overlay = document.getElementById("loadingOverlay");
    const percentEl = document.getElementById("loadingPercent");
    const barFillEl = document.getElementById("loadingBarFill");
    const zoomIndicator = document.getElementById("zoomIndicator");
    const viewerContainer = document.getElementById("viewerContainer");

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
    const staticTocButtons = primaryTocList ? Array.from(primaryTocList.querySelectorAll(".toc-link")) : [];

    let pdfDocument = null;
    let pageTextCache = null;

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
        sideHandle.textContent = opened ? "‹" : "›";
        sideHandle.setAttribute("aria-label", opened ? "收起侧边信息" : "展开侧边信息");
      }
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
          window.viewer.scrollPageIntoView({ pageNumber });
        }
      });
    }

    staticTocButtons.forEach((btn) => {
      if (!btn.dataset.titleRaw) {
        btn.dataset.titleRaw = stripPageSuffix(btn.textContent || "");
      }
      bindTocButton(btn);
    });

    async function buildPageTextCache() {
      if (pageTextCache || !pdfDocument) {
        return pageTextCache || { fullTexts: [], headTexts: [] };
      }
      const fullTexts = [];
      const headTexts = [];

      for (let p = 1; p <= pdfDocument.numPages; p += 1) {
        try {
          const page = await pdfDocument.getPage(p);
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item) => item.str || "").join(" ");
          const normalized = normalizeForMatch(text);
          fullTexts.push(normalized);
          headTexts.push(normalized.slice(0, 2200));
        } catch (error) {
          fullTexts.push("");
          headTexts.push("");
        }
      }
      pageTextCache = { fullTexts, headTexts };
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
        btn.textContent = isChinese
          ? `${rawTitle}（第${foundPage}页）`
          : `${rawTitle} (p.${foundPage})`;
      });
    }

    function attachPageNavigator() {
      if (!panelInner || !pdfDocument) {
        return;
      }
      const old = document.getElementById("pageNavSection");
      if (old) {
        old.remove();
      }

      const section = document.createElement("div");
      section.className = "side-panel-section";
      section.id = "pageNavSection";
      section.innerHTML = `
        <h3 style="font-style: italic; font-size: 18px;">完整目录（按页）</h3>
        <ol class="outline-list" id="pageNavList"></ol>
      `;

      const tocSection = primaryTocList ? primaryTocList.closest(".side-panel-section") : null;
      if (tocSection && tocSection.parentNode) {
        tocSection.insertAdjacentElement("afterend", section);
      } else {
        panelInner.appendChild(section);
      }

      const list = section.querySelector("#pageNavList");
      if (!list) {
        return;
      }

      for (let p = 1; p <= pdfDocument.numPages; p += 1) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "toc-link";
        btn.dataset.page = String(p);
        btn.textContent = `第 ${p} 页`;
        bindTocButton(btn);
        li.appendChild(btn);
        list.appendChild(li);
      }
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

    async function attachPdfOutline() {
      if (!panelInner || !pdfDocument) {
        return;
      }
      const old = document.getElementById("autoOutlineSection");
      if (old) {
        old.remove();
      }

      let outline = null;
      try {
        outline = await pdfDocument.getOutline();
      } catch (error) {
        outline = null;
      }
      if (!outline || outline.length === 0) {
        return;
      }

      const section = document.createElement("div");
      section.className = "side-panel-section";
      section.id = "autoOutlineSection";
      section.innerHTML = `
        <h3 style="font-style: italic; font-size: 18px;">PDF 书签目录</h3>
        <ol class="outline-list" id="outlineList"></ol>
      `;
      panelInner.appendChild(section);

      const outlineList = section.querySelector("#outlineList");
      if (!outlineList) {
        return;
      }

      let count = 0;
      const maxItems = 120;

      async function walk(items, depth = 0) {
        for (const item of items) {
          if (count >= maxItems) {
            return;
          }
          const pageNumber = await resolveDestinationToPage(item.dest);
          if (pageNumber) {
            const li = document.createElement("li");
            li.className = `outline-depth-${Math.min(depth, 3)}`;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "toc-link";
            btn.dataset.page = String(pageNumber);
            const title = stripPageSuffix(item.title || "未命名");
            btn.textContent = `${title}（第${pageNumber}页）`;
            bindTocButton(btn);
            li.appendChild(btn);
            outlineList.appendChild(li);
            count += 1;
          }
          if (Array.isArray(item.items) && item.items.length > 0) {
            await walk(item.items, depth + 1);
          }
        }
      }

      await walk(outline, 0);
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
        const printWindow = window.open(PDF_URL, "_blank", "noopener");
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
      fullscreenBtn.textContent = isFullscreen ? "退出全屏" : "全屏";
      fullscreenBtn.title = isFullscreen ? "退出全屏" : "全屏";
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

    eventBus.on("pagechanging", updatePageControls);
    eventBus.on("scalechanging", ({ scale }) => {
      if (typeof scale === "number") {
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

    const loadingTask = pdfjsLib.getDocument({
      url: PDF_URL,
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
    } catch (error) {
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
            <div style="font-size:12px;color:#6b7280;line-height:1.6;margin-bottom:10px;">请检查网络连接，或直接下载原文查看。</div>
            <a class="btn" href="${PDF_URL}" download><span class="btn-icon">↓</span> 下载 PDF</a>
          `;
        }
      }
      console.error("Failed to load PDF:", error);
      throw error;
    }

    viewer.setDocument(pdfDocument);
    linkService.setDocument(pdfDocument, null);

    eventBus.on("pagesinit", async () => {
      viewer.currentScaleValue = "page-fit";
      updatePageControls();
      setTimeout(hideOverlay, 300);

      try {
        await mapStaticTocToRealPages();
      } catch (error) {
        console.warn("Failed to map static toc:", error);
      }

      try {
        await attachPdfOutline();
      } catch (error) {
        console.warn("Failed to attach PDF outline:", error);
      }

      try {
        attachPageNavigator();
      } catch (error) {
        console.warn("Failed to attach page navigator:", error);
      }
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
