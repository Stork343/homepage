// 用 SSOT data/paper-pages.json 参数化遍历全部论文页 —— 对应体检报告 D-9：
//   · 修复优先级 ⑤："用 data/paper-pages.json 参数化循环 6 个论文页（同时满足审计 2.3 的主题契约建议）"
//     （上次审计 docs/audit/audit-2026-09-18.md 2.3：homepage-theme/data-theme 契约跨 8 个文件，
//       建议"把 regression.spec.js 只测 hcqr 的继承断言改成对 6 个 paper 页循环断言"）
//   · D-9 表格 R2 备注："继承只测 1/6 页"
//   · D-9 表格 A2 备注：论文页 axe "6 页只测 hcqr 一页"
//   · D-9 覆盖缺口："暗色模式无 axe"（本文件暗色轮覆盖全部论文页；首页暗色在 accessibility.spec.js）
//
// 路径与清单不硬编码：新增第 7 个论文页进入 SSOT 后，本文件自动把它纳入全部三轮断言。
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

const PAPER_PAGES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'paper-pages.json'), 'utf8')
).papers;

if (!Array.isArray(PAPER_PAGES) || PAPER_PAGES.length === 0) {
  throw new Error('data/paper-pages.json（SSOT）应至少包含一个论文页条目');
}

// 阅读页有两种合法终态：自存档 PDF 加载成功（window.viewer.pdfDocument），
// 或 CNKI 官方链接降级面板可见（.tf-nofulltext，6f4bf11 引入）。
// 任一终态 + buildReaderChrome 完成（.tf-side-rail 挂载）即视为 settle。
async function waitReaderSettled(page) {
  const pdfReady = page
    .waitForFunction(() => Boolean(window.viewer && window.viewer.pdfDocument), null, {
      timeout: 90000,
    })
    .then(() => 'pdf')
    .catch(() => 'pdf-unsettled');
  const degraded = page
    .waitForSelector('.tf-nofulltext', { state: 'visible', timeout: 90000 })
    .then(() => 'degraded')
    .catch(() => 'degraded-unsettled');
  const settled = await Promise.race([pdfReady, degraded]);
  expect(
    settled,
    '阅读页应 settle 到「PDF 已加载」或「降级面板可见」两种终态之一'
  ).toMatch(/^(pdf|degraded)$/);
  await page.waitForSelector('.tf-side-rail', { state: 'attached', timeout: 60000 });
  return settled;
}

async function seedTheme(page, theme) {
  // 主题契约：首页与 6 个论文页共享 localStorage 键 homepage-theme（main.js:20 /
  // 各论文页内联脚本 / paper-reader.js:556-577）。在源上写键即等价于用户在首页切换过主题。
  await page.goto('/index.html');
  await page.evaluate((value) => localStorage.setItem('homepage-theme', value), theme);
}

// 加载遮罩退场有 300ms 延迟 + 300ms opacity 过渡（paper-reader.js:1935 的 setTimeout(hideOverlay,300)
// 与论文页内联样式 .loading-overlay{transition:opacity .3s}），且 .hidden 只是 opacity:0，
// 元素仍在 DOM 里。axe 若在淡出中途采样，会按混合后的半透明前景色报出瞬态 color-contrast
// 误报（深色态实测必现于 poisson-rr）。等 opacity 真正归零后再扫描：稳态下 axe 会跳过它
// （6 页浅/深两轮稳态扫描实测全清）。
async function waitLoadingOverlayGone(page) {
  await expect(page.locator('#loadingOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const overlay = document.getElementById('loadingOverlay');
          return overlay ? getComputedStyle(overlay).opacity : '0';
        }),
      { timeout: 15000, message: '加载遮罩应完全淡出（opacity 归零）后再做 axe 扫描' }
    )
    .toBe('0');
}

async function scanSeriousViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .include('body')
    .analyze();
  return results.violations
    .filter((item) => ['serious', 'critical'].includes(String(item.impact || '').toLowerCase()))
    .map((item) => ({
      id: item.id,
      impact: item.impact,
      nodes: item.nodes.map((n) => String(n.target)).slice(0, 4),
    }));
}

