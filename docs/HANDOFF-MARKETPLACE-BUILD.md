# UNATRARE — Agent Handoff: Marketplace Hardening Build

Purpose: hand the phased marketplace build to another agent. This is self-contained — read it +
the two referenced docs and you can pick up exactly where we left off.

Companion docs (read next):
- `app/docs/marketplace-hardening-plan.md` — the phase plan (P0–P6). THIS IS THE BUILD ROADMAP.
- `HANDOFF-CHECKOUT.md` — the original multi-currency checkout architecture (currencies, catalog, Council).

Deep operational memory (if you share this workspace): `/memories/repo/unatrare-roadmap.md` and
`/memories/repo/unatrare-deploy.md` contain exhaustive per-slice history, gotchas, and verified facts.

---

## 0. Current state (as of 2026-09-22)
- Desktop app is at **v0.1.9**, shipped to Mac + Windows. Feels good; founder is happy with UX.
- The **web marketplace is LIVE but DARK** (`market_public` flag OFF; `/api/market/live` → `{live:false}`).
  Listings + quote + purchase endpoints all work; a real buyer has transacted (paid, awaiting release).
- **START HERE: Phase 0** (oversell/sold-out payment vulnerability). See §7.

---

## 1. Repositories
- **Desktop app** (Electron/Pear): `github.com/joeatang/unatrare-desktop` — **PRIVATE**.
  Local: `/Users/joeatang/UNATRARE/unatrare-desktop-source/unatrare-desktop/`
  Structure: `electron/{main.js,preload.js,artnode.js,wallet.js}`, `renderer/{index.html,app.js,styles.css}`,
  `workers/{main.js,marketplace.js}`, `package.json` (version + `upgrade` pear key).
- **Web app** (Next.js 14): `github.com/joeatang/UNATRARE` — **PUBLIC**.
  Local: `/Users/joeatang/UNATRARE/app/`  (marketplace: `app/lib/market/*`, `app/app/api/market/*`,
  SPA at `app/public/market/index.html`). DB = `node:sqlite` via `getDb()` (NOT better-sqlite3).
- **Trac deep node** (P2P archive + future ledger): `github.com/joeatang/unatrare-intercom`.
  Local: `/Users/joeatang/UNATRARE/intercom/`
- **Server**: `root@unatrare.wtf` (Ubuntu, UTC, Node 22, pm2). Web app at `/var/www/unatrare`.

> **PATH NOTE (important for a fresh clone):** the PUBLIC web repo's root IS the local `app/` dir.
> So when you clone `github.com/joeatang/UNATRARE`, drop the outer `app/` from paths below:
> local `app/lib/market/*` → repo `lib/market/*`; local `app/app/api/market/*` → repo `app/api/market/*`;
> local `app/docs/*` → repo `docs/*`. This handoff + the plan doc live at repo `docs/`.

Access the new agent needs: push rights to the **private** desktop repo + the public web repo; **SSH to
root@unatrare.wtf**; a Mac with Xcode CLT for `codesign` (Mac builds); the `pear` CLI
(`curl https://install.pears.com/pear.sh | sh` — NOT `npm i -g pear`, that installs the wrong major).

---

## 2. Web app deploy (the ONLY safe path)
1. Commit changes in `app/`.
2. `git push origin main`  ← **MUST push first; the host pulls origin.** A local-only commit won't deploy.
3. `ssh root@unatrare.wtf 'cd /var/www/unatrare && bash ops/deploy.sh'` — builds on host (~2–4 min),
   runs a verify-gate + auto-rollback, prints `[deploy] LIVE — verified. build=XXXX`.
4. Pre-flight locally first: `cd app && npm run preflight` (checks no destructive SQL, no forced-on flags, build passes).
GOTCHAS:
- `ops/deploy.sh` does `git stash push -u` (sweeps UNTRACKED files) before pull. `/public/downloads/` is
  gitignored so the app binaries survive — keep it that way.
- Next does NOT serve runtime-added `public/` files; `/downloads/` is served by an nginx `alias` block
  (backup in `/root/nginx-backups/`). Binaries + `latest.json` are managed out-of-band (scp), not via deploy.
- Migrations run on `getDb()`/`initSchema()` — additive ALTERs only, guarded. node:sqlite has NO
  `.transaction()`; use manual `db.exec('BEGIN')/COMMIT/ROLLBACK`.

