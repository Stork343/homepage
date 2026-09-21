# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- One-click citation format switching (default / APA / GB/T 7714) on publication cards.
- Footer pageview counter via busuanzi; the unreliable unique-visitor metric was removed.
- Automatic publication PDF guard: unpublished entries are stripped of PDF/full-text links, and the validator rejects any unreferenced PDF in `papers/`.
- Automatic last-updated date (`data/site-updated.generated.json`) and content-hash version tags for CSS/JS.
- Cross-platform static dev server (`scripts/serve.js`) used by Playwright.
- Auto-sync GitHub workflow (`.github/workflows/auto-sync-generated.yml`) that regenerates derived data and SEO blocks after each push to `main`.
- Bilingual footer and skip-link copy.
- Education timeline in the About section.
- Automated UI regression tests with Playwright for dark mode persistence, TOC navigation, and language display rules.
- One-command backup and restore scripts under `scripts/ops/` (maintainer-local only; no longer distributed with the public repository).
- Release helper script `scripts/release.sh` with pre-release checks.
- Lighthouse performance/accessibility gate script.
- Whitelisted GitHub Pages deployment workflow (`.github/workflows/deploy-pages.yml`): validates data/structure/contrast, assembles `_site` from runtime-only artifacts, and fails before upload on any out-of-whitelist path, script, `.Rmd` source, non-whitelisted PDF, or hidden-entry mention. Requires a one-time manual switch of the Pages source to "GitHub Actions" (pending as of this writing).
- "No local fulltext" degraded state for the four CNKI-published reader pages: pages declare `window.__PAPER_NO_LOCAL_FULLTEXT__ = true`, and `paper-reader.js` renders a notice panel with the official channels (DOI / CNKI landing page / code repository) from `data/site-master.json`, disables PDF-dependent controls, and removes the download entry; the contract is enforced by `validate-site.js`, `acceptance-check.js`, and dedicated regression tests (including a reverse guard for the two open-access pages).
- Self-maintaining JS syntax gate `scripts/check-syntax.js`: scans `scripts/`, `papers/shared/`, `tests/ui/`, plus `playwright.config.js`, instead of a hardcoded file list in `package.json`.
- Viewport-sized homepage visual baseline (`homepage-viewport-chromium-darwin.png`, 1440×1024, decoupled from total page height) with an `UPDATE_MAIN_BASELINE=1` regeneration mode; `paper-topbar` / `paper-sidebar` baselines re-recorded after the reader chrome fix.
- Behavior-level regression tests for the reader chrome (download link, theme toggle, fit-width/fit-page and their W/F shortcuts) and content-level assertions for BibTeX/RIS/EndNote exports.
- Fulltext distribution policy table and reader contracts documented in `papers/README.md`.
- `validate-site.js` now parses PNG/JPEG/WebP headers in pure JS (no `sips`/ImageMagick, so it behaves identically on ubuntu CI and macOS) and asserts that each cover's declared `width`/`height` equals the real pixel size and that the webp variant matches the primary image; cross-validated against `sips` on all 46 repository images.
- `validate-site.js` enforces a `data/` directory allowlist, turning silently-ignored OneDrive conflict copies into a hard failure.
- `enrich-metadata.js --check` performs a real offline comparison of the metadata cache against the SSOT (zero network requests) and exits non-zero on missing entries, orphan entries, or DOI drift; DOI comparison normalises both the `doi.org` and `link.cnki.net/doi/` proxy prefixes.

