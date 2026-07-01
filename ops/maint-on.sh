#!/usr/bin/env bash
# ops/maint-on.sh — put UNATRARE into maintenance mode.
# Human-facing pages + write APIs show a friendly "tuning up" page (HTTP 503).
# /art/ and /uploads/ stay LIVE so certified art keeps rendering in wallets.
#
# Takes effect instantly (nginx checks the flag file per-request — no reload).
# To browse the site yourself while it's closed, visit the unlock URL printed below.
set -u

ROOT="${UNAT_ROOT:-/var/www/unatrare}"
FLAG="$ROOT/MAINTENANCE"

touch "$FLAG"
echo "[maint] MAINTENANCE MODE: ON  (flag: $FLAG)"
echo "[maint] Visitors now see the 'tuning up' page."
echo "[maint] To browse as operator, open:  https://unatrare.wtf/__unlock"

# Best-effort alert (won't fail the toggle if Telegram is unset)
bash "$ROOT/ops/notify.sh" "🛠️ <b>UNATRARE maintenance ON</b> — site paused for updates. Art &amp; wallets unaffected." 2>/dev/null || true
