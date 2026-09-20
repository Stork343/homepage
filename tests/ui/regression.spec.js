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