### Changed
- Consolidated `enhanced-main.css` (removed ~2000 lines of duplicated/overridden rules) with browser-verified identical rendering.
- Updated JRSS-C manuscript entry (title, venue, status, PDF removed until publication).
- Switched manuscript thumbnails to official journal covers and compressed images (webp variants, smaller avatar).
- Contact section merged into a single mailbox entry with three addresses.
- Remote tracking uses SSH (`git@github.com:Stork343/homepage.git`), matching the current working copy.
- Paper reader now supports pre-generated TOC cache for faster and more stable section navigation.
- CI pipeline expanded with acceptance checks, TOC cache freshness checks, UI tests, and Lighthouse gates.
- Compressed SVCQR PDF from ~17 MB to ~3.8 MB (image re-encoding, text layer preserved).
- Renamed `site-master.json` `updated` to `data_version` and refreshed the DOI/arXiv metadata cache.
- CVs are no longer downloadable: the `cv/` directory (PDFs and sources) was removed and the homepage CV section is now a single email-request card; the CV "updated date" line was dropped as meaningless.
- Footer last-updated date is templated at runtime from `data/site-updated.generated.json` through the i18n layer, instead of falling back to a static literal.
- Visual regression spec rewritten: the full-page homepage snapshot (structurally red on every content addition — 15 consecutive CI failures) was replaced by a viewport-sized baseline plus layout-invariant assertions, and reader snapshots now wait for the rebuilt runtime chrome (`.tf-side-rail`) instead of the static markup.
- `scripts/check-contrast.js` rewritten from hardcoded expectations into a real CSS parser: it resolves 24 color pairs (including `rgba()` blends, cascade order, and light/dark `:root` merging) from `enhanced-main.css`, `papers/shared/paper-theme.css`, and `notes/style.css`; any pair that cannot be resolved to real color values is a FAIL.
- Publication author-link colors darkened to meet WCAG AA in all six light/dark × normal/hover/focus states (three states previously measured 3.12–3.85:1).
- `npm run check:data` now also runs `sync-paper-seo.js --check`, aligning the local gate with CI.
- GitHub workflows hardened: minimal `permissions` everywhere (`site-checks.yml` was the last workflow without any), per-job `timeout-minutes`, every action pinned to a commit SHA, and `htmlhint` pinned to 1.9.2.
- `auto-sync-generated.yml` stages an explicit whitelist of generated outputs instead of `git add -A`, fails if a generator touched the SSOT `data/site-master.json`, and retries pushes with `git pull --rebase` (up to 3 attempts) with explicit failure reporting.
- `release-automation.yml` passes dispatch inputs through `env` (eliminating the shell-injection anti-pattern), validates the tag shape (`vYYYY.MM.DD`), and joined the `main-writers` concurrency group.
- `build-bookdown-notes.yml` clears `_book` before rendering so orphaned figures from renamed chunks can no longer accumulate, and its push now has rebase retries.
- `scripts/release.sh` runs `test:visual` only on macOS; other platforms print an explicit skip reason instead of passing an all-skipped (empty-green) gate — the real visual gate is the `visual-regression` job on `macos-latest` in `site-checks.yml`.
- Shared reader assets (`paper-reader.js`, `paper-theme.css`) get their `?v=` cache strings content-hashed by `build-site-data.js` (previously hand-maintained and stale, so fixes never reached returning visitors).
- Internal ops/audit material is no longer distributed with the public repository: `docs/` and `scripts/ops/` were removed from version control (files kept on the maintainer machine, anchored entries added to `.gitignore`), and personal information in the 2026-09-18 audit report was redacted.
- Primary working copy moved out of the OneDrive sync folder to `~/dev/homepage` on the local disk; the sync-folder copy was retired after its `.git` was corrupted by the sync client.
- The `qvsd-spatiotemporal-extremes` journal cover was upgraded to 400×521 and wired into the `<picture>` element with a matching webp variant (the browser now fetches only the webp, saving ~18 KB per view); its declared dimensions were corrected from 223×330, which had disagreed with the real image and caused layout shift.
- `generate-paper-toc.js` is validator-only: `data/paper-toc.generated.json` has a single writer (`build-site-data.js`), `--write` is rejected with a pointer to it, and the date fallback now matches `build-site-data.js` exactly so the two can no longer declare each other OUTDATED when `data_version` is empty.
- `acceptance-check.js` asserts that the paper-page id set equals the `paper_page` ids declared in `site-master.json` (naming any missing/unexpected id) instead of hardcoding a count of 6; its four `[MANUAL]` lines are relabelled `Automated elsewhere` and name the covering Playwright tests.
- The `ui-regression` CI job runs only `tests/ui/regression.spec.js`, giving a 1:1 split with `a11y-check` and `visual-regression` instead of re-running the accessibility spec and launching a browser for tests that skip on Linux.

