# Release And Rollback Guide

## Scope
This guide standardizes release tagging and safe rollback for the homepage repository.

## Prerequisites
- Local branch is `main` and up to date with `origin/main`.
- Working tree is clean (`git status` should be empty).
- Node.js is installed.

## Pre-Release Checks
Run the following checks before any release tag:

```bash
node scripts/validate-site.js
node scripts/build-site-data.js --check
node scripts/sync-paper-seo.js --check
node scripts/generate-paper-toc.js --check
node scripts/acceptance-check.js
npm run check:contrast
npm run test:ui
npm run test:a11y
npm run test:visual
npm run lighthouse
```

## Create A Release Tag
Use the non-interactive release script:

```bash
./scripts/release.sh v2026.02.24 "Release v2026.02.24"
```

The script will:
1. Verify clean working tree.
2. Ensure local HEAD matches `origin/main`.
3. Generate release notes from git history.
4. Create rollback artifacts (`release-artifacts/<tag>/rollback-point.json`, `rollback-main.bundle`).
5. Re-run required checks (including contrast, a11y, visual baseline, Lighthouse budgets).
6. Create an annotated tag.
7. Push `main` and the tag to GitHub.

## Rollback Options

### Option A: Git Revert (recommended for published commits)
```bash
git revert <bad_commit_sha>
git push origin main
```

### Option B: Restore From Offline Backup
Create backup:
```bash
./scripts/ops/backup-homepage.sh
```

Restore backup:
```bash
./scripts/ops/restore-homepage.sh --backup /path/to/backup-dir
```

By default, restore script creates a safety snapshot before overwriting destination.

### Option C: Roll Back To A Tag
```bash
git checkout <tag>
```
Then either create a hotfix branch or reset main in a controlled maintenance flow.

## Post-Rollback Verification
After rollback, always run:

```bash
node scripts/validate-site.js
node scripts/build-site-data.js --check
node scripts/sync-paper-seo.js --check
node scripts/acceptance-check.js
npm run check:contrast
npm run lighthouse
```
