const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function readDownload(download) {
  const filePath = await download.path();
  expect(filePath, '下载应落盘为可读的临时文件').toBeTruthy();
  return fs.readFileSync(filePath, 'utf8');
}

async function waitForPublications(page) {
  await page.goto('/index.html');
  await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({ timeout: 45000 });
}

async function clickTocAndAssertPageQuery(page, buttonText) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          return Boolean(
            window.viewer &&
              typeof window.viewer.scrollPageIntoView === 'function' &&
              window.viewer.pdfDocument &&
              Number(window.viewer.pdfDocument.numPages || 0) > 1
          );
        }),
      { timeout: 90000 }
    )
    .toBe(true);

  const relationsTab = page.locator('.tf-sidebar-tab[data-panel="relations"]').first();
  if (await relationsTab.count()) {
    await relationsTab.click();
    await expect(page.locator('.reader-relations-panel')).toBeVisible({ timeout: 30000 });
  }

  const tocButton = page.locator('.toc-list .toc-link', { hasText: buttonText }).first();
  await expect(tocButton).toBeVisible({ timeout: 90000 });
  const expectedPage = await tocButton.getAttribute('data-page');
  expect(expectedPage).toMatch(/^\d+$/);

  await page.evaluate(() => {
    if (!window.__tocSpyInstalled && window.viewer && typeof window.viewer.scrollPageIntoView === 'function') {
      window.__tocSpyCalls = [];
      const original = window.viewer.scrollPageIntoView.bind(window.viewer);
      window.viewer.scrollPageIntoView = (params) => {
        const pageNumber = params && params.pageNumber ? String(params.pageNumber) : '';
        window.__tocSpyCalls.push(pageNumber);
        return original(params);
      };
      window.__tocSpyInstalled = true;
    }
  });

  await tocButton.click();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const calls = Array.isArray(window.__tocSpyCalls) ? window.__tocSpyCalls : [];
          return calls.length ? calls[calls.length - 1] : '';
        }),
      { timeout: 45000 }
    )
    .toBe(expectedPage);
}

test('Language rules: SCI cards keep English in zh, profile name becomes English in EN mode', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await waitForPublications(page);

  await expect(page.locator('.lang-btn[data-lang="zh"]')).toHaveClass(/active/);
  await expect(
    page
      .locator('#publications-list .publication-card')
      .filter({ hasText: 'Algorithm XXXX: sssvcqr' })
      .first()
  ).toBeVisible();

  await page.locator('.lang-btn[data-lang="en"]').click();
  await expect(page.locator('.profile-name')).toHaveText(/Hou Jian/);
  await expect(
    page
      .locator('#publications-list .publication-card')
      .filter({ hasText: 'Algorithm XXXX: sssvcqr' })
      .first()
  ).toBeVisible();
});

test('Dark mode persists after refresh and is inherited by paper pages', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.goto('/papers/2025/hcqr/hcqr.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('HCQR TOC links jump to the expected query page', async ({ page }) => {
  await page.goto('/papers/2025/hcqr/hcqr.html');
  await clickTocAndAssertPageQuery(page, '3. Estimation Method');
  await clickTocAndAssertPageQuery(page, '5. Real World Data');
});

test('SVCQR TOC links jump to the expected query page', async ({ page }) => {
  await page.goto('/papers/2025/svcqr/svcqr.html');
  await clickTocAndAssertPageQuery(page, '4. Asymptotic Theory');
  await clickTocAndAssertPageQuery(page, '7. Discussion');
});