## 3. Desktop build + ship recipe (verified)
```
cd /Users/joeatang/UNATRARE/unatrare-desktop-source/unatrare-desktop
export PATH="$HOME/.config/pear/bin:$PATH"
# bump version in package.json first (sed), commit, push
rm -rf out
# MAC:
npx electron-forge make --targets @electron-forge/maker-zip
APP="out/UNATRARE-darwin-arm64/UNATRARE.app"
codesign --deep --force --sign - "$APP"          # REQUIRED or macOS says "damaged"
codesign --verify --deep --strict "$APP"          # expect SIG VALID
ditto -c -k --keepParent "$APP" out/mac.zip       # ditto, NOT zip -r (zip -r breaks the sig)
scp out/mac.zip root@unatrare.wtf:/var/www/unatrare/public/downloads/unatrare-mac-arm64.zip
# WINDOWS (cross-build from Mac):
npx electron-forge make --platform win32 --arch x64 --targets @electron-forge/maker-zip
scp out/make/zip/win32/x64/UNATRARE-win32-x64-<ver>.zip root@unatrare.wtf:/var/www/unatrare/public/downloads/unatrare-win-x64.zip
# MANIFEST (drives the in-app update nudge + the /download page version badge):
ssh root@unatrare.wtf 'cat > /var/www/unatrare/public/downloads/latest.json <<JSON
{"version":"0.1.X","mac":"/downloads/unatrare-mac-arm64.zip","win":"/downloads/unatrare-win-x64.zip","notes":"..."}
JSON'
```
GOTCHAS:
- A Windows build **deletes the mac zip from `out/`** — build/upload mac FIRST, or rebuild after.
- `package.json#upgrade` MUST be a valid pear key (`pear touch` sets it). Empty string fails the build.
  Current key is OURS: `pear://nbj6j6o7w7qt1g3a7t9m4k39zm91y4jsk6uzbzdk8b19o6dry7fy`.
- There is NO auto-update yet (Phase 6). Shipping = re-download; the app shows an update-nudge banner.

## 4. Prod processes (pm2) — do NOT touch the fragile ones
- `unatrare` = web app.  `unatrare-artdrive` = isolated art seeder (drive key
  `c55408ba3cbcdd310e5da40d9419c458d8545a985fa30e7c98c402988310e7dc`, serves 249 files).
  `unatrare-tgbot` = push-only Telegram alerts.
- `unatrare-peer` / `unatrare-seeder` = crash-looping trac peers — **LEAVE ALONE**.

## 5. Secrets / config (locations, NOT values)
- `NAT_API_KEY` in `/var/www/unatrare/.env.local` (+ local `~/.zshenv`).
- `ADMIN_PASSWORD` + `ADMIN_SECRET` gate all `/api/admin/*` (HMAC day-token, fail-closed).
- Feature flags toggled in `/admin` → Tools → Feature Flags (settings row `feature:<name>`), or env.
  Relevant: `market_public` (nav link + /live), reward_* flags (rewards economy, mostly dark/accrue-only).
- Market fee/burn env (`FEE_BPS`, `CASH_BURN_BPS`, `FEE_ADDRESS_*`) are LOCAL-only, NOT set on server →
  `quote.fee` is null on prod (single payment to artist verifies; no fee leg required today).

---

## 6. Marketplace: how it ACTUALLY works today (code-grounded audit)
Endpoints (`app/app/api/market/`): `listings` (GET active / POST create), `listing-quote` (rate-locked
quote → `quoteId`), `listing-purchase` (verify payment), `challenge` (BTC sign challenge), `intents` +
`intents/[id]/fulfill` (delivery queue), `order/[id]`, `receipt/[orderId]`, `artist/[address]/orders`, `config`.

- **Listing** (`lib/market/listings.js::createListing`): asset must be Council-approved + revealed;
  ownership = BIP-137 over `UNATRARE:LIST:<ASSET>` from the holding Counterparty (1/3) address;
  live holding check via Counterparty API; artist provides per-currency receive address + price.
- **Quote** (`listing-quote`): returns `quoteId, expiresAt, payTo(=artist addr for that currency),
  amount, total, fee(null on prod), chain, label, decimals`. Locked in a `QUOTES` map (TTL).
- **Purchase** (`listing-purchase`): verifies the on-chain payment reached the artist for ≥ locked
  amount (Solana: `buyerPubkey`; Bitcoin rails: `authAddress`+BIP-137 sig over `UNATRARE:BUY:<txid>`);
  `deliveryAddress` must be Counterparty (1/3); dedup on `txid`. Inserts `checkout_orders` (status
  `paid`) + `release_intents` (status `awaiting_authority`). Returns "paid — awaiting artist release".
- **Delivery is MANUAL**: `intents/[id]/fulfill` lets an authority mark delivered + record a hand-entered
  `delivery_txid`. `release_method='dispenser'` is only a LABEL — no real dispenser exists yet.

