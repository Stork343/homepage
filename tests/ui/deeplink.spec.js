// 深链（deep link）行为覆盖 —— 对应体检报告 docs/audit/health-check-2026-09-20.md：
//   · D-9 覆盖缺口："reader 的 …/深链 ?page= 零覆盖"（修复优先级 ③：补深链 ?page= 断言（SEO/分享入口））
//   · D-9 表格 R3/R4 备注：既有 TOC 用例只 spy scrollPageIntoView 入参，"未断言 URL ?page= 深链回写"
//   · 任务口径的 "# 锚点" 深链：阅读页 readDeepLinkState() 支持 #sec-<标题> 哈希（paper-reader.js:1385），
//     首页导航锚点点击/直载由 main.js:1469-1492 处理，两者此前均无行为断言。
//
// 阅读页深链的三种入口（paper-reader.js:1381-1439 readDeepLinkState/applyInitialDeepLink）：
//   1. ?page=N          直接落到第 N 页
//   2. ?sec=<标题>      经 findSectionTargetPage() 映射到 TOC 页码后落页，并把 ?page= 物化进 URL
//   3. #sec-<标题>      同 2（哈希形态）
// 期望页码一律取自 SSOT data/paper-pages.json，不在测试里硬编码。
//
// 抗抖动说明：PDF 渐进加载期间页面占位高度会变化，pdf.js 的滚动锚定可能出现短暂回漂
// （实测 TOC 点击后 current 页可在加载未稳时跳变）。因此所有落页断言都遵循
// 「先 poll 到位 → 再等两拍页码不变（stabilize）→ 最后用单次 evaluate 原子快照断言」的顺序，
// 避免对加载中间态采样。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PAPER_PAGES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'paper-pages.json'), 'utf8')
).papers;

const HCQR = PAPER_PAGES.find((p) => p.id === 'hcqr');
if (!HCQR) {
  throw new Error('data/paper-pages.json（SSOT）中找不到 hcqr 条目');
}
const HCQR_PATH = `/${HCQR.path}`;

function tocEntry(titlePart) {
  const entry = (HCQR.toc || []).find((item) => item.title.includes(titlePart));
  if (!entry || !Number.isFinite(entry.page)) {
    throw new Error(`data/paper-pages.json 的 hcqr.toc 缺少条目：${titlePart}`);
  }
  return entry;
}

async function waitViewerReady(page) {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.viewer && window.viewer.pdfDocument)), {
      timeout: 90000,
    })
    .toBe(true);
}

// 连续两次（间隔 1s）采样页码不变即视为布局/滚动已稳定
async function waitViewerStable(page) {
  let last = -1;
  await expect
    .poll(
      async () => {
        const current = await page.evaluate(() => window.viewer.currentPageNumber);
        const stable = current === last;
        last = current;
        return stable;
      },
      { timeout: 90000, intervals: [1000], message: 'viewer 页码应停止变化（布局稳定）' }
    )
    .toBe(true);
  return last;
}

// 单次 evaluate 原子读取「当前页 + URL ?page=」，保证两者来自同一时刻
async function snapshotPageAndUrl(page) {
  return page.evaluate(() => ({
    current: window.viewer.currentPageNumber,
    urlPage: new URL(window.location.href).searchParams.get('page'),
  }));
}

test('Reader ?page= deep link opens directly on the target page', async ({ page }) => {
  const target = tocEntry('Model and Methodology');

  await page.goto(`${HCQR_PATH}?page=${target.page}`);
  await waitViewerReady(page);
  await expect
    .poll(() => page.evaluate(() => window.viewer.currentPageNumber), {
      timeout: 60000,
      message: `?page=${target.page} 深链应把 viewer 落到目标页`,
    })
    .toBe(target.page);
  await waitViewerStable(page);

  const snapshot = await snapshotPageAndUrl(page);
  expect(
    snapshot.current,
    `?page=${target.page} 深链应把 viewer 直接落到目标页并保持稳定`
  ).toBe(target.page);
  expect(
    snapshot.urlPage,
    '?page= 参数应在深链加载后原样保留（这是分享/SEO 入口的契约）'
  ).toBe(String(target.page));
});

