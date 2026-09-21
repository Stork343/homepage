# Academic Homepage

## Overview
This repository hosts a bilingual personal academic homepage and six paper reader subpages.
Two open-access papers load their local PDFs in the integrated reader; the four CNKI-published
papers render a degraded "no local fulltext" state that points to the official channels
(publisher DOI / CNKI landing page / code repository) — see **Fulltext Distribution Policy** below.

## Working Copy
- The only working copy is `~/dev/homepage` on the maintainer's macOS machine (a plain clone on the local disk).
- The former copy inside the OneDrive sync folder has been **retired**: the sync client corrupted its `.git`, and the directory is being renamed to `homepage.OLD-corrupt` for cold storage. Never run git commands, builds, or tests inside a cloud-synced folder.
- `docs/` and `scripts/ops/` are deliberately **not tracked** (anchored entries in `.gitignore`): this repository is public, and those internal audit/ops materials (host directory layout, service labels, LAN preview details, CI runner config) must not be distributed. They exist only on the maintainer's machines; use a separate private repository if they need version control.

## Key Features
- Homepage with Chinese/English switching and dark mode persistence.
- Site-wide publication search by title, author, keywords, year, venue, and status (runs in memory over `data/publications.json`).
- Citation export center for BibTeX / RIS / EndNote (all records or current filtered subset).
- Paper reader with sidebar metadata, TOC jump, search, print, fullscreen, and deep-link page query sync; pages without a redistributable PDF degrade to an official-links notice with PDF-only controls disabled.
- SCI paper TOC pre-generated cache (`data/paper-toc.generated.json`) plus runtime fallback extraction.
- Single-source data workflow: `data/site-master.json` generates all downstream data and sitemap artifacts.
- Automated paper SEO metadata sync for each paper page (`SEO:BEGIN` / `SEO:END` blocks).
- CV by email request (the former downloadable CV PDFs were removed; the homepage CV section is now a mailto request card).

## Repository Layout
- `index.html`: homepage.
- `enhanced-main.css`: homepage styles.
- `scripts/main.js`: homepage interactions; the only script shipped to the published site.
- `data/site-master.json`: hand-maintained single source of truth (SSOT) for publications and paper-page mappings; generators must never modify it.
- Generated from the SSOT by `scripts/build-site-data.js`:
  - `data/publications.json`: publication metadata fetched by the homepage at runtime.
  - `data/paper-pages.json`: generated paper-page configuration fetched by the reader pages at runtime (not a hand-edited file).
  - `data/paper-toc.generated.json`: pre-generated TOC cache.
  - `data/publications-jsonld.generated.json`: generated homepage JSON-LD payload.
  - `data/site-updated.generated.json`: generated last-updated date consumed by the footer.
  - `data/paper-seo.generated.json`: generated per-paper SEO metadata behind the `SEO:BEGIN` / `SEO:END` blocks.
  - `sitemap.xml` and the `?v=` content hashes in `index.html` and in the six reader pages (shared reader assets included).
