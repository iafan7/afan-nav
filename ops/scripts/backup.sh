#!/usr/bin/env bash
# Backup LinkNest SQLite + uploads into backups/<timestamp>/.
# Usage:
#   ops/scripts/backup.sh [data_dir] [backup_root]
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA_DIR="${1:-$ROOT/data}"
BACKUP_ROOT="${2:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_ROOT/$STAMP"

DB_SRC="$DATA_DIR/linknest.db"
UPLOADS_SRC="$DATA_DIR/uploads/link-icons"

if [[ ! -f "$DB_SRC" ]]; then
  echo "error: database not found: $DB_SRC" >&2
  exit 1
fi

mkdir -p "$DEST/uploads/link-icons"
echo "==> Backup destination: $DEST"

cd "$ROOT/apps/web"
BACKUP_SRC="$DB_SRC" BACKUP_DEST="$DEST/linknest.db" \
  NODE_PATH="$ROOT/apps/web/node_modules" \
  node "$ROOT/ops/scripts/sqlite-backup.cjs"

if [[ ! -s "$DEST/linknest.db" ]]; then
  echo "error: backup file missing or empty" >&2
  exit 1
fi

if [[ -d "$UPLOADS_SRC" ]]; then
  cp -a "$UPLOADS_SRC/." "$DEST/uploads/link-icons/" || true
fi

INTEGRITY="$(
  NODE_PATH="$ROOT/apps/web/node_modules" node -e '
const Database = require("better-sqlite3");
const db = new Database(process.argv[1], { readonly: true });
process.stdout.write(db.pragma("integrity_check")[0].integrity_check);
db.close();
' "$DEST/linknest.db"
)"
if [[ "$INTEGRITY" != "ok" ]]; then
  echo "error: backup integrity_check failed: $INTEGRITY" >&2
  exit 1
fi

COUNTS="$(
  NODE_PATH="$ROOT/apps/web/node_modules" node -e '
const Database = require("better-sqlite3");
const db = new Database(process.argv[1], { readonly: true });
const q = (sql) => db.prepare(sql).get().c;
process.stdout.write([
  "categories=" + q("SELECT count(*) AS c FROM categories"),
  "links=" + q("SELECT count(*) AS c FROM links"),
  "search_engines=" + q("SELECT count(*) AS c FROM search_engines"),
  "admin_rows=" + q("SELECT count(*) AS c FROM admin_credentials"),
  "site_settings=" + q("SELECT count(*) AS c FROM site_settings"),
].join("\n"));
db.close();
' "$DEST/linknest.db"
)"

{
  echo "created_at_utc=$STAMP"
  echo "source_data_dir=$DATA_DIR"
  echo "db_file=linknest.db"
  echo "uploads_dir=uploads/link-icons"
  echo "integrity_check=$INTEGRITY"
  echo "$COUNTS"
  echo "icon_files=$(find "$DEST/uploads/link-icons" -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "db_bytes=$(wc -c <"$DEST/linknest.db" | tr -d ' ')"
  echo "git_commit=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
} >"$DEST/manifest.txt"

(
  cd "$DEST"
  find . -type f ! -name 'SHA256SUMS' -print0 | sort -z | xargs -0 sha256sum >SHA256SUMS
)

echo "==> Backup complete: $DEST"
echo "manifest:"
cat "$DEST/manifest.txt"
