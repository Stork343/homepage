#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="$ROOT_DIR"
BACKUP=""
NO_SAFETY=0
NO_DELETE=0

usage() {
  cat <<USAGE
Usage: $(basename "$0") --backup PATH [--dest PATH] [--no-safety] [--no-delete]

Restores a backup produced by backup-homepage.sh.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup)
      BACKUP="$2"
      shift 2
      ;;
    --dest)
      DEST="$2"
      shift 2
      ;;
    --no-safety)
      NO_SAFETY=1
      shift
      ;;
    --no-delete)
      NO_DELETE=1
      shift
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

if [[ -z "$BACKUP" ]]; then
  echo "Missing --backup" >&2
  usage
  exit 1
fi

if [[ ! -d "$BACKUP" ]]; then
  echo "Backup path not found: $BACKUP" >&2
  exit 1
fi

if [[ -d "$BACKUP/homepage" ]]; then
  SRC="$BACKUP/homepage"
else
  SRC="$BACKUP"
fi

if [[ ! -d "$SRC/.git" ]]; then
  echo "Backup source does not look like a repository copy: $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"

if [[ "$NO_SAFETY" -eq 0 ]]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  SAFETY_DIR="${HOME}/local-backups/homepage-before-restore-${TS}"
  mkdir -p "$SAFETY_DIR"
  rsync -a "$DEST/" "$SAFETY_DIR/homepage/"
  echo "Safety snapshot: $SAFETY_DIR"
fi

RSYNC_ARGS=( -a )
if [[ "$NO_DELETE" -eq 0 ]]; then
  RSYNC_ARGS+=( --delete )
fi

rsync "${RSYNC_ARGS[@]}" "$SRC/" "$DEST/"

echo "Restore complete: $DEST"
