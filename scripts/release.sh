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
RELEASE_DATE="$(date +%Y-%m-%d)"
ARTIFACT_DIR="${ROOT_DIR}/release-artifacts/${TAG}"
NOTES_FILE="${ARTIFACT_DIR}/CHANGELOG.generated.md"
ROLLBACK_META_FILE="${ARTIFACT_DIR}/rollback-point.json"
ROLLBACK_BUNDLE_FILE="${ARTIFACT_DIR}/rollback-main.bundle"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash changes before release." >&2
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG" >&2
  exit 1
fi

git fetch origin main --tags
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "Local HEAD ($LOCAL_HEAD) does not match origin/main ($REMOTE_HEAD)." >&2
  echo "Run: git pull --ff-only" >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"
PREV_TAG="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"

{
  echo "# ${TAG}"
  echo
  echo "- Date: ${RELEASE_DATE}"
  echo "- Commit: ${LOCAL_HEAD}"
  if [[ -n "${PREV_TAG}" ]]; then
    echo "- Previous tag: ${PREV_TAG}"
  else
    echo "- Previous tag: (none)"
  fi
  echo
  echo "## Changes"
  if [[ -n "${PREV_TAG}" ]]; then
    git log --pretty=format:"- %h %s" "${PREV_TAG}..HEAD"
  else
    git log --pretty=format:"- %h %s" -n 30
  fi
  echo
  echo
  echo "## Notes"
  echo "${MESSAGE}"
  echo
} > "$NOTES_FILE"

cat > "$ROLLBACK_META_FILE" <<EOF
{
  "tag": "${TAG}",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "head_commit": "${LOCAL_HEAD}",
  "previous_tag": "${PREV_TAG:-}",
  "branch": "main",
  "notes_file": "${NOTES_FILE}"
}
EOF

git bundle create "$ROLLBACK_BUNDLE_FILE" main

node scripts/build-site-data.js --check
node scripts/validate-site.js
node scripts/generate-paper-toc.js --check
node scripts/acceptance-check.js
npm run check:contrast
npm run test:ui
npm run test:a11y
npm run test:visual
npm run lighthouse

git tag -a "$TAG" -F "$NOTES_FILE"
git push origin main
git push origin "$TAG"

echo "Release complete: $TAG"
echo "Release artifacts:"
echo "  - ${NOTES_FILE}"
echo "  - ${ROLLBACK_META_FILE}"
echo "  - ${ROLLBACK_BUNDLE_FILE}"
