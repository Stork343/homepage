// 首页检索输入框与引用格式切换覆盖 —— 对应体检报告 D-9 覆盖缺口：
//   · "#pub-search-input 零覆盖"（含 URL ?q= 同步与 ?q= 深链直达，main.js:30-41 / 705-750）
//   · "APA/GB-T 引用格式切换（main.js:1078-1082，CHANGELOG 声称的新功能）零覆盖"
//     （RIS/EndNote/BibTeX 批量导出已由 regression.spec.js 的导出中心用例覆盖，此处不重复）
//
// 历史记录（该缺陷已修，断言见本文件末尾的 Enter 用例）：
//   index.html 的 <form id="pub-search-form"> 原先没有 submit 拦截（main.js 全文 grep
//   "submit" 曾 0 命中），在检索框按回车会触发 HTML 隐式提交 → GET 整页刷新且 ?q= 丢失
//   （实测 URL 从 ?q=quantile 变成 ?）。本文件因此一度全程不向检索框发送 Enter，
//   等于这条最容易被真实访客触发的路径**零覆盖**。
//   修复落点：main.js 的 initPublicationSearch 内 searchForm 的 submit 拦截。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PUBLICATIONS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'publications.json'), 'utf8')
);

const SEARCH_TERM = 'quantile';

async function waitForPublications(page) {
  await page.goto('/index.html');
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
    timeout: 45000,
  });
}

function cardCount(page) {
  return page.locator('#publications-list .publication-card').count();
}

test('Publication search input filters cards, syncs ?q=, and honors deep links', async ({
  page,
}) => {
  await waitForPublications(page);
  const total = await cardCount(page);
  expect(total, '前置条件：成果列表应已渲染多条').toBeGreaterThan(1);

  // --- 输入即筛选（120ms debounce → applyFilters，main.js:1567-1570）---
  await page.locator('#pub-search-input').fill(SEARCH_TERM);
  await expect
    .poll(() => cardCount(page), {
      timeout: 15000,
      message: `输入 "${SEARCH_TERM}" 应真的收窄结果集`,
    })
    .toBeLessThan(total);
  const filtered = await cardCount(page);
  expect(filtered, '筛选结果不应为空').toBeGreaterThan(0);

  // --- URL ?q= 同步（writePublicationFiltersToUrl，main.js:705-750；注意 scrollspy 会附带 #hash，只解析 query）---
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'), {
      timeout: 10000,
      message: '检索词应回写进 URL ?q=（可分享/可刷新）',
    })
    .toBe(SEARCH_TERM);

  // --- 清空按钮：结果集与 URL 同时复原 ---
  await page.locator('#pub-clear-btn').click();
  await expect
    .poll(() => cardCount(page), { timeout: 15000, message: '清空后应恢复全量' })
    .toBe(total);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 10000 })
    .toBe(null);

  // --- ?q= 深链直达：输入框预填 + 结果集与逐字输入完全一致（readPublicationFilterStateFromUrl，main.js:30-41）---
  await page.goto(`/index.html?q=${encodeURIComponent(SEARCH_TERM)}`);
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('#pub-search-input')).toHaveValue(SEARCH_TERM);
  await expect
    .poll(() => cardCount(page), {
      timeout: 15000,
      message: '?q= 深链的结果集应与手动输入一致',
    })
    .toBe(filtered);
});

