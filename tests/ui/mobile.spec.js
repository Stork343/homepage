// 移动端视口覆盖 —— 对应体检报告 D-9：
//   · 覆盖缺口："移动端视口零覆盖（config 只有 1 个 Desktop Chrome project，而 index.html:90 有汉堡菜单）"
//   · 修复优先级 ④："加一个移动端 project 跑 A1+R2"
// playwright.config.js 不在本次任务可修改范围内，故用本文件级 test.use 落实移动端视口。
//
// 实现说明：不使用 devices['Pixel 7'] 的 isMobile 仿真 —— 实测该仿真使本页出现
// 布局/视觉视口坐标错位（媒体查询按 412px 命中、window.innerWidth 却是 825），
// Playwright 的 hit-test 因此误判汉堡/主题按钮被 .nav-content 覆盖而无法真实点击。
// 这里改用纯窄视口 412×915（不启用 isMobile）：同样命中 max-width:768px 的移动端 CSS
// （enhanced-main.css:48-49/293 的汉堡与抽屉规则全部生效），且 hit-test 正常（已实测）。
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.use({ viewport: { width: 412, height: 915 } });

test('Mobile viewport: homepage full-document axe passes', async ({ page }) => {
  // A1 等价物，且范围比桌面 A1 更宽：全文档扫描（navbar/footer/#theme-toggle 不再被 include('main') 排除）
  await page.goto('/index.html');
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
    timeout: 45000,
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations
    .filter((item) => ['serious', 'critical'].includes(String(item.impact || '').toLowerCase()))
    .map((item) => ({ id: item.id, impact: item.impact }));
  expect(serious, '移动端视口下全文档 axe 不应有 serious/critical 违规').toEqual([]);
});

test('Mobile viewport: dark mode persists after refresh and is inherited by paper pages', async ({
  page,
}) => {
  // R2 等价物（继承目标用降级页 poisson-rr：与 6 页矩阵同一契约，加载最快；
  // hcqr 的继承已由 regression.spec.js R2 与 paper-pages.spec.js 矩阵覆盖）
  await page.goto('/index.html');
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('#nav-toggle'), '前置条件：移动端应显示汉堡按钮').toBeVisible();

  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html'), '刷新后深色应持久（localStorage homepage-theme）').toHaveAttribute(
    'data-theme',
    'dark'
  );

  await page.goto('/papers/2025/poisson-rr/poisson-rr.html');
  await expect(page.locator('.tf-nofulltext')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('html'), '论文页应继承首页深色').toHaveAttribute('data-theme', 'dark');
});

test('Mobile viewport: hamburger opens the drawer, nav link closes it, desktop hides it', async ({
  page,
}) => {
  await page.goto('/index.html');
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
    timeout: 45000,
  });

  // 汉堡按钮可见（enhanced-main.css:49 @media max-width:768px 才 display:flex）
  await expect(page.locator('#nav-toggle')).toBeVisible();

  // 抽屉关闭时整个位于屏幕外（enhanced-main.css:293 left:-100%）
  const closedBox = await page.locator('#nav-menu').boundingBox();
  expect(closedBox, '菜单应存在').toBeTruthy();
  expect(closedBox.x, '关闭时抽屉应在屏幕外').toBeLessThan(0);

  // 点汉堡 → 抽屉滑入视口（main.js:1513-1518 toggle .active；left 有 .3s 过渡，需 poll 等待动画结束）
  await page.locator('#nav-toggle').click();
  await expect(page.locator('#nav-menu')).toHaveClass(/active/);
  await expect
    .poll(
      async () => {
        const box = await page.locator('#nav-menu').boundingBox();
        return box ? Math.round(box.x) : -99999;
      },
      { timeout: 10000, message: '打开后抽屉应滑入视口（left 过渡结束）' }
    )
    .toBeGreaterThanOrEqual(0);
  const openBox = await page.locator('#nav-menu').boundingBox();
  expect(openBox.x + openBox.width, '抽屉不应超出视口右缘').toBeLessThanOrEqual(412 + 1);

  // 点菜单项 → 抽屉收起 + 锚点跳转生效（main.js:1486-1490 的收菜单分支）
  await page.locator('#nav-menu .nav-link[href="#about"]').click();
  await expect(page.locator('#nav-menu'), '点击导航后抽屉应收起').not.toHaveClass(/active/);
  await expect
    .poll(() => new URL(page.url()).hash, { timeout: 15000 })
    .toBe('#about');
  await expect
    .poll(
      async () => {
        const box = await page.locator('#about').boundingBox();
        return box ? Math.round(box.y) : 99999;
      },
      { timeout: 20000, message: '移动端点击 #about 应把关于区滚到视口顶部' }
    )
    .toBeLessThanOrEqual(160);

  // 桌面宽度下汉堡隐藏、横向菜单直接可见（断点契约）
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#nav-toggle'), '桌面宽度不应显示汉堡按钮').not.toBeVisible();
  await expect(page.locator('#nav-menu'), '桌面宽度菜单应直接可见').toBeVisible();
});
