// Reader 检索 / 打印 / 全屏覆盖 —— 对应体检报告 D-9 覆盖缺口：
//   "reader 的下载/主题/适宽适页/检索/打印/全屏/深链 ?page= 零覆盖"
// 其中 下载/主题/适宽适页 已由 regression.spec.js（deffea0 修复后的控件用例）覆盖，
// 深链 ?page= 由 deeplink.spec.js 覆盖；本文件补齐剩余三项。
//
// ⚠ 已知产品缺陷（本次任务只测不改，详见最终报告）：
//   papers/shared/paper-reader.js:1693 的 runFind 调用 findController.executeCommand(...)，
//   但页面锁定的 pdfjs-dist@4.6.82（hcqr.html:1630 动态 import）的 PDFFindController
//   已经没有 executeCommand 方法（web/pdf_viewer.mjs 整包 grep 0 命中；4.x 的入口改为
//   eventBus.dispatch("find"|"findagain", state)）。因此任何检索动作都会抛
//   TypeError: findController.executeCommand is not a function，findStatus 永远 "0 / 0"。
//   检索的"能搜出匹配"行为当前不可测（断言它必然红），本文件只覆盖检索条自身
//   真实可达的行为：打开/聚焦/关闭。缺陷修复后应再补匹配计数断言。
const { test, expect } = require('@playwright/test');

const HCQR = '/papers/2025/hcqr/hcqr.html';

async function waitViewerReady(page) {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.viewer && window.viewer.pdfDocument)), {
      timeout: 90000,
    })
    .toBe(true);
}

test('Reader find bar opens with focus and closes again', async ({ page }) => {
  await page.goto(HCQR);
  await waitViewerReady(page);

  const body = page.locator('body');
  const findBar = page.locator('#findBar');
  await expect(body).not.toHaveClass(/find-open/);
  await expect(findBar).not.toBeVisible();

  await page.locator('#findToggleBtn').click();
  await expect(body, 'findToggleBtn 应给 body 挂上 find-open（paper-theme.css:283 控制显隐）').toHaveClass(
    /find-open/
  );
  await expect(findBar).toBeVisible();
  await expect(page.locator('#findInput'), '打开检索条时输入框应获得焦点').toBeFocused();

  await page.locator('#findCloseBtn').click();
  await expect(body).not.toHaveClass(/find-open/);
  await expect(findBar).not.toBeVisible();
});

test('Reader print button opens the archived PDF in a new tab', async ({ page }) => {
  await page.goto(HCQR);
  await waitViewerReady(page);

  const downloadLink = page.locator('.tf-topbar-actions #downloadLink');
  await expect(downloadLink).toBeVisible();
  const pdfHrefAttr = await downloadLink.getAttribute('href');
  expect(pdfHrefAttr, '下载入口应已指向真实 PDF').toBeTruthy();
  expect(pdfHrefAttr).not.toBe('#');
  const resolvedPdfUrl = new URL(pdfHrefAttr, page.url()).href;

  // printBtn 的处理器（见 paper-reader.js 中 `if (printBtn)` 一段）调用
  // window.open(activePdfUrl, "_blank", "noopener")。
  // 按 HTML 规范，features 含 noopener 时 window.open 返回 null —— 用一个语义等价的
  // 记录器替换 window.open（同样返回 null），既避免无头环境里弹出真实 PDF 标签页/下载，
  // 又能断言点击确实以正确参数打开了正确地址。
  await page.evaluate(() => {
    window.__openCalls = [];
    window.open = (...args) => {
      window.__openCalls.push(args.map((arg) => String(arg)));
      return null;
    };
  });

  await expect(page.locator('#printBtn')).toBeEnabled();
  // 体检 H-5 缺陷 3：这个按钮曾经 title="Print PDF" / aria-label="Print PDF"，
  // 但其处理器里 window.open(…, "noopener") 恒返回 null，紧跟的 if (!printWindow) return
  // 每次都命中，后面的 print() 与 load 监听**永不可达** —— 按钮从未真正打印过，
  // 只是一直在新标签打开 PDF。缺陷已按「如实描述行为」收敛，这里钉住文案，
  // 防止将来又把标签改回一个做不到的承诺（图标也已从打印机换成外链，二者须一致）。
  const printTitle = (await page.locator('#printBtn').getAttribute('title')) || '';
  const printAria = (await page.locator('#printBtn').getAttribute('aria-label')) || '';
  // 断言的是「不得承诺按钮自己会打印」，而不是「文案里不许出现 print 这个词」——
  // title 里的 "(print from there)" 恰恰是有用的指引，告诉用户去哪儿打印。
  // 所以要挡的是 ^Print PDF 这类以打印为主谓的写法。
  expect(printTitle, 'title 不应把「打印」当作本按钮的动作').not.toMatch(/^\s*print/i);
  expect(printAria, 'aria-label 不应把「打印」当作本按钮的动作').not.toMatch(/^\s*print/i);
  expect(printAria, 'aria-label 不应出现 print 字样（读屏用户听到「打印」会预期弹打印对话框）').not.toMatch(/print/i);
  expect(
    printTitle,
    'title 应说明是「在新标签打开」，与真实行为一致'
  ).toMatch(/new tab/i);

  await page.locator('#printBtn').click();
  await expect
    .poll(() => page.evaluate(() => window.__openCalls.length), {
      timeout: 10000,
      message: 'printBtn 点击应触发一次 window.open',
    })
    .toBe(1);

  const [openedUrl, target, features] = await page.evaluate(() => window.__openCalls[0]);
  expect(new URL(openedUrl, page.url()).href, '打印应打开与下载入口一致的存档 PDF').toBe(
    resolvedPdfUrl
  );
  expect(target, '应在新标签页打开').toBe('_blank');
  expect(features, '应带 noopener').toContain('noopener');
});

test('Reader fullscreen button enters and exits fullscreen', async ({ page }) => {
  await page.goto(HCQR);
  await waitViewerReady(page);

  const fullscreenBtn = page.locator('#fullscreenBtn');
  await expect(fullscreenBtn).toBeEnabled();
  await expect(fullscreenBtn).toHaveAttribute('aria-label', 'Enter fullscreen');
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);

  // 真实走 requestFullscreen（无头 Chromium 支持该 API；paper-reader.js:1819-1832）
  await fullscreenBtn.click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)), {
      timeout: 15000,
      message: '点击后 document.fullscreenElement 应非空',
    })
    .toBe(true);
  await expect(fullscreenBtn, 'fullscreenchange 应把按钮切换为退出态').toHaveAttribute(
    'aria-label',
    'Exit fullscreen'
  );

  await fullscreenBtn.click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)), {
      timeout: 15000,
      message: '再次点击应退出全屏',
    })
    .toBe(false);
  await expect(fullscreenBtn).toHaveAttribute('aria-label', 'Enter fullscreen');
});