- `data/metadata-cache.generated.json`: DOI/arXiv metadata cache maintained by `scripts/enrich-metadata.js`. Run `npm run metadata:enrich` to refresh it (writes) and `node scripts/enrich-metadata.js --check` to compare it against the SSOT offline (no network, exits non-zero on drift).
- `papers/*/*/*.html`: paper reader pages (six); `papers/README.md` documents the directory layout and the fulltext policy.
- `papers/shared/paper-reader.js`: shared reader runtime (PDF.js integration, degraded state, exports).
- `papers/shared/paper-theme.css`: shared reader theme; single source of truth for the `--tf-*` color variables resolved by the contrast gate.
- `scripts/serve.js`: cross-platform static dev server with directory-containment and malformed-URL guards; also Playwright's `webServer` (default port 4173).
- `scripts/validate-site.js`: structural/data consistency validation, including the fulltext policy guard.
- `scripts/acceptance-check.js`: acceptance smoke checks.
- `scripts/build-site-data.js`: generate/check derived data from `site-master.json`.
- `scripts/sync-paper-seo.js`: sync per-paper SEO blocks into HTML pages.
- `scripts/enrich-metadata.js`: auto-enrich DOI/arXiv metadata cache.
- `scripts/check-contrast.js`: WCAG AA color contrast gate; resolves every declared color pair from the real CSS files at runtime and fails on anything unresolvable (no hardcoded expectations).
- `scripts/check-syntax.js`: self-maintaining JS syntax gate; scans `scripts/`, `papers/shared/`, `tests/ui/`, plus `playwright.config.js`.
- `scripts/generate-paper-toc.js`: validator-only cross-check of `data/paper-toc.generated.json` (independently recomputes it and compares byte-for-byte; `build-site-data.js` is the sole writer).
- `scripts/run-lighthouse-check.js`: Lighthouse performance/accessibility gate (serves the site with `python3 -m http.server` on port 4174).
- `scripts/release.sh`: release helper (tag + rollback artifacts + re-run gates).
- `playwright.config.js`: Playwright configuration (webServer `scripts/serve.js`, port 4173; non-CI runs use the system Google Chrome via `channel: 'chrome'`).
- `tests/ui/regression.spec.js`: Playwright UI regression tests (reader chrome, degraded pages, exports, language rules, dark mode).
- `tests/ui/accessibility.spec.js`: Playwright + axe accessibility tests.
- `tests/ui/visual.spec.js`: Playwright screenshot baseline tests; darwin-only baselines (viewport-sized homepage baseline plus navbar and reader topbar/sidebar).
- `notes/`: bookdown notes sub-site; the rendered `notes/_book/` output is committed and served.
- `.github/workflows/`: `site-checks.yml` (six gate jobs on push/PR), `auto-sync-generated.yml`, `build-bookdown-notes.yml`, `release-automation.yml`, `deploy-pages.yml` (whitelisted Pages deployment).

## Local Development

### 1) Install tooling
```bash
npm ci
npx playwright install chromium
```
Playwright uses the system Google Chrome locally (`channel: 'chrome'` in `playwright.config.js`).
If Chrome is not installed, run tests with `CI=1` to use the bundled chromium instead.

### 2) Preview
```bash
node scripts/serve.js            # http://127.0.0.1:4173 (optional port argument)
```

### 3) Run quality checks
```bash
npm run check:syntax        # node --check over all project JS (file list self-maintained)
npm run check:data          # build-site-data --check + validate-site + generate-paper-toc --check + sync-paper-seo --check
npm run check:contrast      # WCAG AA pairs resolved from the real CSS; unresolvable = FAIL
npm run check:acceptance    # acceptance smoke checks
npm run test:ui             # all three Playwright specs (regression + a11y + visual)
npm run test:ui:core        # regression + accessibility only
npm run test:a11y           # accessibility spec only
npm run test:visual         # macOS only; auto-skipped on other platforms (darwin-only baselines)
npm run lighthouse          # requires python3; local server on port 4174
```

### 4) Build generated artifacts from the master data source
```bash
node scripts/build-site-data.js --write   # also refreshes ?v= hashes for index.html and reader assets
node scripts/sync-paper-seo.js --write
```
`data/paper-toc.generated.json` is written by `build-site-data.js` as well; `scripts/generate-paper-toc.js` is validator-only and rejects `--write`.

### 5) Enrich DOI/arXiv metadata cache
```bash
node scripts/enrich-metadata.js --write-cache
# Optional: apply detected missing DOI/arXiv links into site-master.json
node scripts/enrich-metadata.js --write-cache --apply
```

## Fulltext Distribution Policy

Only papers whose licence permits redistribution keep a local PDF:

| Reader page | Local fulltext |
| --- | --- |
| `papers/2025/svcqr/` | `svcqr.pdf` (open access) |
| `papers/2025/hcqr/` | `hcqr.pdf` (open access) |
| `papers/2021/mgtwr-variable-selection/` | none — CNKI published |
| `papers/2022/gtwr-housing/` | none — CNKI published |
| `papers/2022/bgtwr-housing/` | none — CNKI published |
| `papers/2025/poisson-rr/` | none — CNKI published |

The four CNKI-published pages declare `window.__PAPER_NO_LOCAL_FULLTEXT__ = true`, which makes
`papers/shared/paper-reader.js` render a degraded state: no PDF viewer, PDF-dependent controls
disabled, the download entry removed, and a 「本站未存档全文」 panel listing the official channels
(DOI / CNKI landing page / code repository) taken from `links` in `data/site-master.json`.
Author-written abstracts, TOCs, and metadata remain fully readable, and the theme toggle still works.

