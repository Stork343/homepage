#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <tag> [message]" >&2
  exit 1
fi

TAG="$1"
MESSAGE="${2:-Release ${TAG}}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash changes before release." >&2
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG" >&2
  exit 1
fi

git fetch origin main
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "Local HEAD ($LOCAL_HEAD) does not match origin/main ($REMOTE_HEAD)." >&2
  echo "Run: git pull --ff-only" >&2
  exit 1
fi

node scripts/validate-site.js
node scripts/generate-paper-toc.js --check
node scripts/acceptance-check.js

git tag -a "$TAG" -m "$MESSAGE"
git push origin main
git push origin "$TAG"

echo "Release complete: $TAG"
