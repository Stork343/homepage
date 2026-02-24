# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Automated UI regression tests with Playwright for dark mode persistence, TOC navigation, and language display rules.
- One-command backup and restore scripts under `scripts/ops/`.
- Release helper script `scripts/release.sh` with pre-release checks.
- Lighthouse performance/accessibility gate script.

### Changed
- Paper reader now supports pre-generated TOC cache for faster and more stable section navigation.
- CI pipeline expanded with acceptance checks, TOC cache freshness checks, UI tests, and Lighthouse gates.

### Fixed
- SVCQR local PDF corruption issue; repository now uses full 52-page PDF.

## [2026-02-25]
### Added
- Single-source data workflow via `data/site-master.json` and generator `scripts/build-site-data.js`.
- Generated artifacts: search index, homepage JSON-LD, per-paper SEO metadata, and sitemap.
- Citation export center (BibTeX / RIS / EndNote) with full or filtered scope.
- DOI/arXiv metadata enrichment script `scripts/enrich-metadata.js`.
- Accessibility checks with axe (`tests/ui/accessibility.spec.js`) and WCAG contrast gate (`scripts/check-contrast.js`).
- Visual regression baseline tests (`tests/ui/visual.spec.js`).
- Manual release workflow `.github/workflows/release-automation.yml` with rollback artifact generation.

### Changed
- Publication filters expanded to title/author/keywords/year/venue/status for site-wide academic search.
- Per-paper HTML pages now include generated SEO meta + `ScholarlyArticle` JSON-LD blocks.
- Release script now performs end-to-end checks, changelog generation, and rollback point bundling.
- CI pipeline now validates generated data/SEO sync and runs a11y + visual regression gates.

## [2026-02-24]
### Added
- Taylor & Francis-inspired style alignment and dark mode improvements.
- Unified paper page reader and metadata/config consistency checks.

### Changed
- Homepage publications grouped by year, with filters and bilingual rendering behavior rules.
- SCI paper pages now support automatic TOC generation with fallback strategies.