**Never add a publisher-typeset PDF (CNKI, Elsevier, Springer, …) to this repository.**
`scripts/validate-site.js` rejects any PDF under `papers/` that is not referenced by a published
entry, and `deploy-pages.yml` additionally fails the build on any non-whitelisted PDF, so a
re-added publisher fulltext is caught in CI rather than after publication.

## Deployment (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds a **whitelisted** artifact and deploys it through
GitHub Actions instead of publishing the whole branch tree:

- Pre-publish validation: `build-site-data.js --check`, `validate-site.js`, `check-contrast.js` (node built-ins only, no `npm ci` needed).
- `_site` contains only what the runtime actually uses: `index.html`, `enhanced-main.css`, `robots.txt`, `sitemap.xml`, avatar images, `.nojekyll`, `scripts/main.js`, the five runtime JSON files under `data/` (`publications`, `paper-pages`, `paper-toc.generated`, `publications-jsonld.generated`, `site-updated.generated`), `icon/`, the paper reader pages (with the two open-access PDFs), and the rendered `notes/_book/`.
- Before upload the workflow self-checks for leaks and fails the build on: any out-of-whitelist path (SSOT `site-master.json`, build-only/dead artifacts, `.Rmd` sources, `beamer_presentation.tex`, `tests/`, `.github/`, `docs/`, `scripts/ops/`, `README.md`, `CHANGELOG.md`, package manifests, `playwright.config.js`), any script other than `main.js`, any non-whitelisted PDF, or any mention of hidden (unpublished) entries in published output.
- Least privilege: `contents: read` + `pages: write` + `id-token: write`; `concurrency` group `pages` with `cancel-in-progress: false` (never leaves the site half-published).

> **待办（需作者手动完成）**: switch the repository's **Settings → Pages → Build and
> deployment → Source** to **"GitHub Actions"**. Until that switch, Pages still serves the
> branch tree and this workflow only builds/uploads the artifact without taking effect —
> use that phase to review the printed `_site` manifest first.

## Backup And Restore
> 运维脚本（`scripts/ops/`，含 `backup-homepage.sh` / `restore-homepage.sh` / `local-ci.sh` /
> `macmini-bootstrap.sh`）与内部审计 / 流程文档（`docs/`）**不在本仓库内**。
> 本仓库是公开的，这些资料含主机目录结构、launchd 标签、局域网预览端口等运维
> 细节，现仅保留在维护者本机（见 `.gitignore`）；如需版本管理请放入独立私有仓库。
>
> 站点内容本身的备份等价于克隆本仓库；`data/*.generated.json`、`sitemap.xml`
> 等生成物可随时由 `node scripts/build-site-data.js --write` 重建。

## Release And Rollback
- Release helper: `scripts/release.sh` (tags must match `vYYYY.MM.DD`; the workflow validates the shape).
- Manual release workflow: `.github/workflows/release-automation.yml` (dispatch inputs are passed via `env`, never interpolated into shell).
- `release.sh` runs the visual gate only on macOS; on other platforms it prints an explicit skip reason (the real visual gate is the `visual-regression` job on `macos-latest` in `site-checks.yml`).
- Changelog: `CHANGELOG.md`
- 流程指南与 QA 清单（`docs/RELEASE_ROLLBACK.md`、`docs/QA_CHECKLIST.md`）为维护者本机文档，不在本仓库内。

## Auto-Sync Generated Data Workflow

`.github/workflows/auto-sync-generated.yml` regenerates all derived data and
commits any changes after every push to `main`, so generated artifacts and the
last-updated date stay current without manual rebuilds. It stages only an explicit
whitelist of generated outputs (plus the six reader pages via `git ls-files`) — never
`git add -A` — fails if a generator touched the SSOT `data/site-master.json`, and
retries with `git pull --rebase` up to 3 times on push races. Note: bot pushes made
with `GITHUB_TOKEN` do not trigger `deploy-pages.yml` (GitHub's recursion protection);
the site redeploys on the next manual push or a `workflow_dispatch` of the deploy workflow.
