# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- One-click citation format switching (default / APA / GB/T 7714) on publication cards.
- Footer visitor statistics via Plausible (cookieless, accurate unique visitors) refreshed by a scheduled workflow.
- Automatic publication PDF guard: unpublished entries are stripped of PDF/full-text links, and the validator rejects any unreferenced PDF in `papers/`.
- Automatic last-updated date (`data/site-updated.generated.json`) and content-hash version tags for CSS/JS.
- Cross-platform static dev server (`scripts/serve.js`) used by Playwright.
- Ready-to-use auto-sync workflow template under `docs/workflows/`.
- Bilingual footer and skip-link copy.
- Education timeline in the About section.
- Automated UI regression tests with Playwright for dark mode persistence, TOC navigation, and language display rules.
- One-command backup and restore scripts under `scripts/ops/`.
- Release helper script `scripts/release.sh` with pre-release checks.
- Lighthouse performance/accessibility gate script.

### Changed
- Consolidated `enhanced-main.css` (removed ~2000 lines of duplicated/overridden rules) with browser-verified identical rendering.
- Updated JRSS-C manuscript entry (title, venue, status, PDF removed until publication).
- Switched manuscript thumbnails to official journal covers and compressed images (webp variants, smaller avatar).
- Contact section merged into a single mailbox entry with three addresses.
- Remote tracking switched to HTTPS for reliable pushes in this environment.
- Paper reader now supports pre-generated TOC cache for faster and more stable section navigation.
- CI pipeline expanded with acceptance checks, TOC cache freshness checks, UI tests, and Lighthouse gates.
- Compressed SVCQR PDF from ~17 MB to ~3.8 MB (image re-encoding, text layer preserved).
- Renamed `site-master.json` `updated` to `data_version` and refreshed the DOI/arXiv metadata cache.

### Fixed
- Visual regression tests now skip on non-macOS platforms until Linux baselines are regenerated (current baselines are macOS-only).
- `papers/README.md` maintenance instructions now point to `data/site-master.json`.
- OneDrive sync artifacts guarded via `.gitignore` (`*MacBook*`).
- SVCQR local PDF corruption issue; repository now uses full 52-page PDF.
- Removed a spurious Crossref DOI match for the unpublished JRSS-C manuscript.

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
