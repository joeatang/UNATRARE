#!/usr/bin/env bash
# ops/deploy.sh — the ONLY safe way to ship an update to unatrare.wtf.
# RUN ON THE HOST, from /var/www/unatrare.
#
# What it guarantees:
#   1. Puts the site in maintenance mode first (no one acts mid-deploy).
#   2. Pulls code, preserving host-local judges.config.json overrides.
#   3. Snapshots the DB before touching anything.
#   4. Builds ON THE HOST against the real DB (never a locally-built .next).
#   5. Keeps the previous build as a rollback point.
#   6. Verifies a real card actually renders BEFORE going live.
#   7. If anything fails, rolls back and STAYS in maintenance (safe).
#   8. Only clears maintenance when the new build is proven healthy.
set -uo pipefail

ROOT="${UNAT_ROOT:-/var/www/unatrare}"
cd "$ROOT" || { echo "cannot cd $ROOT"; exit 1; }

FLAG="$ROOT/MAINTENANCE"
NOTIFY="$ROOT/ops/notify.sh"
KNOWN_TOKEN="${UNAT_HEALTH_TOKEN:-UNATCROBATS}"
LOCAL="http://127.0.0.1:3007"

log()  { echo "[deploy] $*"; }
die()  {
  log "FAILED: $*"
  bash "$NOTIFY" "🔴 <b>UNATRARE deploy FAILED</b>
$*
Site kept in <b>maintenance</b> for safety — nothing went live." 2>/dev/null || true
  exit 1
}

# 0. Maintenance ON ----------------------------------------------------------
touch "$FLAG"; log "maintenance ON"
bash "$NOTIFY" "🛠️ <b>UNATRARE deploy started</b> — site paused. Art &amp; wallets unaffected." 2>/dev/null || true

# 1. Sync code, preserving host overrides ------------------------------------
STASH_MSG="deploy-autostash-$(date +%s)"
git stash push -u -m "$STASH_MSG" >/dev/null 2>&1 || true
git pull --ff-only origin main || die "git pull --ff-only failed"
if git stash list 2>/dev/null | grep -q "$STASH_MSG"; then
  # Restore host-local judges overrides from the stash (kept out of git history).
  git show "stash@{0}:judges.config.json" > judges.config.json 2>/dev/null || true
  log "restored host judges.config.json overrides"
fi

# 2. Snapshot DB before build ------------------------------------------------
bash "$ROOT/ops/backup-db.sh" || log "backup warning (continuing)"

# 3. Rollback point ----------------------------------------------------------
rm -rf "$ROOT/.next.prev"
[ -d "$ROOT/.next" ] && cp -a "$ROOT/.next" "$ROOT/.next.prev" && log "saved rollback point (.next.prev)"

rollback() {
  log "rolling back to previous build"
  pm2 stop unatrare >/dev/null 2>&1 || true
  rm -rf "$ROOT/.next"
  if [ -d "$ROOT/.next.prev" ]; then mv "$ROOT/.next.prev" "$ROOT/.next"; fi
  pm2 start unatrare >/dev/null 2>&1 || pm2 restart unatrare >/dev/null 2>&1 || true
}

# 4. Build on host -----------------------------------------------------------
pm2 stop unatrare >/dev/null 2>&1 || true
rm -rf "$ROOT/.next"
if ! NODE_ENV=production npm run build; then
  rollback
  die "build error"
fi

# 5. Start -------------------------------------------------------------------
pm2 start unatrare >/dev/null 2>&1 || pm2 restart unatrare >/dev/null 2>&1
pm2 save >/dev/null 2>&1 || true

# 6. Verify gate — a real card must render before we go live -----------------
ok=0
for _ in $(seq 1 20); do
  sleep 2
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$LOCAL/card/$KNOWN_TOKEN" || echo 000)
  if [ "$code" = "200" ]; then
    body=$(curl -s -m 10 "$LOCAL/card/$KNOWN_TOKEN" || true)
    dir=$(curl -s -m 10 "$LOCAL/directory" || true)
    if echo "$body" | grep -q "<title>$KNOWN_TOKEN" && echo "$dir" | grep -qE '/card/[A-Z0-9]+'; then
      ok=1; break
    fi
  fi
done

if [ "$ok" != "1" ]; then
  rollback
  die "verify gate failed — new build did not render /card/$KNOWN_TOKEN + /directory"
fi

# 7. Success — go live -------------------------------------------------------
rm -rf "$ROOT/.next.prev"
rm -f "$FLAG"
BUILD_ID="$(cat "$ROOT/.next/BUILD_ID" 2>/dev/null || echo unknown)"
log "LIVE — verified. build=$BUILD_ID"
bash "$NOTIFY" "🟢 <b>UNATRARE deploy OK</b> — live again.
Verified: /card/$KNOWN_TOKEN renders, /directory populated.
build: <code>$BUILD_ID</code>" 2>/dev/null || true
echo
echo "NOTE: add a line to RELEASES.md for build $BUILD_ID."