### Fixed
- Visual regression tests now skip on non-macOS platforms until Linux baselines are regenerated (current baselines are macOS-only).
- `papers/README.md` maintenance instructions now point to `data/site-master.json`.
- OneDrive sync artifacts are now caught loudly instead of silently ignored: the unanchored `*MacBook*` and vestigial `*~product.css` rules were removed from `.gitignore` (the former also swallowed legitimate names such as `docs/macbook-setup.md`, `MACBOOK.md` and `notes/MacBook-notes.Rmd` on a case-insensitive filesystem), and `validate-site.js` now fails on any unplanned file under `data/`.
- SVCQR local PDF corruption issue; repository now uses full 52-page PDF.
- Removed a spurious Crossref DOI match for the unpublished JRSS-C manuscript.
- Reader chrome controls (PDF download, dark/light toggle, fit-width, fit-page with W/F shortcuts) were silently destroyed by the topbar `innerHTML` rebuild — five element IDs went missing and every lookup was skipped by null guards; the controls are restored and covered by behavior-level tests.
- Chinese reader pages showed empty abstract/TOC sidebars: section detection only matched English headings (`Abstract`/`Content`), so author-written 摘要/目录 content was destroyed by the chrome rebuild and never re-rendered; detection is now structure-based and Chinese headings are supported.
- `scripts/serve.js`: directory containment is now checked with `path.relative` (a sibling directory sharing the repo's name prefix was previously readable — demonstrated with real HTTP probes), malformed percent-encoding returns 400 instead of crashing the process with an uncaught `URIError`, and file streams got error handlers.
- `enrich-metadata.js` no longer accepts weak Crossref matches as real DOIs. A substring title match unconditionally scored 0.86 (above the 0.72 acceptance threshold) and undated candidates escaped the year penalty entirely, so an encyclopaedia entry for "WET-BULB TEMPERATURE" (`10.1615/atoz.w.wet-bulb_temperature`) was attached to an unrelated Annals of Applied Statistics paper and would have been published as a clickable DOI and JSON-LD `identifier`. Substring scores are now scaled by length ratio and undated candidates are penalised; replaying the real 8 Crossref candidates drops that hit from 0.860 to 0.020 while identical titles still score 1.0.
- `enrich-metadata.js` network calls have a 20 s `AbortSignal.timeout` (overridable via `METADATA_FETCH_TIMEOUT_MS`); previously a stalled Crossref/arXiv response blocked the whole serial enrichment run indefinitely.
- Refreshed the DOI/arXiv metadata cache (14 → 16 entries): no existing DOI was lost, two legitimate DOIs were added, and `qvsd-spatiotemporal-extremes` gained a verified arXiv id whose title matches the site entry exactly.

### Removed
- Four CNKI publisher-typeset fulltext PDFs (~4.9 MB total: `mgtwr.pdf`, `gtwr.pdf`, `bgtwr.pdf`, `poisson-rr.pdf`): redistributing publisher typesetting on a public site risked a takedown that could restrict the whole Pages deployment. The reader pages stay (abstracts/TOCs/metadata are author-written); fulltexts are reached via official links.
- 18 zero-reference files (~1.47 MB), each verified dead by a repo-wide filename search: `icon/google.png`, the orphaned stylesheet `papers/shared/reader.css`, 6 orphaned bookdown figures under `notes/_book/`, and 10 unreferenced images under `papers/` (two of the webp variants were even larger than their source images).
- `data/search-index.generated.json` (18.8 KB) together with its generator `buildSearchIndex()` and every reference to it: nothing fetched it at runtime (site search is computed in memory from `publications.json`), and its only validation was a same-source count comparison that could never fail. `deploy-pages.yml` keeps the path on its forbidden list as a do-not-resurrect tripwire.
- The `toc:build` npm script and the `generate-paper-toc.js --write` step in `auto-sync-generated.yml` (both wrote a file `build-site-data.js` already writes).

### Security
- Stopped exposing build inputs and internal documents on the public Pages domain (branch deployment previously published the entire working tree): the SSOT `data/site-master.json` (which includes a hidden, unpublished entry), dead generated artifacts, `.Rmd` sources and `book.bib`, `beamer_presentation.tex`, build tools, tests, manifests, `docs/`, and `scripts/ops/` are all excluded from the deployed set by `deploy-pages.yml`, which asserts their absence before upload.
- `site-checks.yml` no longer hands a potentially writable `GITHUB_TOKEN` to its six read-only jobs (including a third-party link-check action); top-level `permissions: contents: read`.
- Removed the script-injection anti-pattern from `release-automation.yml`: raw `workflow_dispatch` input was interpolated directly into a shell command line and into artifact paths; it is now passed via `env`, quoted, and shape-validated.
- Release automation no longer publishes `rollback-main.bundle` (~70 MB of full `main` history) as a GitHub Release asset and workflow artifact on a public repository. The bundle is still produced for the maintainer's own rollback, but into a sibling directory (`release-artifacts/<tag>-rollback/`) that no upload path covers.

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
