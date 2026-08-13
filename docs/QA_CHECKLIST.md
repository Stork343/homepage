# QA Checklist

## Automatic Gates
- `node scripts/build-site-data.js --check`
- `node scripts/sync-paper-seo.js --check`
- `node scripts/validate-site.js`
- `node scripts/generate-paper-toc.js --check`
- `node scripts/acceptance-check.js`
- `npm run check:contrast`
- `npm run test:ui`
- `npm run test:a11y`
- `npm run test:visual`
- `npm run lighthouse`
- `scripts/validate-site.js` rejects unpublished papers exposing PDF/full-text links and any unreferenced PDF under `papers/`.
- Citation format selector renders on every publication card; APA and GB/T 7714 copies match the expected format.
- Footer visitor stats containers render from `data/visitor-stats.generated.json`; page/CV dates follow `data/site-updated.generated.json`.

## Manual Checks
- Home page dark mode toggles correctly and persists after refresh.
- Paper page dark mode follows the same theme state.
- HCQR/SVCQR TOC entries jump to matching section pages.
- Chinese mode keeps SCI paper title in original English.
- English mode shows English profile name and English publication metadata.
- Citation export center can export BibTeX/RIS/EndNote for full and filtered result sets.
