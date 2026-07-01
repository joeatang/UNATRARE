#!/usr/bin/env bash
# ops/maint-off.sh — bring UNATRARE back online (clears maintenance mode).
# Takes effect instantly (no nginx reload).
set -u

ROOT="${UNAT_ROOT:-/var/www/unatrare}"
FLAG="$ROOT/MAINTENANCE"

if [ -f "$FLAG" ]; then
  rm -f "$FLAG"
  echo "[maint] MAINTENANCE MODE: OFF — site is live again."
  bash "$ROOT/ops/notify.sh" "🟢 <b>UNATRARE back online</b> — maintenance complete." 2>/dev/null || true
else
  echo "[maint] Already live (no maintenance flag present)."
fi
