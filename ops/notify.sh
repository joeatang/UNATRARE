#!/usr/bin/env bash
# ops/notify.sh — send an OPS alert to the private UNATRARE alert chat.
# Usage: ops/notify.sh "message (HTML allowed)"
#
# Chat selection (never printed):
#   TELEGRAM_ALERT_CHAT_ID  — PRIVATE ops/health channel (preferred)
#   TELEGRAM_CHAT_ID        — public channel (fallback only, to avoid noise)
# Both read from .env.local.
set -u

ENV_FILE="${UNAT_ENV_FILE:-/var/www/unatrare/.env.local}"

read_env() {
  # Extract a single KEY=value from the env file without sourcing the whole file
  # (avoids breakage if other lines contain unquoted special characters).
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

MSG="${1:-}"
[ -n "$MSG" ] || { echo "[notify] empty message" >&2; exit 0; }

TOKEN="$(read_env TELEGRAM_BOT_TOKEN)"
# Prefer the private alert chat; fall back to the public channel only if unset.
CHAT="$(read_env TELEGRAM_ALERT_CHAT_ID)"
[ -n "$CHAT" ] || CHAT="$(read_env TELEGRAM_CHAT_ID)"

if [ -z "$TOKEN" ] || [ -z "$CHAT" ]; then
  echo "[notify] Telegram not configured — would have sent: $MSG" >&2
  exit 0
fi

curl -s -m 10 "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT}" \
  --data-urlencode "text=${MSG}" \
  --data-urlencode "parse_mode=HTML" \
  --data-urlencode "disable_web_page_preview=true" >/dev/null 2>&1 || \
  echo "[notify] send failed" >&2