test('Site-wide filters and citation export center work together', async ({ page }) => {
  await waitForPublications(page);

  await page.locator('.lang-btn[data-lang="en"]').click();
  await expect(page.locator('.lang-btn[data-lang="en"]')).toHaveClass(/active/);

  const totalCount = await page.locator('#publications-list .publication-card').count();
  expect(totalCount).toBeGreaterThan(0);

  await expect(page.locator('#pub-keyword-filter')).toBeVisible();
  const keywordValue = await page.evaluate(() => {
    const select = document.getElementById('pub-keyword-filter');
    if (!select) return '';
    const options = Array.from(select.options || []);
    const matched = options.find((option) => /quantile regression/i.test(option.textContent || ''));
    return matched ? matched.value : '';
  });
  expect(keywordValue).not.toBe('');
  await page.selectOption('#pub-keyword-filter', keywordValue);

  const filteredCount = await page.locator('#publications-list .publication-card').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount, '关键词筛选应真的收窄结果集，而不是原样返回全部').toBeLessThan(totalCount);

  const grabDownload = async (buttonSelector) => {
    const promise = page.waitForEvent('download');
    await page.locator(buttonSelector).click();
    return promise;
  };

  await page.locator('#export-filtered-only').check();

  // --- BibTeX：断言文件内容，而不只是文件名前缀 ---
  const bibDownload = await grabDownload('#export-bibtex-btn');
  expect(bibDownload.suggestedFilename()).toContain('filtered');
  expect(bibDownload.suggestedFilename()).toMatch(/\.bib$/);
  const bibtex = await readDownload(bibDownload);
  const bibEntries = bibtex.match(/^@\w+\s*\{/gm) || [];
  expect(
    bibEntries.length,
    'BibTeX 条目数应等于筛选后的卡片数；buildBibtexExport 的 filter(Boolean) 会静默丢弃缺 bibtex 字段的条目'
  ).toBe(filteredCount);
  expect(
    (bibtex.match(/^\s*title\s*=/gim) || []).length,
    '每条 BibTeX 都应带非空 title 字段'
  ).toBe(bibEntries.length);

  // --- RIS：TY/ER 必须成对，TI 必须非空 ---
  const risDownload = await grabDownload('#export-ris-btn');
  expect(risDownload.suggestedFilename()).toMatch(/\.ris$/);
  const ris = await readDownload(risDownload);
  expect((ris.match(/^TY {2}- /gm) || []).length, 'RIS 条目数应等于筛选后的卡片数').toBe(filteredCount);
  expect((ris.match(/^ER {2}-\s*$/gm) || []).length, '每条 RIS 都应以 ER 结束').toBe(filteredCount);
  const risTitles = ris.match(/^TI {2}- .*$/gm) || [];
  expect(risTitles.length, '每条 RIS 都应带 TI 标题行').toBe(filteredCount);
  expect(
    risTitles.every((line) => line.replace(/^TI {2}-\s*/, '').trim().length > 0),
    'RIS 的 TI 字段不应为空'
  ).toBe(true);

  // --- EndNote：%0 与 %T 必须逐条齐备 ---
  const endnoteDownload = await grabDownload('#export-endnote-btn');
  const endnote = await readDownload(endnoteDownload);
  expect((endnote.match(/^%0 /gm) || []).length, 'EndNote 条目数应等于筛选后的卡片数').toBe(filteredCount);
  expect((endnote.match(/^%T /gm) || []).length, '每条 EndNote 都应带 %T 标题').toBe(filteredCount);

  // --- 取消"仅导出筛选结果"后，导出范围应回到全集 ---
  await page.locator('#export-filtered-only').uncheck();
  const fullBibDownload = await grabDownload('#export-bibtex-btn');
  expect(fullBibDownload.suggestedFilename()).not.toContain('filtered');
  const fullBibtex = await readDownload(fullBibDownload);
  expect(
    (fullBibtex.match(/^@\w+\s*\{/gm) || []).length,
    '全量导出的条目数应等于未筛选时的卡片总数'
  ).toBe(totalCount);
});

test('Paper reader chrome exposes working download, theme and fit controls', async ({ page }) => {
  await page.goto('/papers/2025/hcqr/hcqr.html');

  // 等 reader 初始化完成（buildReaderChrome 已执行、PDF 已加载）
  await expect
    .poll(() => page.evaluate(() => Boolean(window.viewer && window.viewer.pdfDocument)), {
      timeout: 90000,
    })
    .toBe(true);

  const actions = page.locator('.tf-topbar-actions');
  const downloadLink = actions.locator('#downloadLink');
  const themeToggleBtn = actions.locator('#themeToggleBtn');
  const fitWidthBtn = actions.locator('#fitWidthBtn');
  const fitPageBtn = actions.locator('#fitPageBtn');

  // buildReaderChrome() 用 innerHTML 重建顶栏后，这些控件必须真实存在且可见，
  // 否则 :500-502 / :579-580 的 getElementById 会取到 null 并被 if 守卫静默跳过。
  await expect(downloadLink).toBeVisible();
  await expect(themeToggleBtn).toBeVisible();
  await expect(fitWidthBtn).toBeVisible();
  await expect(fitPageBtn).toBeVisible();

  // 下载入口必须指向真实可取的 PDF，而不是占位的 "#"
  const href = await downloadLink.getAttribute('href');
  expect(href, 'downloadLink.href 应已被初始化为真实 PDF 地址').toBeTruthy();
  expect(href).not.toBe('#');
  const pdfResponse = await page.request.get(href);
  expect(pdfResponse.status(), `下载 ${href} 应返回 200`).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('pdf');

  // 主题切换必须真的翻转 data-theme，并同步 aria-pressed 与文字标签
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await themeToggleBtn.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', initialTheme);
  const toggledTheme = await page.locator('html').getAttribute('data-theme');
  await expect(themeToggleBtn).toHaveAttribute('aria-pressed', String(toggledTheme === 'dark'));
  expect((await page.locator('#themeLabel').textContent()) || '').toBe(
    toggledTheme === 'dark' ? '日间' : '夜间'
  );
  await themeToggleBtn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme);

  // 适宽 / 适页必须真的改变 viewer 的缩放模式
  const scaleAfterClick = async (button) => {
    await button.click();
    return page.evaluate(() => String(window.viewer && window.viewer.currentScaleValue));
  };
  expect(await scaleAfterClick(fitWidthBtn)).toBe('page-width');
  expect(await scaleAfterClick(fitPageBtn)).toBe('page-fit');

  // W / F 快捷键走的是同一条 click() 路径，同样必须生效
  await page.evaluate(() => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  });
  await page.keyboard.press('w');
  await expect
    .poll(() => page.evaluate(() => String(window.viewer && window.viewer.currentScaleValue)), {
      timeout: 15000,
    })
    .toBe('page-width');
  await page.keyboard.press('f');
  await expect
    .poll(() => page.evaluate(() => String(window.viewer && window.viewer.currentScaleValue)), {
      timeout: 15000,
    })
    .toBe('page-fit');
});


