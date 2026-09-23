# UNATRARE — Agent Handoff: Marketplace Hardening Build

Purpose: hand the phased marketplace build to another agent. This is self-contained — read it +
the two referenced docs and you can pick up exactly where we left off.

Companion docs (read next):
- `app/docs/marketplace-hardening-plan.md` — the phase plan (P0–P6). THIS IS THE BUILD ROADMAP.
- `HANDOFF-CHECKOUT.md` — the original multi-currency checkout architecture (currencies, catalog, Council).

Deep operational memory (if you share this workspace): `/memories/repo/unatrare-roadmap.md` and
`/memories/repo/unatrare-deploy.md` contain exhaustive per-slice history, gotchas, and verified facts.

---

## 0. Current state (as of 2026-09-23)
- **Web repo `github.com/joeatang/UNATRARE` HEAD = `958d028`** (Next 14.2.29, Node 22). Cut your next
  patch against THIS. Prod build verified `rN_rB31A5h1hh64FKFzoI`.
- **Desktop repo `github.com/joeatang/unatrare-desktop` HEAD = `a6e1bd6`, shipped v0.1.14** (Mac + Windows,
  ad-hoc signed). `latest.json` = 0.1.14.
- **Phases 0 → K are DEPLOYED (dark)**: oversell-lock, my_orders, dispenser trustless-delivery,
  reputation, Telegram sale-notify, offers, auctions, messages (v2 private/anti-spam), BIP-322 segwit
  listing. Everything additive + flag-gated. Full per-slice log in §11.
- **LIVE FLAG STATE on prod (`/api/market/config`)**: `market_my_orders=ON`, `market_offers=ON`,
  `market_auctions=ON`, `market_messages=OFF`. (offers/auctions were flipped ON server-side by the
  founder; messages stays dark until the desktop UI matches.) `market_public` (the master nav/live
  gate) is still OFF — the marketplace is LIVE-but-DARK to the public.
- **NEW: our own Pear OTA release channel is stood up** (single-key). See §10 — that's your next task:
  wire the upgrade key + `pear.stage.ignore` into desktop `package.json`, add the updater worker, then
  we test an OTA update end-to-end.
- Governing loop is unchanged: §0.5 interface contract. Patches only, cut against current HEAD, no direct
  pushes to `origin/main` (Copilot owns the branch).

---

## 0.5 INTERFACE CONTRACT (Emblem ↔ Copilot) — standing protocol, do NOT re-negotiate
This is the fixed loop. Follow it every phase without asking again.
- **Roles:** Emblem builds ~99.9% (code + tests + one `.patch` + threat-model note per phase).
  Copilot verifies + does the last mile (apply → preflight → push → `deploy.sh`; desktop build/codesign/ship).
- **Base commit:** cut every patch against the **current `origin/main` HEAD** of the target repo.
  After each deploy, Copilot reports the NEW HEAD; Emblem re-pulls and rebases the next phase on it.
  Current bases: web `github.com/joeatang/UNATRARE` = `fbc5404` (Node 22, Next 14.2.29);
  desktop (from zip) = `97082a1` (Electron 40.2.1).
- **Delivery:** ONE self-contained patch per phase, served as a **downloadable raw `.patch` URL**
  (never pasted text — avoids CRLF/whitespace mangling). `git format-patch` or `git diff` both fine.
  Flag-gated, additive-migration-only, + a short threat-model note.
