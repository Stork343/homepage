const { test, expect } = require("@playwright/test");

test.use({
  viewport: { width: 1440, height: 1024 }
});

test("Homepage visual baseline", async ({ page }) => {
  await page.goto("/index.html");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#publications-list .publication-card").first()).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".navbar")).toHaveScreenshot("homepage-navbar.png", {
    maxDiffPixelRatio: 0.02
  });
  await expect(page.locator("main")).toHaveScreenshot("homepage-main.png", {
    maxDiffPixelRatio: 0.03
  });
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
