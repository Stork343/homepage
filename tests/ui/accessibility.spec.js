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
// 曾经还有一层更深的坑，现已从源头消除：.publication-card/.research-item 当时带
// content-visibility:auto（enhanced-main.css），Chromium 会锁定视口外子树并沿用**缓存的
// 旧计算样式** —— 主题翻转时首屏外的卡片不参与样式重算，axe 于是读到「浅色标题 +
// 深色卡片背景」的陈旧组合（恒为列表末尾几张卡，对比度 1.01:1 的偶发红即此），
// 导致本文件所属的深色 axe 门约 40% 概率偶发红。当时的对策是在 settle 里注入
// `.publication-card,.research-item{content-visibility:visible !important;}` 强制解锁全量子树。
//
// 该属性后来因另一个更严重的理由被整体移除（见 enhanced-main.css 中 .publication-card
// 上方的说明与 regression.spec.js 的「文档高度必须恒定」用例）：contain-intrinsic-size
// 的统一估值让文档高度在滚动中突变 976px，直接毁掉锚点导航。根因既已不存在，
// 这段注入也就成了空操作，故删除 —— 少一处测试侧绕行，门禁的结论更可信。
// 注意下面强制出帧的逻辑**保留**：它治的是另一件事（headless 的 waitForTimeout 不产帧，
// 颜色过渡会冻结在未启动的 idle 态），与 content-visibility 无关。
const STATE_SETTLE_MS = 500;

async function settleAfterStateChange(page) {
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