test('Reader ?sec= and #sec- deep links resolve through the TOC mapping', async ({ page }) => {
  const target = tocEntry('Estimation Method');
  const sectionTitle = target.title.replace(/^\d+\.\s*/, '');

  // --- ?sec=<标题> 形态 ---
  await page.goto(`${HCQR_PATH}?sec=${encodeURIComponent(sectionTitle)}`);
  await waitViewerReady(page);
  await expect
    .poll(() => page.evaluate(() => window.viewer.currentPageNumber), {
      timeout: 60000,
      message: `?sec=${sectionTitle} 应经 TOC 映射落到第 ${target.page} 页`,
    })
    .toBe(target.page);
  await waitViewerStable(page);
  let snapshot = await snapshotPageAndUrl(page);
  expect(snapshot.current, '?sec= 深链的稳定落点应是 TOC 映射页').toBe(target.page);
  let url = new URL(page.url());
  expect(url.searchParams.get('sec'), '?sec= 参数应保留').toBe(sectionTitle);
  expect(
    snapshot.urlPage,
    '?sec= 深链命中后应把页码物化为 ?page=（syncPageQuery 回写）'
  ).toBe(String(target.page));

  // --- #sec-<标题> 哈希形态 ---
  await page.goto(`${HCQR_PATH}#sec-${encodeURIComponent(sectionTitle)}`);
  await waitViewerReady(page);
  await expect
    .poll(() => page.evaluate(() => window.viewer.currentPageNumber), {
      timeout: 60000,
      message: `#sec-${sectionTitle} 哈希深链应落到第 ${target.page} 页`,
    })
    .toBe(target.page);
  await waitViewerStable(page);
  snapshot = await snapshotPageAndUrl(page);
  expect(snapshot.current, '#sec- 哈希深链的稳定落点应是 TOC 映射页').toBe(target.page);
  expect(snapshot.urlPage, '哈希深链命中后同样应回写 ?page=').toBe(String(target.page));
  url = new URL(page.url());
  expect(url.hash.startsWith('#sec-'), '#sec- 哈希应保留').toBe(true);
});

test('TOC clicks and page navigation keep the ?page= URL in sync', async ({ page }) => {
  const target = tocEntry('Estimation Method');

  await page.goto(HCQR_PATH);
  await waitViewerReady(page);
  await waitViewerStable(page);

  // 与既有 regression.spec.js helper 相同的入口路径：先展开 relations 面板再点 TOC
  const relationsTab = page.locator('.tf-sidebar-tab[data-panel="relations"]').first();
  if (await relationsTab.count()) {
    await relationsTab.click();
    await expect(page.locator('.reader-relations-panel')).toBeVisible({ timeout: 30000 });
  }
  const tocButton = page.locator('.toc-list .toc-link', { hasText: 'Estimation Method' }).first();
  await expect(tocButton).toBeVisible({ timeout: 60000 });
  await tocButton.click();

  // 契约一：TOC 点击后 URL ?page= 与 viewer 当前页保持一致（syncPageQuery 回写，
  // 这正是 D-9 指出既有 R3/R4 缺失的"URL ?page= 深链回写"断言）。
  // 说明：pdf.js 的滚动锚定可能让落点停在目标页前一页（实测 data-page=12 落在 11），
  // 「scrollPageIntoView 收到正确页码」的绑定契约已由既有 R3/R4 用例负责，
  // 这里断言的是 URL 同步不变量 + 落点在目标页近旁。
  const targetPage = Number(target.page);
  await expect
    .poll(
      () =>
        page.evaluate((tp) => Math.abs(window.viewer.currentPageNumber - tp), targetPage),
      { timeout: 60000, message: 'TOC 点击应把 viewer 带到目标页近旁' }
    )
    .toBeLessThanOrEqual(1);
  await waitViewerStable(page);
  const landed = await snapshotPageAndUrl(page);
  expect(landed.urlPage, 'URL ?page= 应等于 viewer 当前页（回写同步不变量）').toBe(
    String(landed.current)
  );
  expect(
    Math.abs(landed.current - target.page),
    `TOC 点击应落在目标页（SSOT: ${target.page}）近旁，允许 pdf.js 锚定的一页偏差`
  ).toBeLessThanOrEqual(1);

  // 契约二：下一页按钮精确 +1，且 URL 立即回写 —— 回写链路本身是确定性的
  const before = landed.current;
  await page.locator('#nextPageBtn').click();
  await expect
    .poll(() => page.evaluate(() => window.viewer.currentPageNumber), { timeout: 30000 })
    .toBe(before + 1);
  await expect
    .poll(
      () => page.evaluate(() => new URL(window.location.href).searchParams.get('page')),
      { timeout: 15000, message: '翻页后 URL ?page= 应同步' }
    )
    .toBe(String(before + 1));
});

