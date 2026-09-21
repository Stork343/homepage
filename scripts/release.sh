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
# 体检 B-3 / 路线图 16：回滚 bundle 刻意放在 ARTIFACT_DIR 之外的兄弟目录。
# 本仓库是公开的，而 release-automation.yml 会把整个 release-artifacts/<tag>/ 目录
# 作为 workflow artifact 上传，并把其中列出的文件挂到 GitHub Release 上 ——
# 一个含 main 完整历史的 70 MB bundle 因此会变成任何人可批量下载的公开资产，
# 而且它是发布那一刻的历史快照，日后极易被误当成当前历史使用。
# bundle 对维护者本地回滚仍然有用，所以照常生成，只是不再进入任何上传路径。
ROLLBACK_DIR="${ROOT_DIR}/release-artifacts/${TAG}-rollback"
ROLLBACK_BUNDLE_FILE="${ROLLBACK_DIR}/main.bundle"

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

mkdir -p "$ROLLBACK_DIR"
git bundle create "$ROLLBACK_BUNDLE_FILE" main
echo "Rollback bundle written locally (never uploaded): ${ROLLBACK_BUNDLE_FILE#"${ROOT_DIR}/"}"

node scripts/build-site-data.js --check
node scripts/validate-site.js
node scripts/generate-paper-toc.js --check
node scripts/acceptance-check.js
npm run check:contrast
npm run test:ui
npm run test:a11y
# 体检 D-8：visual.spec.js 开头有 test.skip(process.platform !== "darwin")，
# 在 Linux 上跑 test:visual 会让 3 个用例全部 skip 并以 exit 0 收场 —— 一个空绿门禁。
# 而 release-automation.yml 跑在 ubuntu-latest，所以发布前的视觉把关此前从未真正生效。
# 视觉基线已由 site-checks.yml 的 visual-regression job 在 macos-latest 上对每次推送
# 真实执行；此处在非 darwin 平台显式说明并跳过，而不是伪造一次通过。
if [[ "$(uname -s)" == "Darwin" ]]; then
  npm run test:visual
else
  echo "跳过 test:visual：视觉基线为 macOS 专属，本平台会全部 skip（空绿门禁）。"
  echo "  该门禁由 CI 的 visual-regression job（macos-latest）在每次推送时真实执行。"
fi
npm run lighthouse

git tag -a "$TAG" -F "$NOTES_FILE"
git push origin main
git push origin "$TAG"

echo "Release complete: $TAG"
echo "Release artifacts:"
echo "  - ${NOTES_FILE}"
echo "  - ${ROLLBACK_META_FILE}"
echo "  - ${ROLLBACK_BUNDLE_FILE}"
