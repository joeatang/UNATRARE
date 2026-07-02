#!/usr/bin/env bash
# ops/salute-split-monitor.sh — tamper/regression tripwire for the artist split.
#
# The 69/31 artist split is money that artists depend on. Two past refactors
# silently deleted the split code and artists got 0% for weeks before anyone
# noticed. This watches the LEDGER (the ground truth) and alerts the moment a
# regression shows up in the data: salutes landing on payout-enabled cards with
# NO artist payout recorded.
#
# Runs on the host via cron (every 5–15 min). Alerts Telegram via ops/notify.sh.
#
# A single zero-artist burn can be a legitimate CLI / manual-TxID burn, so we
# only alarm when several pile up in the window (SPLIT_ALERT_THRESHOLD) — the
# signature of the web burn flow dropping the artist leg. Re-alerts at most once
# per SPLIT_ALERT_COOLDOWN_MIN minutes so a broken deploy doesn't spam the chat.
set -u

ROOT="${UNAT_ROOT:-/var/www/unatrare}"
DB="${UNAT_DB:-$ROOT/data/unatrare.db}"
NOTIFY="${UNAT_NOTIFY:-$ROOT/ops/notify.sh}"
STATE="${UNAT_SPLIT_STATE:-$ROOT/ops/.split-monitor.state}"
FLAG="$ROOT/MAINTENANCE"

WINDOW_MIN="${SPLIT_ALERT_WINDOW_MIN:-60}"       # look-back window
THRESHOLD="${SPLIT_ALERT_THRESHOLD:-2}"          # zero-artist burns before we alarm
COOLDOWN_MIN="${SPLIT_ALERT_COOLDOWN_MIN:-60}"   # min minutes between alerts

# Intentional downtime — don't alarm.
[ -f "$FLAG" ] && exit 0
[ -f "$DB" ]   || { echo "[split-monitor] db not found: $DB" >&2; exit 0; }
command -v sqlite3 >/dev/null 2>&1 || { echo "[split-monitor] sqlite3 missing" >&2; exit 0; }

# Count salutes in the window that SHOULD have split (card has a payout address)
# but recorded ZERO to the artist.
read -r ZERO_CNT ZERO_BURN < <(sqlite3 -separator ' ' "$DB" "
  SELECT COUNT(*), COALESCE(CAST(SUM(cs.amount_display) AS INTEGER), 0)
  FROM card_salutes cs
  JOIN tokens t ON t.token_name = cs.card_name
  WHERE t.artist_sol_address IS NOT NULL AND t.artist_sol_address != ''
    AND COALESCE(cs.artist_amount_display, 0) = 0
    AND cs.burned_at >= strftime('%s','now') - ${WINDOW_MIN} * 60;
" 2>/dev/null)

ZERO_CNT="${ZERO_CNT:-0}"
ZERO_BURN="${ZERO_BURN:-0}"

now_epoch=$(date +%s)
last_alert=0
[ -f "$STATE" ] && last_alert="$(cat "$STATE" 2>/dev/null || echo 0)"
[ -n "$last_alert" ] || last_alert=0

if [ "$ZERO_CNT" -ge "$THRESHOLD" ]; then
  age=$(( now_epoch - last_alert ))
  if [ "$age" -ge $(( COOLDOWN_MIN * 60 )) ]; then
    # List the affected cards for the alert body.
    CARDS=$(sqlite3 "$DB" "
      SELECT GROUP_CONCAT(x.card_name, ', ') FROM (
        SELECT DISTINCT cs.card_name
        FROM card_salutes cs
        JOIN tokens t ON t.token_name = cs.card_name
        WHERE t.artist_sol_address IS NOT NULL AND t.artist_sol_address != ''
          AND COALESCE(cs.artist_amount_display, 0) = 0
          AND cs.burned_at >= strftime('%s','now') - ${WINDOW_MIN} * 60
        LIMIT 20
      ) x;
    " 2>/dev/null)
    bash "$NOTIFY" "🔴 <b>ARTIST SPLIT TRIPWIRE</b>

${ZERO_CNT} salute(s) totalling ~${ZERO_BURN} \$CASH landed on payout-enabled cards in the last ${WINDOW_MIN}m with <b>0 to the artist</b>.

Cards: ${CARDS:-n/a}

The 69/31 split may be broken again (check SalutePanel client build + /api/salute recording). Artists are being under-paid RIGHT NOW."
    printf '%s' "$now_epoch" > "$STATE"
  fi
  exit 1
fi

exit 0
