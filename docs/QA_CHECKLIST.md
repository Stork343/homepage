# QA Checklist

## Automatic Gates
- `node scripts/validate-site.js`
- `node scripts/generate-paper-toc.js --check`
- `node scripts/acceptance-check.js`
- `npm run test:ui`
- `npm run lighthouse`

## Manual Checks
- Home page dark mode toggles correctly and persists after refresh.
- Paper page dark mode follows the same theme state.
- HCQR/SVCQR TOC entries jump to matching section pages.
- Chinese mode keeps SCI paper title in original English.
- English mode shows English profile name and English publication metadata.
