const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function expectNoSeriousViolations(page, contextLabel, includeSelector) {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (includeSelector) {
    builder.include(includeSelector);
  }
  const results = await builder.analyze();
  const seriousViolations = results.violations.filter((item) =>
    ["serious", "critical"].includes(String(item.impact || "").toLowerCase())
  );
  expect(
    seriousViolations,
    `${contextLabel} has serious/critical accessibility violations: ${seriousViolations
      .map((item) => item.id)
      .join(", ")}`
  ).toEqual([]);
}

test("Homepage accessibility gate", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#publications-list .publication-card").first()).toBeVisible({ timeout: 45000 });
  await expectNoSeriousViolations(page, "homepage", "main");
});

test("Paper reader accessibility gate", async ({ page }) => {
  await page.goto("/papers/2025/hcqr/hcqr.html");
  await expect(page.locator(".topbar")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".side-panel")).toBeVisible({ timeout: 45000 });
  await expectNoSeriousViolations(page, "paper reader", "body");
});
