#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SNAP_ROOT="$ROOT_DIR/preflight_snapshots"
DB_DIR="$ROOT_DIR/data"
DB_FILE="$DB_DIR/unatrare.db"

LABEL="${1:-}"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -cs 'a-zA-Z0-9._-' '-')"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAP_DIR="$SNAP_ROOT/$STAMP${SAFE_LABEL:+-$SAFE_LABEL}"

mkdir -p "$SNAP_DIR"

echo "[snapshot] creating preflight snapshot in: $SNAP_DIR"

{
  echo "timestamp_utc=$STAMP"
  echo "cwd=$ROOT_DIR"
  echo "uname=$(uname -a)"
  echo "node=$(node -v 2>/dev/null || echo 'not-found')"
  echo "npm=$(npm -v 2>/dev/null || echo 'not-found')"
  echo "git_branch=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  echo "git_head=$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo 'unknown')"
  echo "db_present=$([ -f "$DB_FILE" ] && echo 'yes' || echo 'no')"
  echo "sqlite3_present=$((command -v sqlite3 >/dev/null 2>&1 && echo yes) || echo no)"
} > "$SNAP_DIR/manifest.txt"

git -C "$ROOT_DIR" status --short > "$SNAP_DIR/git-status.txt" || true
git -C "$ROOT_DIR" diff > "$SNAP_DIR/git-diff.patch" || true
git -C "$ROOT_DIR" diff --staged > "$SNAP_DIR/git-diff-staged.patch" || true

if [ -f "$DB_FILE" ]; then
  cp -p "$DB_FILE" "$SNAP_DIR/unatrare.db"
fi
if [ -f "$DB_DIR/unatrare.db-wal" ]; then
  cp -p "$DB_DIR/unatrare.db-wal" "$SNAP_DIR/unatrare.db-wal"
fi
if [ -f "$DB_DIR/unatrare.db-shm" ]; then
  cp -p "$DB_DIR/unatrare.db-shm" "$SNAP_DIR/unatrare.db-shm"
fi

if command -v sqlite3 >/dev/null 2>&1 && [ -f "$DB_FILE" ]; then
  sqlite3 "$DB_FILE" ".backup '$SNAP_DIR/unatrare.backup.sqlite'" || true
fi

for f in \
  "$ROOT_DIR/package.json" \
  "$ROOT_DIR/next.config.mjs" \
  "$ROOT_DIR/ecosystem.config.cjs" \
  "$ROOT_DIR/judges.config.json"; do
  if [ -f "$f" ]; then
    cp -p "$f" "$SNAP_DIR/$(basename "$f")"
  fi
done

{
  echo "Snapshot complete."
  echo "Path: $SNAP_DIR"
  echo "Contains: git-status, git-diff, db copy, optional sqlite backup, key config files"
} > "$SNAP_DIR/README.txt"

echo "[snapshot] done: $SNAP_DIR"
