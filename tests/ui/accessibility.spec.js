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

// ---------------------------------------------------------------------------
// 以下补齐体检报告 docs/audit/health-check-2026-09-20.md D-9 指出的 axe 覆盖缺口：
//   · A1 备注："仅 main 范围（navbar/footer/#theme-toggle 被排除）、仅中文浅色态"
//     （上次审计 audit-2026-09-18.md 2.5 同款建议：首页去掉 main 限定扫全文档，增加英文态与深色态各一轮）
//   · 覆盖缺口："暗色模式无 axe"（首页部分在此；论文页暗色轮在 paper-pages.spec.js 的 SSOT 矩阵里）
// 论文页 6 页参数化 axe（A2 备注"6 页只测 hcqr 一页"）由 paper-pages.spec.js 承担，此处不重复。
//
// 切换主题/语言后必须等 CSS 颜色过渡（transition .25s~.3s）与卡片重渲染完全结束再扫描。
// 实测教训（全量复跑时 zh-dark 门偶发红）：headless Chromium 的帧是按需求调度的，
// waitForTimeout 不产生帧，而 color 属于 paint 属性过渡，可能冻结在起始色 2s 以上——
// axe 采样到未翻转的前景 #1a1d21（对比 1.01:1），4 个卡片标题链接被误报；
// page.screenshot() 会强制 BeginFrame，过渡随真实时间推进到完成（探针实测：等待 + 强制出帧后
// document.getAnimations() 归零、标题色到达 --tf-ink #eef4ff）。
// 因此 settle = 底限时 + 轮询「每轮强制出一帧，直到没有未完成的 CSSTransition」。
// 注意过滤条件必须是 playState !== "finished" 而不是 === "running"：切换后若一帧都没出过，
// 过渡会停在未启动的 idle/pending 态（只数 running 会立刻得 0，axe 随即采到起始浅色）。
//
// 更深层的坑（本轮实测定位）：.publication-card/.research-item 带 content-visibility:auto
// （enhanced-main.css:252/:103），Chromium 会锁定视口外子树并沿用**缓存的旧计算样式**——
// 主题翻转时首屏外的卡片不参与样式重算，axe 会读到「浅色标题 + 深色卡片背景」的陈旧组合
// （恒为列表末尾几张卡，对比度 1.01:1 的偶发红即此）。这是无头采样伪影而非用户可见缺陷
// （真实用户滚动到时子树解锁、按正常级联渲染深色）。因此 settle 先注入测试侧解锁样式
// 强制全量子树参与重算（不改任何颜色规则，不会掩盖真实对比度问题），再等过渡走完。
const STATE_SETTLE_MS = 500;

async function settleAfterStateChange(page) {
  await page.addStyleTag({
    content: ".publication-card,.research-item{content-visibility:visible !important;}",
  });
  await page.waitForTimeout(STATE_SETTLE_MS);
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
      {
        timeout: 30000,
        intervals: [250],
        message: "状态切换后所有 CSS 颜色过渡都应完成（headless 需强制出帧推动）",
      }
    )
    .toBe(0);
}

async function gotoHomepageSettled(page) {
  await page.goto("/index.html");
  await expect(page.locator("#publications-list .publication-card").first()).toBeVisible({ timeout: 45000 });
}

test("Homepage accessibility gate (zh, light, FULL document)", async ({ page }) => {
  await gotoHomepageSettled(page);
  // 与既有 A1 相同的中文浅色态，但不再 include("main")：navbar/footer/#theme-toggle 全部纳入扫描
  await expectNoSeriousViolations(page, "homepage zh light (full document)");
});

test("Homepage accessibility gate (en, light, full document)", async ({ page }) => {
  await gotoHomepageSettled(page);
  await page.locator(".lang-btn[data-lang='en']").click();
  await expect(page.locator(".profile-name")).toHaveText(/Hou Jian/);
  await settleAfterStateChange(page);
  await expectNoSeriousViolations(page, "homepage en light (full document)");
});

test("Homepage accessibility gate (zh, dark, full document)", async ({ page }) => {
  await gotoHomepageSettled(page);
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settleAfterStateChange(page);
  await expectNoSeriousViolations(page, "homepage zh dark (full document)");
});

test("Homepage accessibility gate (en, dark, full document)", async ({ page }) => {
  await gotoHomepageSettled(page);
  await page.locator(".lang-btn[data-lang='en']").click();
  await expect(page.locator(".profile-name")).toHaveText(/Hou Jian/);
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settleAfterStateChange(page);
  await expectNoSeriousViolations(page, "homepage en dark (full document)");
});