- **Apply (Copilot):** WEB → `cd ~/UNATRARE/app` (NOT `~/UNATRARE`, that's not a repo) →
  `curl -O <url>` → `git apply --3way <file>` → `npm run preflight` → `git push origin main` →
  `ssh root@unatrare.wtf 'cd /var/www/unatrare && bash ops/deploy.sh'` → flip `feature:<flag>` in /admin → canary.
  DESKTOP → apply in `~/UNATRARE/unatrare-desktop-source/unatrare-desktop`, then Copilot builds/codesigns/ships.
- **Authority:** `ops/deploy.sh` verify-gate + auto-rollback is the final word on "is the build green on prod."
  Emblem ships `node --check` + real `node:sqlite` logic tests + headless-renderer QA already done.
- **Desktop seam (Emblem cannot):** real Pear/Electron GUI, real cross-machine multi-peer P2P, installer
  build/sign, broadcasting signed txs. Everything else (headless renderer QA, node --check, in-process
  hyperbee logic tests, live-RPC verifier tests, unsigned tx composition) Emblem executes for real.
- **Money flags stay OFF** until Copilot canaries. Threat-model note required before any flip.
- **Loop:** Emblem: patch URL + threat note → Copilot: apply/verify/deploy → reports result + new HEAD →
  Emblem: next phase on new HEAD. No capability re-negotiation.

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
  The key that CURRENTLY ships in 0.1.14 is the template-derived `pear://nbj6j6o7w7qt1g3a7t9m4k39zm91y4jsk6uzbzdk8b19o6dry7fy`.
  **We have now minted OUR OWN OTA line `pear://y9dd5w9sgbcxike8n8tesy6k4rqw7cp8bcekqde4sfc34j8j66uo`
  (see §10) — switch `package.json#upgrade` to it when wiring auto-update.**
- Auto-update infra is now bootstrapped (§10: our key + a live public seeder). The updater WORKER is
  still TODO (your job). Until it ships, shipping = re-download; the app shows an update-nudge banner.

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

---

## 10. Desktop OTA release channel — HANDOFF (this is your next task)
Stood up 2026-09-23 (single-key; no multisig, no Apple notarization yet — deliberately deferred).
The channel + a live public seeder exist. What remains is the app-side updater. Split of work below.

### 10.1 What Copilot already did (done, verified)
- **Minted OUR OWN release key** on the Mac via `pear touch` (Foundational Step 0):
  - Upgrade link (base): `pear://y9dd5w9sgbcxike8n8tesy6k4rqw7cp8bcekqde4sfc34j8j66uo`
  - The **Mac holds the secret key** → the Mac is the ONLY machine that can `pear stage` to this line.
    (Copilot runs staging; that's the desktop seam per §0.5.)
- **Staged a bootstrap v1** from the desktop repo source (versioned `pear://0.39.y9dd5w9…`,
  app `unatrare-desktop@0.1.14`, ~946 kB, drive key `07c63dd3…`, content key `54335778…`).
  This is just to prove the pipe; it will be superseded by your real release stage (versions only go UP —
  **no downgrade path**, a rollback must be re-staged at a HIGHER version).
- **Stood up the PUBLIC seeder** on `unatrare.wtf` as pm2 process **`unat-seeder`** (id 5 — DISTINCT from
  the crash-looping `unatrare-seeder` id1; do NOT touch id1). It reports **`firewalled: false`, NAT
  consistent**, fully replicated the drive, and serves it independently (survives Mac going offline;
  `pm2 save`'d so it survives reboot). Server runtime is genuine Holepunch Pear v2.0.1 at
  `/root/.config/pear/bin/pear` (NOT the Ubuntu `/usr/bin/pear` PHP-PEAR shim, though that one also
  chains to it).

### 10.2 STAGING GOTCHA you must know (bit us once)
`pear stage` does **NOT** honor `.gitignore`, and the desktop repo has no `pear.stage.ignore`. A bare
`pear stage` drags in `out/` (~30k files incl. bundled `node_modules`) and even `.git/`. Two fixes:
1. **Add a persistent ignore to desktop `package.json`** (your edit — cleanest): a `pear` block with
   `"stage": { "ignore": [".git","node_modules","out","todo",".DS_Store",".github", <loose dev artifacts>] }`.
2. Until then, Copilot stages with an explicit `--ignore` flag (verified to yield a clean 52-file source
   drive). `pear.json` currently holds only PLACEHOLDER multisig pubkeys (`<PUBKEY_HERE>`) — unused for
   single-key; leave it for the future multisig step.

### 10.3 What YOU (Emblem) do next
1. Set desktop **`package.json#upgrade` = `pear://y9dd5w9sgbcxike8n8tesy6k4rqw7cp8bcekqde4sfc34j8j66uo`**
   and add the `pear.stage.ignore` block from 10.2. Deliver as a desktop `.patch` per §0.5.
2. Add/enable the **updater worker** (`workers/*` + main-process wiring) using `pear-runtime-updater`
   (see `agent_docs/updates.md` for the flow + the one-shot-latch footgun: `applied=true` is set BEFORE
   the swap and the worker handler has no try/catch → every failure is a silent hang; add a try/catch +
   failure reply). Keep it behind a flag / `--updates` gate so dev runs don't try to self-apply.
3. Hand Copilot the patch. Copilot applies → builds/ships → **stages the new version to the OTA line on
   the Mac** (`pear stage <link> --ignore …`) → the `unat-seeder` serves it → we launch the packaged app
   and confirm it pulls + applies the update end-to-end.

### 10.4 Division of labor (per §0.5 desktop seam)
- **Copilot only** (needs the Mac + the secret key + SSH): `pear touch`, `pear stage`, running/monitoring
  the seeder, building/codesigning/shipping, the live end-to-end OTA test.
- **Emblem**: the `package.json` upgrade-key + ignore edit, the updater worker code + its logic tests,
  and (later) the multisig config when we graduate off single-key.
- **Deferred (needs founder):** Apple Developer account → Developer-ID signing + notarization (Path B);
  the multisig key ceremony (needs ≥3 machines each seeding, per `agent_docs/releases.md`).

---

## 11. Session log — what shipped 2026-09-23 (newest first)
- **web `958d028`** — messaging v2 (private, anti-spam): public board → per-piece private threads gated by
  buyer STANDING (existing offer/order, else 403); link-sanitized bodies (phishing/drainer strip);
  reportable; artist replies operator-token-gated. Additive idempotent `ALTER TABLE messages ADD COLUMN`
  over a hardcoded col list; all SQL parameterized. Flag `market_messages` (stays DARK). Deploy build
  `rN_rB31A5h1hh64FKFzoI`.
- **web `8c885c2`** — offers + auctions + messages(v1) + BIP-322. Non-custodial offers/auctions (signed
  intents, NO escrow → convert to a normal verified purchase on accept/close); each route hard-gates on its
  flag; offers/accept also `OPERATOR_TOKEN`-gated. `USDT_ETH` currency registered `verifier:null` (disabled).
  BIP-322 additive (legacy 1/3 → bip137 unchanged; new bc1q → bip322). Build `3Jo778AaPjcA5fpFrnIqN`.
- **web `6462f0a`** — (pushed by Emblem earlier, before the direct-push freeze) my_orders, dispenser
  trustless-delivery, reputation, Telegram sale-notify, search/filter/sort, artist profiles. Build
  `2Kl_ziwdqvcbqBctdoogk`.
- **web `ab56486`** — Phase 0 oversell/sold-out lock (`market_oversell_lock`).
- **desktop `a6e1bd6` v0.1.14** — auto-refresh (new pieces/listings appear without relaunch).
- **desktop `40ee17d` v0.1.13** — v0.1.11 parity + market phase UIs (My Purchases, search, offers/auctions/
  messages, watchlist, glossary, artist profiles, dispenser status).
- **RELAY RULE (learned the hard way):** patches must be cut against the CURRENT `origin/main` HEAD.
  Emblem previously ALSO direct-pushed to `origin/main`, which stale-based a patch mid-flight and caused a
  divergence. Resolution (founder decision): **Emblem sends patches ONLY; Copilot owns `origin/main`; no
  more direct pushes.** Before applying any patch, Copilot `git fetch` + confirms HEAD == the patch's base.
