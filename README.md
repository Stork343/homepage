# Academic Homepage

## Overview
This repository hosts a bilingual personal academic homepage and six local paper subpages with an integrated PDF reader.

## Key Features
- Homepage with Chinese/English switching and dark mode persistence.
- Publications grouped by year with search/filter support.
- Paper reader with sidebar metadata, TOC jump, search, print, fullscreen, and deep-link page query sync.
- SCI paper TOC pre-generated cache (`data/paper-toc.generated.json`) plus runtime fallback extraction.

## Repository Layout
- `index.html`: homepage.
- `enhanced-main.css`: homepage styles.
- `scripts/main.js`: homepage interactions.
- `papers/*/*/*.html`: paper subpages.
- `papers/shared/paper-reader.js`: shared PDF reader logic.
- `data/publications.json`: publication metadata.
- `data/paper-pages.json`: paper page configuration.
- `data/paper-toc.generated.json`: pre-generated TOC cache.
- `scripts/validate-site.js`: structural/data consistency validation.
- `scripts/acceptance-check.js`: acceptance smoke checks.
- `scripts/generate-paper-toc.js`: TOC cache generator/checker.
- `scripts/run-lighthouse-check.js`: Lighthouse performance/accessibility gate.
- `tests/ui/regression.spec.js`: Playwright UI regression tests.

## Local Development

### 1) Install tooling
```bash
npm install
npx playwright install chromium
```

### 2) Run quality checks
```bash
node scripts/validate-site.js
node scripts/generate-paper-toc.js --check
node scripts/acceptance-check.js
npm run test:ui
npm run lighthouse
```

### 3) Rebuild TOC cache
```bash
node scripts/generate-paper-toc.js --write
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
- Process guide: `docs/RELEASE_ROLLBACK.md`
- QA checklist: `docs/QA_CHECKLIST.md`
- Changelog: `CHANGELOG.md`
