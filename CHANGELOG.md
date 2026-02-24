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

## [2026-02-24]
### Added
- Taylor & Francis-inspired style alignment and dark mode improvements.
- Unified paper page reader and metadata/config consistency checks.

### Changed
- Homepage publications grouped by year, with filters and bilingual rendering behavior rules.
- SCI paper pages now support automatic TOC generation with fallback strategies.