test('Every SSOT paper page inherits the homepage theme (dark and light)', async ({ page }) => {
  const pageErrors = [];
  const onError = (error) => pageErrors.push(String(error && error.message ? error.message : error));
  page.on('pageerror', onError);

  for (const theme of ['dark', 'light']) {
    await seedTheme(page, theme);
    for (const paper of PAPER_PAGES) {
      const label = `[${theme}:${paper.id}]`;
      await page.goto(`/${paper.path}`);
      await waitReaderSettled(page);
      await expect(page.locator('html'), `${label} data-theme 应继承 homepage-theme 契约`).toHaveAttribute(
        'data-theme',
        theme
      );
      await expect(page.locator('#themeToggleBtn'), `${label} 阅读页主题切换应可用`).toBeEnabled();
    }
  }

  expect(pageErrors, `论文页不应抛未捕获异常：${pageErrors.join(' | ')}`).toEqual([]);
});

test('Every SSOT paper page passes body-scope axe in light mode', async ({ page }) => {
  await seedTheme(page, 'light');
  for (const paper of PAPER_PAGES) {
    const label = `[light:${paper.id}]`;
    await page.goto(`/${paper.path}`);
    await waitReaderSettled(page);
    await waitLoadingOverlayGone(page);
    await expect(page.locator('html'), `${label} 前置条件：浅色态`).toHaveAttribute(
      'data-theme',
      'light'
    );
    const serious = await scanSeriousViolations(page);
    expect(serious, `${label} body 全量 axe 不应有 serious/critical 违规`).toEqual([]);
  }
});

test('Every SSOT paper page passes body-scope axe in dark mode', async ({ page }) => {
  // 本用例曾经只扫描「本地 PDF 加载成功」的页面，把 4 个 CNKI 降级页排除在外，
  // 原因是当时存在一条已知产品缺陷：深色态下 .tf-nofulltext-note 的正文对比度仅 2.3:1
  // （axe 实测前景 #c4d1e6 / 混合后背景 #828896，需 ≥4.5:1）。
  // 该缺陷已修（见 papers/shared/paper-theme.css 末尾与 paper-reader.js 的
  // .tf-nofulltext-mode 标记）：病灶不在文字色而在 #viewerContainer 于深色下被
  // :1479 硬编码成 PDF 阅读器的铬灰 #828896 —— 在 #828896 上任何浅色都到不了 4.5:1
  // （纯白也只有约 3.3:1），故改为按状态收敛：只有降级态才把背景换成 --tf-bg(#0b1220)，
  // PDF 页保留铬灰以免影响其视觉基线。修后 4 个降级页深色态实测约 12.4:1。
  // 因此这里恢复**全量**深色扫描，并把守卫从「至少扫到 1 个」收紧为「必须扫满全部 SSOT 页」，
  // 免得将来再有人以"已知缺陷"为由悄悄缩小覆盖面。
  await seedTheme(page, 'dark');
  const scannedIds = [];
  const degradedIds = [];
  for (const paper of PAPER_PAGES) {
    const label = `[dark:${paper.id}]`;
    await page.goto(`/${paper.path}`);
    const settled = await waitReaderSettled(page);
    await expect(page.locator('html'), `${label} 前置条件：深色态`).toHaveAttribute(
      'data-theme',
      'dark'
    );
    if (settled === 'degraded') {
      // 仍然断言降级面板可见：这钉住了「该页确实走了降级分支」这一前置条件，
      // 否则若哪天 PDF 意外可加载，下面的 axe 就在测另一条分支而无人察觉。
      await expect(
        page.locator('.tf-nofulltext-note'),
        `${label} 降级页应展示无全文说明`
      ).toBeVisible();
      degradedIds.push(paper.id);
    }
    await waitLoadingOverlayGone(page);
    const serious = await scanSeriousViolations(page);
    expect(serious, `${label} 深色态 body 全量 axe 不应有 serious/critical 违规`).toEqual([]);
    scannedIds.push(paper.id);
  }
  // 防止「空跑」或「覆盖面被悄悄缩小」：必须扫满 SSOT 里的全部阅读页。
  expect(
    scannedIds.length,
    `深色 axe 应扫描全部 SSOT 阅读页（期望 ${PAPER_PAGES.length}，实际 ${scannedIds.length}：${scannedIds.join(', ')}；其中降级页：${degradedIds.join(', ') || '无'}）`
  ).toBe(PAPER_PAGES.length);
});