const NO_FULLTEXT_PAGES = [
  { id: 'poisson-rr', path: '/papers/2025/poisson-rr/poisson-rr.html' },
  { id: 'gtwr-housing', path: '/papers/2022/gtwr-housing/gtwr.html' },
  { id: 'bgtwr-housing', path: '/papers/2022/bgtwr-housing/bgtwr.html' },
  { id: 'mgtwr-variable-selection', path: '/papers/2021/mgtwr-variable-selection/mgtwr.html' }
];

test('CNKI reader pages degrade gracefully without a local fulltext PDF', async ({ page }) => {
  for (const target of NO_FULLTEXT_PAGES) {
    const label = `[${target.id}]`;
    const pageErrors = [];
    const onError = (error) => pageErrors.push(String(error && error.message ? error.message : error));
    page.on('pageerror', onError);

    await page.goto(target.path);

    // 降级面板必须出现，而不是抛异常后留一片空白
    await expect(page.locator('.tf-nofulltext'), `${label} 降级面板应可见`).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.tf-nofulltext-title'), `${label} 标题文案`).toHaveText('本站未存档全文');

    // loading overlay 必须已隐藏：它的 inset 会连侧栏一起盖住，那样就看不到摘要与目录
    await expect(page.locator('#loadingOverlay'), `${label} 加载遮罩应已隐藏`).toHaveClass(/hidden/);

    // 官方获取渠道必须由 SSOT 下发、指向站外、带 noopener
    const links = page.locator('.tf-nofulltext-links a');
    const linkCount = await links.count();
    expect(linkCount, `${label} 应至少给出一条官方全文渠道`).toBeGreaterThan(0);
    for (let index = 0; index < linkCount; index += 1) {
      const link = links.nth(index);
      expect(await link.getAttribute('href'), `${label} 第 ${index} 条链接`).toMatch(/^https?:\/\//);
      expect(await link.getAttribute('rel'), `${label} 第 ${index} 条链接应带 noopener`).toContain('noopener');
      expect(await link.getAttribute('target'), `${label} 第 ${index} 条链接应新窗口打开`).toBe('_blank');
    }

    // 侧栏（作者自写的摘要 / 目录 / 元数据）必须仍然可用 —— 这正是保留阅读页的理由
    await expect(page.locator('.side-panel'), `${label} 侧栏应可见`).toBeVisible();
    await expect(page.locator('.tf-side-rail'), `${label} 侧栏导轨应已重建`).toBeAttached();
    const tocItems = page.locator('.side-panel .toc-list .toc-link');
    const tocCount = await tocItems.count();
    expect(tocCount, `${label} 作者自写目录应保留`).toBeGreaterThan(0);
    // 目录退化为纯信息：不可点击，且 data-page 已移除（跳页在无文档时无意义）
    await expect(tocItems.first(), `${label} 目录项应不可点`).toBeDisabled();
    expect(await tocItems.first().getAttribute('data-page'), `${label} 目录项不应再带页码`).toBeNull();

    // 作者自写的中文摘要必须真的渲染出来，而不是英文占位文案。
    // 旧版按 /abstract/i、/content/i 匹配 h3 文字来识别区块，中文页匹配不上，
    // 摘要与目录会被 buildReaderChrome 销毁后只剩占位文案。
    const abstractText = ((await page.locator('.tf-sidebar-abstract').textContent()) || '').trim();
    expect(abstractText.length, `${label} 摘要正文不应为空`).toBeGreaterThan(60);
    expect(abstractText, `${label} 不应是英文占位文案`).not.toContain('Abstract will appear here');
    expect(/[\u4e00-\u9fff]/u.test(abstractText), `${label} 摘要应保留中文原文`).toBe(true);
    const sidebarHeadings = await page.locator('.side-panel h3').allTextContents();
    expect(sidebarHeadings.join('|'), `${label} 目录标题应保留中文「目录」`).toContain('目录');
    expect(
      page.locator('.tf-empty-copy'),
      `${label} 不应再出现 "Section links will appear after the PDF loads." 占位`
    ).toHaveCount(0);

    // 依赖 PDF 的控件必须停用；下载入口必须移除，而不是留一个 href="#" 的死链接
    for (const id of ['#zoomInBtn', '#zoomOutBtn', '#fitWidthBtn', '#fitPageBtn', '#printBtn', '#findToggleBtn']) {
      await expect(page.locator(id), `${label} ${id} 应停用`).toBeDisabled();
    }
    expect(await page.locator('#downloadLink').count(), `${label} 不应留下下载死链`).toBe(0);

    // 主题切换不依赖 PDF，必须照常可用
    const themeToggleBtn = page.locator('#themeToggleBtn');
    await expect(themeToggleBtn, `${label} 主题切换应可用`).toBeEnabled();
    const themeBefore = await page.locator('html').getAttribute('data-theme');
    await themeToggleBtn.click();
    await expect(page.locator('html'), `${label} 主题应真的翻转`).not.toHaveAttribute('data-theme', themeBefore);

    expect(pageErrors, `${label} 阅读页不应抛未捕获异常：${pageErrors.join(' | ')}`).toEqual([]);
    page.off('pageerror', onError);
  }
});

test('Reader pages with a local PDF must not show the no-fulltext notice', async ({ page }) => {
  // 反向守卫：hcqr / svcqr 有自存档 PDF，绝不能被误判成「本站未存档全文」
  for (const path of ['/papers/2025/hcqr/hcqr.html', '/papers/2025/svcqr/svcqr.html']) {
    await page.goto(path);
    await expect
      .poll(() => page.evaluate(() => Boolean(window.viewer && window.viewer.pdfDocument)), { timeout: 90000 })
      .toBe(true);
    expect(await page.locator('.tf-nofulltext').count(), `${path} 不应出现降级面板`).toBe(0);
    await expect(page.locator('#downloadLink'), `${path} 下载入口应存在`).toBeVisible();
    await expect(page.locator('#zoomInBtn'), `${path} 缩放应可用`).toBeEnabled();
  }
});

// 体检 H-5 缺陷 4 + D-7：导航 scrollspy 的哈希漂移，及其真正的根因。
//
// 漂移是两层问题叠加，缺一不可：
// 1. 判定逻辑原先用 IntersectionObserver + threshold:0.3，语义是「section 有 30% 进入
//    视口才算命中」。对比视口还高的 section（#publications 实测 5192px）这条件永远
//    不可能满足，回调对它们从不触发；而 click 处理器与 observer 回调**各写一次 hash**，
//    于是点击时写好的 hash 会在滚动途中被 observer 改写成别的节。
// 2. 更底层的根因是 .publication-card 上的 content-visibility:auto +
//    contain-intrinsic-size:320px —— 320px 是对**每张**卡片的统一估值，而真实高度
//    因摘要长短、作者数、徽章、引用行各不相同。首屏外的卡片按估值占位，滚动经过时
//    逐个真实渲染，实测文档高度从 8708 缩到 7732（#publications 6168 → 5192，
//    缩水 976px）。点击时按旧几何算出的滚动目标因此超出新的 maxScroll 被 clamp，
//    落点直接跑到页面底部 —— 点「个人简历」最终停在「联系方式」。
//
// 已改为：以滚动位置为唯一依据、hash 只由 applySection 一个函数写、程序化滚动期间
// 用静止检测器延后判定、移除 content-visibility 声明、异步成果列表渲染完成后
// 重新对齐一次锚点。下面两条用例分别钉住「点击意图」与「深链不被改写」，
// 并把文档高度恒定作为 CLS 根因的直接守卫。
test('Navigation hash must follow the clicked section, and document height must stay constant', async ({
  page,
}) => {
  await waitForPublications(page);

  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('.nav-link')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => h.startsWith('#'))
      .map((h) => h.slice(1))
  );
  expect(ids.length, '导航应至少有 5 个站内锚点').toBeGreaterThanOrEqual(5);

  // 滚动全程文档高度必须恒定。这条断言直接守卫 D-7 的根因：一旦有人再把
  // content-visibility:auto 配一个拍脑袋的 contain-intrinsic-size 加回来，
  // 高度就会在滚动中变化，锚点导航随之失效。
  const heightBefore = await page.evaluate(() => document.documentElement.scrollHeight);

  for (const id of ids) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(400);
    await page.click(`.nav-link[href="#${id}"]`);
    // 平滑滚动 + 180ms 静止检测器，留足余量
    await page.waitForTimeout(1600);

    const hash = await page.evaluate(() => location.hash.replace(/^#/, ''));
    expect(hash, `点击 #${id} 后 URL 哈希应停在 #${id}，不得漂到别的节`).toBe(id);

    const active = await page.evaluate(() => {
      const a = document.querySelector('.nav-link[aria-current="page"]');
      return a ? (a.getAttribute('href') || '').replace(/^#/, '') : null;
    });
    expect(active, `点击 #${id} 后导航高亮项应是 #${id}`).toBe(id);
  }

  const heightAfter = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(
    heightAfter,
    '滚动全程文档高度必须恒定；一旦变化说明又有占位估值（content-visibility / contain-intrinsic-size）在作祟'
  ).toBe(heightBefore);
});

test('Deep-linked section hash must survive load and the async publication render', async ({ page }) => {
  // 成果列表是异步 fetch 后才渲染的，而浏览器的锚点定位发生在文档解析阶段 ——
  // 那时 #publications 还是空的、整篇文档短近千像素，卡片插入后把后面的内容整体推下去，
  // 视口却停在原处。main.js 在 loadPublications() 之后重新对齐一次锚点来修这件事。
  for (const id of ['publications', 'research', 'cv', 'contact']) {
    await page.goto(`/index.html#${id}`);
    await expect(page.locator('#publications-list .publication-card').first()).toBeVisible({
      timeout: 45000,
    });
    await page.waitForTimeout(1500);
    const hash = await page.evaluate(() => location.hash.replace(/^#/, ''));
    expect(hash, `直载 #${id} 后哈希不应被改写（异步渲染完成后须重新对齐锚点）`).toBe(id);
  }
});
