#!/usr/bin/env bash
# ops/safe-check.sh — run this BEFORE you deploy. It answers ONE question:
#
#     "Is it safe to ship what I've changed to unatrare.wtf right now?"
#
# THE RITUAL — the only two commands you ever type to go live:
#     1)  npm run preflight            (here, on your Mac, in the app/ folder)
#     2)  bash ops/deploy.sh           (on the host — only if step 1 was GREEN)
#
# This script is READ-ONLY. It never touches production, the live DB, or git.
#   ✅ GREEN  → you're clear to commit, push, and run ops/deploy.sh on the host.
#   🛑 RED    → STOP. Fix what it lists, then run it again. Do not deploy on red.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1   # → app/

RED=0
say()  { printf '%s\n' "$*"; }
bad()  { RED=1; printf '  🛑 %s\n' "$*"; }
good() { printf '  ✅ %s\n' "$*"; }

say ""
say "============================================"
say "  UNATRARE — pre-deploy safety check"
say "============================================"

# 1. Am I in the right folder? ------------------------------------------------
say ""
say "1) Location"
if [ -f package.json ] && grep -q '"name": "unatrare"' package.json; then
  good "in the app/ folder"
else
  bad "not in the app/ folder — cd into UNATRARE/app first"
  say ""
  say "  🛑 STOP"
  exit 1
fi

# 2. Any DESTRUCTIVE database change in my edits? -----------------------------
#    The rule: migrations are additive-only. Never drop/rename/wipe.
say ""
say "2) Database safety (additive-only rule)"
DANGER=$(git diff --unified=0 -- '*.js' '*.mjs' 2>/dev/null \
  | grep -E '^\+' \
  | grep -iE 'DROP[[:space:]]+(TABLE|COLUMN|INDEX)|TRUNCATE[[:space:]]|DELETE[[:space:]]+FROM|ALTER[[:space:]]+TABLE[^;]*DROP' \
  || true)
if [ -n "$DANGER" ]; then
  bad "found possible DESTRUCTIVE database change(s) in your edits:"
  printf '%s\n' "$DANGER" | sed 's/^/        /'
  say "        -> migrations must be additive (CREATE TABLE IF NOT EXISTS /"
  say "           guarded ADD COLUMN). Remove these before deploying."
else
  good "no destructive DROP / DELETE / TRUNCATE in your changes"
fi

# 3. Did any reward flag get defaulted ON by accident? ------------------------
say ""
say "3) Feature flags default OFF"
if [ -f lib/features.js ]; then
  if grep -nE 'return true|=> *true|\|\| *true' lib/features.js \
     | grep -viE "dbVal === '1'" >/dev/null; then
    bad "lib/features.js may force a flag ON — every flag must default OFF"
  else
    good "feature switchboard defaults every flag OFF"
  fi
else
  say "  (no lib/features.js yet — skipping)"
fi

# 3b. Nothing heavy or forbidden about to be committed? -----------------------
#     Backstop in case .gitignore is bypassed (e.g. git add -f). These folders
#     and any file over 5 MB must never enter the repo.
say ""
say "3b) No forbidden / oversized files staged"
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
FORBIDDEN=$(printf '%s\n' "$STAGED" | grep -E '^(preflight_snapshots/|public/danknotes/|public/uploads/)' || true)
if [ -n "$FORBIDDEN" ]; then
  bad "these must NEVER be committed but are staged:"
  printf '%s\n' "$FORBIDDEN" | sed 's/^/        /'
  say "        -> run:  git reset HEAD <path>   to unstage them."
fi
BIG=$(printf '%s\n' "$STAGED" | while IFS= read -r f; do
        [ -n "$f" ] && [ -f "$f" ] || continue
        sz=$(wc -c <"$f" 2>/dev/null || echo 0)
        [ "$sz" -gt 5242880 ] && printf '%s (%s bytes)\n' "$f" "$sz"
      done)
if [ -n "$BIG" ]; then
  bad "these staged files are larger than 5 MB (too big for git):"
  printf '%s\n' "$BIG" | sed 's/^/        /'
fi
if [ -z "$FORBIDDEN" ] && [ -z "$BIG" ]; then
  good "nothing forbidden or oversized is staged"
fi

# 4. Does the app actually build? ----------------------------------------------
#    A broken build must never reach the deploy step.
say ""
say "4) Production build (this can take a minute)"
if NODE_ENV=production npm run build >/tmp/unat-safecheck-build.log 2>&1; then
  good "build succeeded"
else
  bad "build FAILED — last lines of /tmp/unat-safecheck-build.log:"
  tail -n 25 /tmp/unat-safecheck-build.log | sed 's/^/        /'
fi

# Verdict ---------------------------------------------------------------------
say ""
say "============================================"
if [ "$RED" = "0" ]; then
  say "  ✅ SAFE TO DEPLOY"
  say ""
  say "  Do these two, in order:"
  say "    1. git add -A && git commit -m \"...\" && git push"
  say "    2. on the host:  cd /var/www/unatrare && bash ops/deploy.sh"
  say ""
  say "  (ops/deploy.sh runs its OWN checks on the host and auto-rolls-back"
  say "   if the new build doesn't render — a broken build can't reach users.)"
else
  say "  🛑 STOP — do NOT deploy."
  say "  Fix the item(s) above, then run  npm run preflight  again."
fi
say "============================================"
say ""
exit "$RED"
