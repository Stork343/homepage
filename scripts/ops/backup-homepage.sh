#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT_DIR"
DEST_ROOT="${HOME}/offline-backups"
PREFIX="homepage-backup"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [--src PATH] [--dest-root PATH] [--prefix NAME]

Creates an offline backup snapshot with repository copy + metadata + tarball.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --src)
      SRC="$2"
      shift 2
      ;;
    --dest-root)
      DEST_ROOT="$2"
      shift 2
      ;;
    --prefix)
      PREFIX="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -d "$SRC" ]]; then
  echo "Source directory not found: $SRC" >&2
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${DEST_ROOT}/${PREFIX}-${TS}"
mkdir -p "$BACKUP_DIR"

rsync -a \
  --exclude "node_modules/" \
  --exclude "playwright-report/" \
  --exclude "test-results/" \
  "$SRC/" "$BACKUP_DIR/homepage/"

if git -C "$SRC" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$SRC" rev-parse HEAD > "$BACKUP_DIR/HEAD.txt"
  git -C "$SRC" status --short > "$BACKUP_DIR/git-status.txt"
  git -C "$SRC" log --oneline -n 50 > "$BACKUP_DIR/git-log-50.txt"
fi

tar -czf "$BACKUP_DIR/homepage.snapshot.tar.gz" -C "$BACKUP_DIR" homepage
shasum -a 256 "$BACKUP_DIR/homepage.snapshot.tar.gz" > "$BACKUP_DIR/SHA256SUMS.txt"

cat <<INFO
Backup created:
  $BACKUP_DIR

Restore command:
  rsync -a --delete "$BACKUP_DIR/homepage/" "$SRC/"
INFO
