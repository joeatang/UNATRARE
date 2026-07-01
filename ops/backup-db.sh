#!/usr/bin/env bash
# ops/backup-db.sh — consistent nightly snapshot of the UNATRARE database.
# Uses sqlite3 .backup (WAL-safe — never copy a live WAL file directly).
# Verifies integrity, compresses, and keeps the most recent KEEP snapshots.
set -uo pipefail

ROOT="${UNAT_ROOT:-/var/www/unatrare}"
DB="${UNATRARE_DB_PATH:-$ROOT/data/unatrare.db}"
OUT="$ROOT/backups/db"
KEEP="${UNAT_BACKUP_KEEP:-14}"

mkdir -p "$OUT"
ts=$(date -u +%Y%m%dT%H%M%SZ)
snap="$OUT/unatrare-$ts.db"

if [ ! -f "$DB" ]; then
  echo "[backup] DB not found at $DB" >&2
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$snap'" || { echo "[backup] .backup failed" >&2; exit 1; }
  ic=$(sqlite3 "$snap" "PRAGMA integrity_check;" 2>/dev/null | head -1)
else
  cp "$DB" "$snap"
  ic="unchecked (no sqlite3)"
fi

if [ "$ic" != "ok" ] && [ "$ic" != "unchecked (no sqlite3)" ]; then
  echo "[backup] WARNING integrity_check=$ic" >&2
  bash "$ROOT/ops/notify.sh" "⚠️ <b>UNATRARE backup integrity warning</b>: $ic" 2>/dev/null || true
fi

gzip -f "$snap"
echo "[backup] wrote ${snap}.gz  (integrity=$ic)"

# Rotate: keep the newest KEEP compressed snapshots.
ls -1t "$OUT"/unatrare-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
