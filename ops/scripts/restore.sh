#!/usr/bin/env bash
# Restore LinkNest SQLite + uploads into a target data directory.
# Usage:
#   ops/scripts/restore.sh <backup_dir> <target_data_dir>
#
# Never targets ./data unless explicitly passed.
# Does not start or stop containers — caller manages lifecycle.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ $# -lt 2 ]]; then
  echo "usage: ops/scripts/restore.sh <backup_dir> <target_data_dir>" >&2
  exit 1
fi

BACKUP_DIR="$(cd "$1" && pwd)"
TARGET_DIR="$2"

if [[ ! -f "$BACKUP_DIR/linknest.db" ]]; then
  echo "error: missing $BACKUP_DIR/linknest.db" >&2
  exit 1
fi

if [[ -f "$BACKUP_DIR/SHA256SUMS" ]]; then
  (
    cd "$BACKUP_DIR"
    sha256sum -c SHA256SUMS --quiet
  )
  echo "==> SHA-256 checksums ok"
fi

# Verify backup integrity before writing target
INTEGRITY="$(
  cd "$ROOT/apps/web" && node -e '
const Database = require("better-sqlite3");
const db = new Database(process.argv[1], { readonly: true });
process.stdout.write(db.pragma("integrity_check")[0].integrity_check);
' "$BACKUP_DIR/linknest.db"
)"
if [[ "$INTEGRITY" != "ok" ]]; then
  echo "error: backup integrity_check failed: $INTEGRITY" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR/uploads/link-icons"

# Refuse accidental wipe of non-empty target without FORCE_RESTORE=1
if [[ -f "$TARGET_DIR/linknest.db" && "${FORCE_RESTORE:-}" != "1" ]]; then
  echo "error: target already has linknest.db (set FORCE_RESTORE=1 to overwrite)" >&2
  exit 1
fi

cp -a "$BACKUP_DIR/linknest.db" "$TARGET_DIR/linknest.db"
rm -f "$TARGET_DIR/linknest.db-wal" "$TARGET_DIR/linknest.db-shm"

if [[ -d "$BACKUP_DIR/uploads/link-icons" ]]; then
  rm -rf "$TARGET_DIR/uploads/link-icons"
  mkdir -p "$TARGET_DIR/uploads/link-icons"
  cp -a "$BACKUP_DIR/uploads/link-icons/." "$TARGET_DIR/uploads/link-icons/"
fi

# Ensure container uid can write
chmod -R a+rwX "$TARGET_DIR" || true

AFTER="$(
  cd "$ROOT/apps/web" && node -e '
const Database = require("better-sqlite3");
const db = new Database(process.argv[1], { readonly: true });
process.stdout.write(db.pragma("integrity_check")[0].integrity_check);
' "$TARGET_DIR/linknest.db"
)"
if [[ "$AFTER" != "ok" ]]; then
  echo "error: restored DB integrity_check failed: $AFTER" >&2
  exit 1
fi

echo "==> Restored to $TARGET_DIR"
echo "integrity_check=$AFTER"
echo "icon_files=$(find "$TARGET_DIR/uploads/link-icons" -type f 2>/dev/null | wc -l | tr -d ' ')"
