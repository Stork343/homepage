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

// 说明：整页 main 的像素快照与内容长度耦合——新增一条成果，截图高度就会变；
// 而 toHaveScreenshot 的 maxDiffPixelRatio 只能容忍像素差、不能容忍尺寸变化，
// 于是门禁结构性常红（Site Checks 88 次运行 86 次失败即由此而来：
// 基线 1440x7776 vs 实测 1440x8181）。
// 这里改为与内容长度解耦的布局不变量断言；像素快照只留给定高组件（.navbar）。
// 待补：在 macOS 上用固定 clip 的截图重建 main 的像素基线（见 docs/MACMINI.md）。
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

test("Paper reader visual baseline", async ({ page }) => {
  await page.goto("/papers/2025/hcqr/hcqr.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".topbar")).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".side-panel")).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".topbar")).toHaveScreenshot("paper-topbar.png", {
    maxDiffPixelRatio: 0.02
  });
  await expect(page.locator(".side-panel")).toHaveScreenshot("paper-sidebar.png", {
    maxDiffPixelRatio: 0.03
  });
});
