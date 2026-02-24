const { test, expect } = require('@playwright/test');

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
      .filter({ hasText: 'Sparse-Smooth Spatially Varying Coefficient Quantile Regression' })
      .first()
  ).toBeVisible();

  await page.locator('.lang-btn[data-lang="en"]').click();
  await expect(page.locator('.profile-name')).toHaveText(/Hou Jian/);
  await expect(
    page
      .locator('#publications-list .publication-card')
      .filter({ hasText: 'Sparse-Smooth Spatially Varying Coefficient Quantile Regression' })
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

  await page.locator('#export-filtered-only').check();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-bibtex-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('filtered');
  expect(download.suggestedFilename()).toContain('.bib');
});