test('Per-card citation format select copies distinct APA / GB-T / default variants', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // 数据驱动选卡：citation.en 包含 title.en（insertYearInCitation 的生效前提）
  // 且 citation.zh 包含 title.zh（markCitationAsJournal 的生效前提），避免依赖列表顺序。
  const entry = PUBLICATIONS.find(
    (pub) =>
      pub &&
      pub.citation &&
      pub.title &&
      typeof pub.citation.en === 'string' &&
      typeof pub.title.en === 'string' &&
      pub.citation.en.includes(pub.title.en) &&
      typeof pub.citation.zh === 'string' &&
      typeof pub.title.zh === 'string' &&
      pub.citation.zh.includes(pub.title.zh) &&
      pub.year
  );
  expect(
    entry,
    'publications.json 应至少有一条 citation.en⊇title.en 且 citation.zh⊇title.zh 的条目'
  ).toBeTruthy();

  await waitForPublications(page);
  const card = page.locator(`#publication-${entry.id}`);
  await expect(card, `卡片 #publication-${entry.id} 应已渲染`).toBeVisible();

  const select = card.locator('.citation-format-select');
  await expect(select).toBeVisible();
  const copyBtn = card.locator('button.pub-link', { hasText: '复制引用' });
  await expect(copyBtn).toBeVisible();

  const copyWithFormat = async (format) => {
    await select.selectOption(format);
    // 先清空剪贴板，杜绝把上一次的陈旧内容当成本次复制结果（假阳性防线）
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await copyBtn.click();
    await expect(page.locator('#copy-toast'), `${format}: 复制成功应弹出 toast`).toHaveText(
      '已复制引用',
      { timeout: 10000 }
    );
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.length, `${format}: 剪贴板不应为空（clipboard.writeText 失败会走 toast_copy_failed 分支）`).toBeGreaterThan(
      0
    );
    return text;
  };

  // APA：formatCitation→insertYearInCitation（main.js:344-369）把年份插入为 "作者. (年份). 标题…"
  const apa = await copyWithFormat('apa');
  expect(apa, 'APA 应含 "(年份)." 插入格式').toContain(`(${entry.year}).`);
  expect(apa, 'APA 应含英文标题').toContain(entry.title.en);

  // GB/T 7714：markCitationAsJournal（main.js:371-388）在标题后挂 [J] 类文献类型标识
  const gbt = await copyWithFormat('gbt');
  expect(gbt, 'GB/T 应带 [X]. 文献类型标识').toMatch(/\[[A-Z]\]\./);
  expect(gbt, 'GB/T 应含中文标题').toContain(entry.title.zh);

  // default：按卡片语言取 citation 原文，不做任何加工
  const def = await copyWithFormat('default');
  expect([entry.citation.zh, entry.citation.en], 'default 应是该条目的 citation 原文之一').toContain(
    def
  );
  expect(def, 'default 与 APA 必须可区分').not.toBe(apa);
  expect(def, 'default 与 GB/T 必须可区分').not.toBe(gbt);
});

// 体检 H-5 缺陷 1 / 修复路线图第 20 条。
//
// 断言方式刻意不用「按 Enter 后 URL 是否变化」：本站有 ?q= 深链回填
// （main.js 会用 URL 上的 q 预填输入框并重跑过滤），所以即便真的发生了整页 reload，
// 检索词与结果集也会被恢复成一模一样，URL 前后相同 —— 那样断言必然假绿。
// 这里用两把互相独立的锁：
//   1. 文档级存活标记：按 Enter 前在 window 上挂一个对象，reload 后必然消失；
//   2. load 事件计数：文档级加载会让它 +1，same-document 的 hash/pushState 不会。
// 对照组已实测有效：临时摘掉 main.js 里的 submit 拦截后，存活标记消失、load 由 1 变 2、
// URL 退化为 /?#research、检索词清空 —— 精确复现了修复前的症状。
test('Enter in the search box must not trigger an implicit form submission', async ({ page }) => {
  let documentLoads = 0;
  page.on('load', () => {
    documentLoads += 1;
  });

  await waitForPublications(page);

  await page.click('#pub-search-input');
  await page.fill('#pub-search-input', SEARCH_TERM);
  // 等 debounce（120 ms）落地，确保按 Enter 前 URL 与结果集已是过滤后的状态
  await expect(page).toHaveURL(new RegExp(`[?&]q=${SEARCH_TERM}`), { timeout: 10000 });
  const filteredCount = await cardCount(page);
  expect(
    filteredCount,
    `前置条件：检索 "${SEARCH_TERM}" 应已收窄结果集`
  ).toBeGreaterThan(0);

  const marker = `alive-${Date.now()}`;
  await page.evaluate((value) => {
    window.__SEARCH_ENTER_ALIVE__ = value;
  }, marker);
  const loadsBeforeEnter = documentLoads;

  await page.press('#pub-search-input', 'Enter');
  // 给足时间：若真发生隐式 GET 提交，此时早已完成文档级加载
  await page.waitForTimeout(1500);

  expect(
    await page.evaluate(() => window.__SEARCH_ENTER_ALIVE__ || null),
    '按 Enter 后文档级存活标记应仍在 —— 消失即说明发生了整页 reload（隐式表单提交）'
  ).toBe(marker);

  expect(
    documentLoads,
    `按 Enter 不应产生新的文档级 load（Enter 前 ${loadsBeforeEnter} 次，之后 ${documentLoads} 次）`
  ).toBe(loadsBeforeEnter);

  await expect(page.locator('#pub-search-input')).toHaveValue(
    SEARCH_TERM,
    // 这一条单独看并不充分（深链回填会伪装成通过），但与上面两条合起来就能钉死行为
  );
  await expect(page).toHaveURL(new RegExp(`[?&]q=${SEARCH_TERM}`));
  expect(
    await cardCount(page),
    '按 Enter 后结果集应保持不变（Enter 只应立即生效，不该导航或重置）'
  ).toBe(filteredCount);
});
