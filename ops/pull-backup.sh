#!/usr/bin/env bash
# ops/pull-backup.sh — RUN ON YOUR MAC. Pulls the latest DB snapshot off the
# server so the database is no longer a single point of failure.
# Usage:  bash ops/pull-backup.sh
set -uo pipefail

HOST="${UNAT_HOST:-root@unatrare.wtf}"
REMOTE="${UNAT_REMOTE_BACKUP:-/var/www/unatrare/backups/db}"
LOCAL="${UNAT_LOCAL_BACKUP:-$HOME/UNATRARE/backups/offsite}"
KEEP="${UNAT_LOCAL_KEEP:-30}"

mkdir -p "$LOCAL"
latest=$(ssh "$HOST" "ls -1t $REMOTE/unatrare-*.db.gz 2>/dev/null | head -1")
[ -n "$latest" ] || { echo "[pull] no remote backup found in $REMOTE"; exit 1; }

scp "$HOST:$latest" "$LOCAL/"
echo "[pull] pulled $(basename "$latest") -> $LOCAL"

# Keep the newest KEEP locally.
ls -1t "$LOCAL"/unatrare-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
