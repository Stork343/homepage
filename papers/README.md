# Papers Directory Layout

This directory is organized by publication year and paper id:

- `papers/<year>/<paper-id>/`
  - paper viewer page (`*.html`)
  - paper file (`*.pdf`, if local)
  - cover/figure images (`*.png`, `*.jpeg`, `*.webp`)
- `papers/shared/`
  - shared resources used by paper pages

## Current Structure

- `2025/`
  - `mallows-llm-ranking/`
  - `jpdi-mixed-qr/`
  - `svcqr/`
  - `hcqr/`
  - `snqesa/`
  - `plgwqr/`
  - `poisson-rr/`
- `2022/`
  - `gtwr-housing/`
  - `bgtwr-housing/`
- `2021/`
  - `mgtwr-variable-selection/`
- `shared/`
  - `reader.css`

## Maintenance Rule

When adding a new paper:

1. Create `papers/<year>/<paper-id>/`.
2. Put all local files for that paper in the folder.
3. Update paths in `data/publications.json`.