### CRITICAL GAPS (this is why we're building the phases)
1. **Oversell/double-spend**: purchase does NOT decrement listing quantity or set sold-out. Same 1-of-1
   can be sold to multiple buyers. **Phase 0 fixes this.**
2. **No sold-out protection**: buyer can pay into an already-sold listing.
3. **No trustless delivery**: manual authority fulfill; buyer trusts the seller. **Phase 2 (dispensers).**
4. **No buyer order-tracking in app** (endpoints exist, UI doesn't surface). **Phase 1.**
5. **Wallet can't SEND XCP** (receive-only view via tokenscan). **Phase 5.**

### Honest framing (tell the founder the same — no hype)
- **Trac** = decentralized tamper-evident LEDGER + P2P distribution (intercom/). NOT payments, NOT a bridge.
- **TAP** = Bitcoin-native token metaprotocol (good for `unatpepe`/`nat` + BTC settlement). NOT a SOL/ETH
  cross-chain bridge. Cross-chain (Phase 4) = verify-payment-then-release, both legs on the ledger + a bond.

---

## 7. WHAT TO DO FIRST — Phase 0 (payment safety rails)
Goal: make overselling impossible + protect buyers from paying into sold-out listings. Small, high-impact.
Files: `app/lib/market/listings.js` (add atomic quantity decrement + `status='sold'` when 0),
`app/app/api/market/listing-purchase/route.js` (decrement in the SAME db step as the order insert; guard),
`app/app/api/market/listing-quote/route.js` (re-check quantity; refuse quotes on sold-out),
desktop `renderer/app.js` (sold-out state in the For-sale lens + a "sold out — you were not charged" guard).
Flag-gate as `market_oversell_lock` (default ON once tested). Additive migration only.
Then Phase 1 (My Purchases / My Sales / glossary), then Phase 2 (dispensers). See the plan doc for P3–P6.

---

## 8. Engineering discipline (how to not break things)
- **The founder often runs the app while you work.** Do NOT `pkill`/relaunch their session. The dev
  instance runs as `node_modules/electron/dist/Electron.app`; the packaged app runs as `UNATRARE` — killing
  the dev instance won't touch theirs, but avoid relaunches when they say they're in-app.
- **Validate without a GUI**: `node --check` all JS; CSS brace balance; `python3` div-balance on index.html.
- **SEE the UI headlessly** (screenshots): Playwright is at `~/natcash/engine/node_modules` — put the `.mjs`
  INSIDE that dir (ESM resolves from the script's folder). Serve `renderer/` via `python3 -m http.server 8799`,
  `addInitScript` a full mock `window.bridge` (catalog/listings/quote/wallet/etc.), `goto` localhost,
  `waitForTimeout(4200)` (safety timer reveals the market), `screenshot` to `/tmp`, `view_image` it.
  To diagnose a visual glitch: `page.evaluate(() => document.elementsFromPoint(x,y))` + getBoundingClientRect
  + getComputedStyle. (macOS `screencapture` of the real window is blocked by screen-recording perms.)
- **Diagnostics log**: main writes to `/tmp/unat-report.log`; renderer `report()` mirrors there;
  `console-message`/`preload-error` also mirror. `[app] node status: peers=1 files=249` repeating = healthy.
- Renderer is sandboxed + contextIsolation + no nodeIntegration + strict CSP; all network is via
  fixed-origin main-process IPC (no SSRF). Keep it that way. Wallet keys NEVER cross to the renderer.

### Known footguns already fixed (don't reintroduce)
- Renderer top-level `const bridge` collides with the contextBridge global → wrap app.js in an IIFE.
- Global `user-select:none` must exempt `input,textarea,select` or paste breaks in packaged builds.
- Packaged Electron needs an app Menu with Edit paste roles (+ context-menu) or Cmd/Ctrl+V is dead.
- `.overlay.hidden` must be `display:none` (not opacity:0) or hidden sheets leave ghost artifacts.
- Watch the index.html `<div` balance — a dropped overlay wrapper renders a sheet loose over the header.
- `.market` must be `align-items:stretch` (it inherits `center` from `.stage`).

---

## 9. Security invariants (never regress)
- Every money-moving change is flag-gated + dark-launched; additive migrations; preflight + verify-gate; canary.
- Payment: rate-locked quotes, idempotent txid, exact-amount tolerance, replay guards, fixed-origin fetches,
  signature scoping (`^UNATRARE:`), native send confirmation, wallet auto-lock (15 min).
- Admin routes all import AND call `verifyAdminToken`. Solana RPC proxy is method-allowlisted.
- Write a short threat-model note before flipping any money flag.
