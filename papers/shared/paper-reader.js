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
      <button class="btn btn-ghost" id="findToggleBtn" title="检索 (/)" type="button">检索</button>
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

if (findToggleBtn) {
  findToggleBtn.addEventListener("click", () => {
    const shouldOpen = !bodyEl.classList.contains("find-open");
    setFindOpen(shouldOpen);
  });
}

if (findCloseBtn) {
  findCloseBtn.addEventListener("click", () => setFindOpen(false));
}

if (sideHandle) {
  const syncHandle = () => {
    const opened = bodyEl.classList.contains("sidebar-open");
    sideHandle.textContent = opened ? "‹" : "›";
    sideHandle.setAttribute("aria-label", opened ? "收起侧边信息" : "展开侧边信息");
  };
  sideHandle.addEventListener("click", () => {
    bodyEl.classList.toggle("sidebar-open");
    syncHandle();
  });
  syncHandle();
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

let pdfDocument;
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

const updatePageControls = () => {
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
};

const setScale = (scaleValue) => {
  viewer.currentScaleValue = scaleValue;
  const percent = Math.round(viewer.currentScale * 100);
  showZoomIndicator(`${percent}%`);
};

eventBus.on("pagesinit", () => {
  viewer.currentScaleValue = "page-fit";
  updatePageControls();
  setTimeout(hideOverlay, 300);
});

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

const runFind = (findPrevious = false, forceNewSearch = false) => {
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
};

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

const updateFullscreenState = () => {
  if (!fullscreenBtn) {
    return;
  }
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenBtn.textContent = isFullscreen ? "退出全屏" : "全屏";
  fullscreenBtn.title = isFullscreen ? "退出全屏" : "全屏";
};

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

const tocButtons = Array.from(document.querySelectorAll(".toc-link"));
tocButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const pageNumber = Number.parseInt(button.dataset.page || "", 10);
    if (Number.isFinite(pageNumber)) {
      viewer.scrollPageIntoView({ pageNumber });
    }
  });
});

async function resolveDestinationToPage(dest) {
  if (!dest) {
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

async function attachOutline() {
  const outline = await pdfDocument.getOutline();
  if (!outline || outline.length === 0) {
    return;
  }
  const panelInner = document.querySelector(".side-panel-inner");
  if (!panelInner) {
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
  const maxItems = 80;

  const walk = async (items, depth = 0) => {
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
        btn.textContent = `${item.title || "未命名"} (${pageNumber})`;
        btn.addEventListener("click", () => {
          viewer.scrollPageIntoView({ pageNumber });
        });
        li.appendChild(btn);
        outlineList.appendChild(li);
        count += 1;
      }
      if (Array.isArray(item.items) && item.items.length > 0) {
        await walk(item.items, depth + 1);
      }
    }
  };

  await walk(outline, 0);
}

attachOutline().catch((error) => {
  console.warn("Failed to build PDF outline:", error);
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
      bodyEl.classList.remove("sidebar-open");
      if (sideHandle) {
        sideHandle.textContent = "›";
        sideHandle.setAttribute("aria-label", "展开侧边信息");
      }
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
