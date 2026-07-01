#!/usr/bin/env bash
# ops/healthcheck.sh — verify the LIVE site is actually serving real data.
# Runs on the host via cron every minute. Alerts Telegram on failure and again
# on recovery. Stays SILENT during intentional maintenance.
#
# Checks (the same things that broke during the scare):
#   1. Homepage returns 200
#   2. /directory actually lists cards (not an empty shell)
#   3. A known card renders its real title (proves the DB path works)
set -u

ROOT="${UNAT_ROOT:-/var/www/unatrare}"
FLAG="$ROOT/MAINTENANCE"
STATE="$ROOT/ops/.health.state"
NOTIFY="$ROOT/ops/notify.sh"
BASE="${UNAT_BASE:-https://unatrare.wtf}"
KNOWN_TOKEN="${UNAT_HEALTH_TOKEN:-UNATCROBATS}"

# Intentional downtime — do not alarm.
[ -f "$FLAG" ] && exit 0

fail=""

code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$BASE/")
[ "$code" = "200" ] || fail="${fail}
• homepage returned HTTP $code"

dir=$(curl -s -m 15 "$BASE/directory")
echo "$dir" | grep -qE '/card/[A-Z0-9]+' || fail="${fail}
• /directory is not listing any cards"

card=$(curl -s -m 15 "$BASE/card/$KNOWN_TOKEN")
echo "$card" | grep -q "<title>$KNOWN_TOKEN" || fail="${fail}
• /card/$KNOWN_TOKEN is not rendering (DB path?)"

prev="ok"
[ -f "$STATE" ] && prev="$(cat "$STATE" 2>/dev/null)"

if [ -n "$fail" ]; then
  if [ "$prev" != "down" ]; then
    printf 'down' > "$STATE"
    bash "$NOTIFY" "🔴 <b>UNATRARE health check FAILED</b>${fail}

The public site may be down. Check PM2 and the last deploy."
  fi
  exit 1
fi

if [ "$prev" = "down" ]; then
  bash "$NOTIFY" "🟢 <b>UNATRARE recovered</b> — all health checks passing again."
fi
printf 'ok' > "$STATE"
exit 0
