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

// 体检 D-9 覆盖缺口："暗色模式…无视觉基线"。新增深色 navbar 组件快照：
// 与既有 navbar 基线同为组件级（不含论文列表），新增成果不会把它撑红。
// 截图前必须确保主题色过渡完全结束：headless Chromium 的帧按需调度，waitForTimeout
// 不产生帧，color 这类 paint 属性过渡可能长时间冻结在起始色（本机实测，accessibility
// 的 zh-dark 门因此偶发红）。page.screenshot() 强制 BeginFrame 推动过渡走完。
test("Homepage navbar dark visual baseline", async ({ page }) => {
  await page.goto("/index.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#publications-list .publication-card").first()).toBeVisible({ timeout: 45000 });
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(500);
  await expect
    .poll(
      async () => {
        await page.screenshot({ timeout: 15000 });
        return page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((a) => a.constructor.name === "CSSTransition" && a.playState !== "finished")
              .length
        );
      },
      { timeout: 30000, intervals: [250], message: "主题色过渡应全部完成后再截图比对" }
    )
    .toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".navbar")).toHaveScreenshot("homepage-navbar-dark.png", {
    maxDiffPixelRatio: 0.02
  });
});

// 体检 D-9 修复优先级 ⑥（防止"跳过面无声扩大"）在 tests/ui 侧的实现：
// V3 视口基线曾因"从未生成"导致对应用例在所有环境永久自跳过（D-9 表格：当前强度为零）。
// CI 侧的 skipped 计数断言属于 workflow 文件（不在本次任务可修改范围），这里用文件存在性兜底：
// 任何一张已提交基线消失，本用例立即红，而不是让对应视觉用例静默 skip。
// （本文件在非 darwin 平台整体 skip，与视觉门禁"仅 macOS 有效"的既有边界一致。）
const EXPECTED_BASELINES = [
  "homepage-navbar-chromium-darwin.png",
  "homepage-viewport-chromium-darwin.png",
  "homepage-navbar-dark-chromium-darwin.png",
  "paper-topbar-chromium-darwin.png",
  "paper-sidebar-chromium-darwin.png"
];

test("Committed visual baselines exist so no visual test can silently self-skip", async () => {
  for (const name of EXPECTED_BASELINES) {
    const file = path.join(__dirname, "visual.spec.js-snapshots", name);
    expect(
      fs.existsSync(file),
      `视觉基线 ${name} 必须已提交（缺失会让对应用例在 :37-38 的条件判断下静默自跳过）`
    ).toBe(true);
    expect(fs.statSync(file).size, `视觉基线 ${name} 不应是空文件`).toBeGreaterThan(1000);
  }
});
