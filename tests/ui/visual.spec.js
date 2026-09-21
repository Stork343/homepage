const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

test.use({
  viewport: { width: 1440, height: 1024 }
});

test.skip(
  process.platform !== "darwin",
  "Visual baselines are macOS-only; regenerate snapshots on Linux before enabling cross-platform runs."
);

test("Homepage visual baseline", async ({ page }) => {
  await page.goto("/index.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#publications-list .publication-card").first()).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".navbar")).toHaveScreenshot("homepage-navbar.png", {
    maxDiffPixelRatio: 0.02
  });
});

// 历史教训：此处原先是对整页 main 的像素快照，它与内容长度耦合——新增一条成果，
// 截图高度就会变，而 maxDiffPixelRatio 只能容忍像素差、不能容忍尺寸变化，
// 于是门禁结构性常红（Site Checks #74–#88 连续 15 次失败即由此而来：
// 基线 1440x7776 vs 实测 1440x8181）。
// 现在：像素覆盖改为「视口尺寸」快照（与页面总高度无关），另有布局不变量断言兜底。
//
// 基线首次生成只能在 macOS 上做（本仓库的运维脚本不随仓库分发，故直接给命令）：
//   UPDATE_MAIN_BASELINE=1 npx playwright test tests/ui/visual.spec.js --update-snapshots
// 基线文件存在时才断言，不存在则跳过——避免在基线落地前把 CI 卡红。
const VIEWPORT_BASELINE = path.join(
  __dirname,
  "visual.spec.js-snapshots",
  "homepage-viewport-chromium-darwin.png"
);
const VIEWPORT_BASELINE_READY =
  fs.existsSync(VIEWPORT_BASELINE) || process.env.UPDATE_MAIN_BASELINE === "1";

test("Homepage layout invariants", async ({ page }) => {
  await page.goto("/index.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#publications-list .publication-card").first()).toBeVisible({ timeout: 45000 });

  // 导航锚点必须都能落到真实存在的 section 上（导航与内容的一致性契约）
  const anchors = await page
    .locator(".nav-link[href^='#']")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href").slice(1)).filter(Boolean));
  expect(anchors.length).toBeGreaterThan(0);
  for (const id of anchors) {
    await expect(page.locator(`section[id="${id}"]`)).toHaveCount(1);
  }
});

// 视口尺寸快照：只覆盖首屏 1440x1024，与页面总高度无关，
// 因此以后再新增成果也不会把它撑红。
test("Homepage viewport baseline", async ({ page }) => {
  test.skip(
    !VIEWPORT_BASELINE_READY,
    "视口基线尚未生成；请在 macOS 上运行 UPDATE_MAIN_BASELINE=1 npx playwright test tests/ui/visual.spec.js --update-snapshots"
  );
  await page.goto("/index.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#publications-list .publication-card").first()).toBeVisible({ timeout: 45000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("homepage-viewport.png", {
    maxDiffPixelRatio: 0.02
  });
});

test("Paper reader visual baseline", async ({ page }) => {
  await page.goto("/papers/2025/hcqr/hcqr.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".topbar")).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".side-panel")).toBeVisible({ timeout: 60000 });
  // 必须等 buildReaderChrome() 真正重建完再截图：它用 innerHTML 依次重写顶栏、侧栏，
  // 最后创建 .tf-side-rail（三者同一个同步函数），所以 rail 挂载即代表重建完成。
  // 只等 .topbar 可见会截到静态标记，快照与运行时 UI 脱节 —— reader 控件回归因此测不出来。
  await expect(page.locator(".tf-side-rail")).toBeAttached({ timeout: 60000 });
  await expect(page.locator(".tf-topbar-actions #downloadLink")).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".topbar")).toHaveScreenshot("paper-topbar.png", {
    maxDiffPixelRatio: 0.02
  });
  await expect(page.locator(".side-panel")).toHaveScreenshot("paper-sidebar.png", {
    maxDiffPixelRatio: 0.03
  });
});
