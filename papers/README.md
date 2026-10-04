# Papers Directory Layout

This directory is organized by publication year and paper id:

- `papers/<year>/<paper-id>/`
  - paper reader page (`*.html`) — only for papers that have one
  - cover / figure images (`*.jpg`, `*.jpeg`, `*.png`, `*.webp`)
  - local fulltext (`*.pdf`) — **only for the two open-access papers**, see below
- `papers/shared/`
  - `paper-reader.js` — reader runtime shared by every reader page
  - `paper-theme.css` — reader theme; the single source of truth for the
    `--tf-*` colour variables that `scripts/check-contrast.js` resolves
  - `paper-page.css` — page-layout stylesheet shared by every reader page
    (extracted byte-identically from the six pages' formerly duplicated
    inline `<style>` blocks; layout fixes now land once instead of six
    times, and the runtime sidebar rebuild no longer discards them)
  - `vendor/pdfjs-4.6.82/` — the PDF.js runtime (build, viewer, cmaps,
    standard fonts) vendored from the official `pdfjs-dist` npm tarball so
    reader pages load everything same-origin instead of from
    cdn.jsdelivr.net (intermittently unreachable in mainland China). The
    version-suffixed directory name doubles as the cache-buster when the
    library is upgraded: replace the directory, update the four paths in
    `paper-reader.js` plus the `pdf_viewer.css` link in the reader pages.

All four shared runtime files are content-hashed into the `?v=` query string
of the six reader pages by `scripts/build-site-data.js` (together with
`fonts/fonts.css`, which the reader pages reference via `../../../fonts/`),
so editing any of them and forgetting to re-run the generator is caught by
`npm run check:data`.

Images used only by the local Beamer deck (`beamer_presentation.tex`) live
in `deck-assets/` at the repository root, **not** here: this directory is
copied wholesale into the deploy artifact, and `scripts/validate-site.js`
fails on any image under `papers/` that no site file or data entry
references, so deck-only assets cannot silently re-enter the published
surface.

## Fulltext policy

Only papers whose licence permits redistribution keep a local PDF:

| Paper | Local fulltext |
| --- | --- |
| `2025/hcqr` | `hcqr.pdf` (open access) |
| `2025/svcqr` | `svcqr.pdf` (open access) |
| `2021/mgtwr-variable-selection` | none — CNKI published |
| `2022/bgtwr-housing` | none — CNKI published |
| `2022/gtwr-housing` | none — CNKI published |
| `2025/poisson-rr` | none — CNKI published |

**Do not add a publisher-typeset PDF (CNKI, Elsevier, Springer, …) to this
repository.** The four CNKI papers instead declare

```js
window.__PAPER_NO_LOCAL_FULLTEXT__ = true;
```

which makes `paper-reader.js` render a degraded state: no PDF viewer, and the
official channels (DOI / CNKI landing page / code repository) taken from
`links` in `data/site-master.json`. `scripts/validate-site.js` fails the build
on any unreferenced or non-published PDF, so a re-added publisher PDF is
caught in CI rather than after publication.

## Current Structure

- `2021/` — `mgtwr-variable-selection/`
- `2022/` — `bgtwr-housing/`, `gtwr-housing/`
- `2025/` — `hcqr/`, `jpdi-mixed-qr/`, `mallows-llm-ranking/`, `plgwqr/`,
  `poisson-rr/`, `snqesa/`, `svcqr/`
- `2026/` — `qapsm-icu-bp/`, `qtr-oc/`, `qvsd-spatiotemporal-extremes/`,
  `salcdi-scarce-outcomes/`, `toms-sssvcqr/`, `tplaqr/`
- `shared/` — `paper-reader.js`, `paper-theme.css`, `paper-page.css`,
  `vendor/pdfjs-4.6.82/`

Directories without a reader page hold cover or figure images only.

## Maintenance Rule

When adding a new paper:

1. Create `papers/<year>/<paper-id>/`.
2. Put the cover image (and, only if the licence allows, the PDF) in it.
3. Add the paper entry to `data/site-master.json` — including `paper_page`
   if it gets a reader page, and `links.doi` / `links.article` / `links.code`
   so the degraded state has official channels to point at.
4. Regenerate derived data and re-sync the SEO block:
   ```sh
   node scripts/build-site-data.js --write
   node scripts/sync-paper-seo.js --write
   ```
5. Verify before committing:
   ```sh
   npm run check:data && npm run check:acceptance
   ```

If the new page is one of the six reader pages, `npm run check:data` also
guards the `?v=` asset hashes; a stale hash fails the gate.
