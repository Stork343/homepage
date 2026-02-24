# Academic Homepage

## Overview
This repository hosts a bilingual personal academic homepage and six local paper subpages with an integrated PDF reader.

## Key Features
- Homepage with Chinese/English switching and dark mode persistence.
- Site-wide publication search by title, author, keywords, year, venue, and status.
- Citation export center for BibTeX / RIS / EndNote (all records or current filtered subset).
- Paper reader with sidebar metadata, TOC jump, search, print, fullscreen, and deep-link page query sync.
- SCI paper TOC pre-generated cache (`data/paper-toc.generated.json`) plus runtime fallback extraction.
- Single-source data workflow: `data/site-master.json` generates all downstream data and sitemap artifacts.
- Automated paper SEO metadata sync for each paper page (`SEO:BEGIN` / `SEO:END` blocks).

## Repository Layout
- `index.html`: homepage.
- `enhanced-main.css`: homepage styles.
- `scripts/main.js`: homepage interactions.
- `data/site-master.json`: canonical source for publications and paper-page mappings.
- `papers/*/*/*.html`: paper subpages.
- `papers/shared/paper-reader.js`: shared PDF reader logic.
- `data/publications.json`: publication metadata.
- `data/paper-pages.json`: paper page configuration.
- `data/paper-toc.generated.json`: pre-generated TOC cache.
- `data/search-index.generated.json`: global academic search index.
- `data/publications-jsonld.generated.json`: generated homepage JSON-LD payload.
- `data/paper-seo.generated.json`: generated per-paper SEO metadata.
- `scripts/validate-site.js`: structural/data consistency validation.
- `scripts/acceptance-check.js`: acceptance smoke checks.
- `scripts/build-site-data.js`: generate/check derived data from `site-master.json`.
- `scripts/sync-paper-seo.js`: sync per-paper SEO blocks into HTML pages.
- `scripts/enrich-metadata.js`: auto-enrich DOI/arXiv metadata cache.
- `scripts/check-contrast.js`: WCAG AA color contrast checks.
- `scripts/generate-paper-toc.js`: TOC cache generator/checker.
- `scripts/run-lighthouse-check.js`: Lighthouse performance/accessibility gate.
- `tests/ui/regression.spec.js`: Playwright UI regression tests.
- `tests/ui/accessibility.spec.js`: Playwright + axe accessibility tests.
- `tests/ui/visual.spec.js`: Playwright screenshot baseline tests.

## Local Development

### 1) Install tooling
```bash
npm install
npx playwright install chromium
```

### 2) Run quality checks
```bash
node scripts/validate-site.js
node scripts/build-site-data.js --check
node scripts/sync-paper-seo.js --check
node scripts/generate-paper-toc.js --check
node scripts/acceptance-check.js
npm run check:contrast
npm run test:ui
npm run test:a11y
npm run test:visual
npm run lighthouse
```

### 3) Build generated artifacts from the master data source
```bash
node scripts/build-site-data.js --write
node scripts/sync-paper-seo.js --write
node scripts/generate-paper-toc.js --write
```

### 4) Enrich DOI/arXiv metadata cache
```bash
node scripts/enrich-metadata.js --write-cache
# Optional: apply detected missing DOI/arXiv links into site-master.json
node scripts/enrich-metadata.js --write-cache --apply
```

## Backup And Restore
- Backup script: `scripts/ops/backup-homepage.sh`
- Restore script: `scripts/ops/restore-homepage.sh`

Examples:
```bash
./scripts/ops/backup-homepage.sh
./scripts/ops/restore-homepage.sh --backup /path/to/backup-dir
```

## Release And Rollback
- Release helper: `scripts/release.sh`
- Manual release workflow: `.github/workflows/release-automation.yml`
- Process guide: `docs/RELEASE_ROLLBACK.md`
- QA checklist: `docs/QA_CHECKLIST.md`
- Changelog: `CHANGELOG.md`
