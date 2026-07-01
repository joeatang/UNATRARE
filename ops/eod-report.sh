#!/usr/bin/env bash
# ops/eod-report.sh — end-of-day health & activity digest to the PRIVATE ops channel.
# Runs on the host via cron (see crontab). Pushes one message summarizing:
#   • public site status (same probes as healthcheck)
#   • PM2 process roll-call (all 4 must be online)
#   • salute activity (last 24h + all-time)
#   • community nodes + approved cards
#   • latest DB backup age
#   • disk / memory headroom
#
# Read-only. Never restarts anything. Uses ops/notify.sh so it honors
# TELEGRAM_ALERT_CHAT_ID (the private group).
set -u

ROOT="${UNAT_ROOT:-/var/www/unatrare}"
NOTIFY="$ROOT/ops/notify.sh"
BASE="${UNAT_BASE:-https://unatrare.wtf}"
KNOWN_TOKEN="${UNAT_HEALTH_TOKEN:-UNATCROBATS}"
DB="${UNATRARE_DB_PATH:-$ROOT/data/unatrare.db}"

# ── Site probes ──────────────────────────────────────────────────────────────
site="🟢 up"
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$BASE/")
if [ "$code" != "200" ]; then
  site="🔴 homepage HTTP $code"
else
  dir=$(curl -s -m 15 "$BASE/directory")
  if ! echo "$dir" | grep -qE '/card/[A-Z0-9]+'; then
    site="🟠 directory not listing cards"
  else
    card=$(curl -s -m 15 "$BASE/card/$KNOWN_TOKEN")
    echo "$card" | grep -q "<title>$KNOWN_TOKEN" || site="🟠 /card/$KNOWN_TOKEN not rendering"
  fi
fi

# ── PM2 roll-call ────────────────────────────────────────────────────────────
procs=$(pm2 jlist 2>/dev/null | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    let j; try{j=JSON.parse(s)}catch{console.log("? (pm2 unreadable)");return;}
    const want=["unatrare","unatrare-seeder","unatrare-peer","unatrare-tgbot"];
    const on=want.filter(n=>j.find(p=>p.name===n&&p.pm2_env&&p.pm2_env.status==="online"));
    const down=want.filter(n=>!on.includes(n));
    console.log(on.length+"/"+want.length+(down.length?" ⚠️ down: "+down.join(", "):" online"));
  });
')

# ── DB stats (read-only) ─────────────────────────────────────────────────────
stats=$(UNATRARE_DB_PATH="$DB" node --input-type=module 2>/dev/null <<'NODE'
import { DatabaseSync } from 'node:sqlite';
const DB = process.env.UNATRARE_DB_PATH;
const db = new DatabaseSync(DB, { readOnly: true });
const day = Math.floor(Date.now()/1000) - 86400;
const s   = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(amount_display),0) amt, COUNT(DISTINCT sol_wallet) w FROM card_salutes WHERE burned_at >= ?').get(day);
const all = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(amount_display),0) amt, COUNT(DISTINCT sol_wallet) w FROM card_salutes').get();
const nodes = db.prepare('SELECT COUNT(*) n FROM nodes').get();
const toks  = db.prepare("SELECT COUNT(*) n FROM tokens WHERE status='approved'").get();
const fmt = x => { x=Number(x)||0; if(x>=1e6)return (x/1e6).toFixed(2)+'M'; if(x>=1e3)return (x/1e3).toFixed(1)+'K'; return String(Math.round(x)); };
console.log([s.n, fmt(s.amt), s.w, all.n, fmt(all.amt), all.w, nodes.n, toks.n].join('|'));
NODE
)
IFS='|' read -r S24 C24 W24 SALL CALL WALL NODES APPROVED <<< "${stats:-0|0|0|0|0|0|0|0}"

# ── Latest backup age ────────────────────────────────────────────────────────
latest=$(ls -t "$ROOT/backups/db/"*.db.gz 2>/dev/null | head -1)
if [ -n "$latest" ]; then
  now=$(date +%s); bts=$(stat -c %Y "$latest" 2>/dev/null || echo "$now")
  age_h=$(( (now - bts) / 3600 ))
  bsize=$(du -h "$latest" 2>/dev/null | cut -f1)
  backup="$(basename "$latest") — ${age_h}h old, ${bsize}"
  [ "$age_h" -gt 26 ] && backup="⚠️ stale — $backup"
else
  backup="⚠️ no backup found"
fi

# ── Host headroom ────────────────────────────────────────────────────────────
disk=$(df -h / | awk 'NR==2{print $5" used, "$4" free"}')
mem=$(free -m | awk '/Mem:/{printf "%d/%d MB used", $3, $2}')

# ── Compose + send ───────────────────────────────────────────────────────────
DATESTR=$(date '+%a %b %-d, %H:%M %Z')
bash "$NOTIFY" "🌙 <b>UNATRARE end-of-day report</b> — ${DATESTR}

<b>Site:</b> ${site}
<b>Processes:</b> ${procs}

<b>Salutes (24h):</b> ${S24} from ${W24} wallets · 🔥 ${C24} \$CASH
<b>Salutes (all-time):</b> ${SALL} from ${WALL} torchbearers · 🔥 ${CALL} \$CASH
<b>Directory:</b> ${APPROVED} approved cards · <b>Nodes:</b> ${NODES}

<b>Backup:</b> ${backup}
<b>Host:</b> disk ${disk} · mem ${mem}"