test('Homepage # anchor deep links land on real sections and keep nav state', async ({ page }) => {
  // --- (a) 直接以 #哈希 加载（分享/SEO 入口）：原生锚点定位应把目标 section 顶到视口上沿。
  //     哈希只断言"仍是站内合法锚点"：已知产品怪癖（见最终报告，未修改产品代码）——
  //     IntersectionObserver（main.js:1494-1509，threshold 0.3）在卡片渲染引起的布局位移中
  //     会用 replaceState 把哈希改写成最后一个满足阈值的矮 section（实测 #publications 直载
  //     稳定后哈希可能变成 #research），精确哈希断言因此不可靠。
  await page.goto('/index.html#publications');
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
    timeout: 45000,
  });
  await expect
    .poll(
      async () => {
        const box = await page.locator('#publications').boundingBox();
        return box ? Math.round(box.y) : 99999;
      },
      { timeout: 20000, message: 'index.html#publications 直载应把成果区滚动到视口顶部' }
    )
    .toBeLessThanOrEqual(160);
  const navAnchors = await page
    .locator(".nav-link[href^='#']")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')));
  expect(navAnchors, '直载后 URL 哈希应仍是站内合法锚点').toContain(new URL(page.url()).hash);

  // --- (b) 点击导航锚点（main.js:1469-1492）：精确哈希回写 + aria-current + 平滑滚动落位。
  //     #about 是首屏 section（scrollspy 对它可稳定命中），哈希断言可精确。
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
    timeout: 45000,
  });

  await page.locator('.nav-link[href="#about"]').click();
  await expect
    .poll(() => new URL(page.url()).hash, { timeout: 15000 })
    .toBe('#about');
  await expect(page.locator('.nav-link[href="#about"]')).toHaveClass(/active/);
  await expect(page.locator('.nav-link[aria-current="page"]')).toHaveAttribute('href', '#about');
  await expect
    .poll(
      async () => {
        const box = await page.locator('#about').boundingBox();
        return box ? Math.round(box.y) : 99999;
      },
      { timeout: 20000, message: '点击 #about 导航应把关于区滚动到视口顶部' }
    )
    .toBeLessThanOrEqual(160);

  // --- (c) 点击超高 section（#publications）的导航：滚动落位必须精确；
  //     哈希同 (a)，只断言"仍是站内合法锚点"（scrollspy 漂移怪癖见上）。
  await page.locator('.nav-link[href="#publications"]').click();
  await expect
    .poll(
      async () => {
        const box = await page.locator('#publications').boundingBox();
        return box ? Math.round(box.y) : 99999;
      },
      { timeout: 20000, message: '点击 #publications 导航应把成果区滚动到视口顶部' }
    )
    .toBeLessThanOrEqual(160);
  expect(navAnchors, '点击后 URL 哈希应仍是站内合法锚点').toContain(new URL(page.url()).hash);
  await expect(page.locator('.nav-link[aria-current="page"]')).toHaveCount(1);
});
