# UNATRARE — Releases

Named, referenceable builds. Newest first. When you tell me "we're on Studio" or
"roll back to Phase 1," this is the shared language.

Naming: **Phase N — "Codename"** · build ID (Next.js `BUILD_ID`) · date.

---

## 🔜 Next up (planned — not built)

Queued projects, in order. Nothing here is live; all will ship flag-gated OFF.

- **Scarce-status redesign** (refinement of the badges phase — do BEFORE revealing `reward_badges`).
  "Founder" is retired as a generic badge — everyone who claims a block already *is* a Torchbearer
  with a ⛓ Genesis Block, so that's the "you claimed = status." Two **sealed-forever** honors, both
  capped at **69** and ranked by Bitcoin block height / earliest action (un-gameable):
  1. First **69** to claim a genesis block — *name TBD* (Founding Flame / Genesis 69 / First Flame).
  2. First **69** to salute (first burn) — *name TBD* (First Spark / Pioneer).
  Fixes the currently-live ⛓ founder +15 Signal Weight bonus and Hall of Fire "THE FOUNDERS" section,
  which today mislabel every claimer.
- **Rewards P3 — Claim rail** (`reward_claim` 💰). FIRST money-moving phase. Pull-based: users claim
  accrued rewards. Canary tiny pool + tripwires. Founder funds the treasury once + tops up.
- **Rewards P4 — Activity + Bitcoin bonus windows** (`reward_activity`). Shared epoch pool split by
  activity × Signal Weight; opportunistic BTC bonus windows; UNATPEPE/node multipliers (cap 5×).
- **Rewards P5 — Artist grants + tip rail** (`reward_grants` 💰 / `reward_tip` 💰).

Full economy design: `docs/cash-rewards-economy.md`.

---

## Status Everywhere — "Colors That Travel"  ·  2026-07-03

Makes identity status **visible wherever a person shows up**, and lights the 🐸/🖥️
chips by proving the Bitcoin↔Solana link. Additive-only; badges stay behind the
existing `reward_badges` flag. No money moves, no destructive migration.

- **Badges travel.** The colored badge row (previously only on the Torchbearer profile)
  now renders on Hall of Fire founder cards + greatest-flames rows, the Burns wallet
  leaderboard, and the card page's top-torchbearers list — via one batch resolver
  `resolveIdentityBadges(wallets[])` so leaderboards stay cheap.
- **Nodes + UNATPEPE showcased.** `/nodes` rows get a green 🐸 UNATPEPE chip; Hall gains a
  new **"🖥️ The Network"** section with live stat tiles (nodes online / total, UNATPEPE
  nodes, UNATPEPE holders) linking to `/nodes` and `/register`.
- **Signature-proven identity link.** New `wallet_links` table + `lib/walletLink.js`.
  A holder proves they own both wallets by signing two cross-referencing challenges
  (`UNATRARE:LINK:<addr>`) — SOL signs the BTC challenge, BTC signs the SOL challenge.
  New page `/torchbearer/link` + API `/api/torchbearer/link`. Once linked, their 🐸
  (UNATPEPE) and 🖥️ (node) status lights up on every public surface.
- **Scarce honors (first cut).** Retired the generic 🧱 "Founder" chip (everyone who
  claims already is a Torchbearer). Two sealed-forever, capped-at-69 honors computed at
  read time from Bitcoin height / earliest action: **Founding 69** (⛓) and
  **First Spark** (⚡). Final names TBD.

---

## Onboarding — "Front Door"  ·  build `0gLXwU4ItBk06XOOxTJBt`  ·  2026-07-02

New-traffic UX polish from the onboarding audit. No flags, no money, no schema.

- New `/start` page — plain-English "How It Works" (three ways in) + a full **Glossary**
  (UNATRARE, Counterparty, Card, Council, Certified, Salute, Burn, $CASH, Torchbearer,
  Genesis Block, Flame Rank, Signal Weight, Node/UNATPEPE, Vault) + a **How to buy $CASH**
  walkthrough. Linked from desktop nav, mobile drawer, and a homepage hero line.
- `SalutePanel` — always-visible essentials banner: "To salute you need a Solana wallet + $CASH.
  Burning is permanent." (was buried in a collapsed section).
- Standardized the panel term to **Council** across user-facing copy (homepage + metadata,
  `/pay` review banner, whitepaper, admin enrollment byline). Code identifiers unchanged.
- Removed the duplicate artist link on the card page — the "by @handle" frame-footer link
  is now the single artist link (meta-grid row dropped).

---

## Rewards P2 — "Fire Spread"  ·  build `0X1-kOYJhtnGakuMqbDge`  ·  2026-07-02

Referral attribution + rebate accrual — **accrue-only, no money moves**, shipped
**dark** behind the `reward_referral` feature flag (OFF by default, flip in `/admin`).

- New `lib/referrals.js` — first-touch attribution and a 3% rebate ledger. A founder's
  share link (`?ref=<code>`) is captured in the browser (`Nav.js` → localStorage) and
  ridden along on the next salute; the salute route resolves the referrer, checks
  eligibility (referrer ≥ STEADY score 25, referee owns a genesis block, no
  self-referral) and writes an idempotent row to `referral_accruals`. **No $CASH is
  transferred** — this only records what *would* be owed once the claim rail opens.
- New DB tables `referrals` + `referral_accruals` (STRICT, idempotent on `tx_sig`).
- Torchbearer profile gains a "Fire Spread" panel (share link + referees + accrued),
  rendered only when the flag is ON.

## Rewards P1.5 — "Feature Flags panel"  ·  build `A4kLPVSmXuZ3vx7yKoAFD`  ·  2026-07-02

Admin visibility for the rewards flag system. New `FeaturesPanel` in the `/admin`
**⚙ Tools** tab — a collapsible list of every reward flag with ON/OFF toggles.
Money-moving flags show 💰 and require a confirm before turning on.

## Rewards P1 — "Identity Badges"  ·  build `LWRHb2ufLVzQpAXeGzq8y`  ·  2026-07-02

First visible slice of the rewards economy — **visual only, no money**, shipped
**dark** behind the `reward_badges` feature flag (OFF by default, flip in `/admin`).

- New `lib/identityBadges.js` — a server helper that turns a wallet's already-cached
  signals into small "who you are" chips: **Founder** 🧱 (claimed a Bitcoin genesis
  block), **Flame Rank** 🔥 (Signal Weight tier) and **Burn Tier** ✦ (volume saluted).
  Reads only cached tables (`trust_scores`, `torchbearers`) — no network, no writes.
  `getIdentityBadges()` returns `[]` whenever the flag is OFF, so nothing renders.
- New `IdentityBadges` component + CSS — a compact chip row in the fire/amber
  language, wired as a canary into the torchbearer profile header.
- UNATPEPE 🐸 / Node 🖥️ chips are stubbed for later (node identity isn't linked to a
  SOL wallet yet); today the wallet lookup fills Founder / Flame / Burn.

## Rewards P0 — "Safety Harness"  ·  build `JHRzJn26Cz_p2yP89cU4Z`  ·  2026-07-02

Foundation for the rewards economy — all additive, all dark, nothing wired to a
live path. The point: make every future reward feature a switch, not a redeploy.

- `lib/features.js` — the central switchboard. Every reward flag OFF by default,
  fail-closed. Reads the `settings` table (`feature:<name>` = `'0'`/`'1'`, explicit
  `'0'` wins) with an env fallback. Registry covers badges, referral, claim,
  activity, grants and tip.
- `/api/admin/settings` extended so flags toggle instantly from the browser
  (gated by admin token) — no SSH, no redeploy.
- `ops/safe-check.sh` + `npm run preflight` — a read-only pre-deploy green light:
  checks you're in `app/`, no destructive SQL in the diff, no flag forced on, no
  forbidden/oversized files staged, and that the production build passes. Prints
  the exact next commands or a clear STOP.
- `.gitignore` hardened (`/preflight_snapshots/`, `/public/danknotes/`) so a
  `git add -A` can never sweep up heavy artifacts.

---

## Phase 8 — "Split Restored"  ·  build `jBf2KHv4kub_CzqUTHBOI`  ·  2026-07-02

Restores the **69/31 artist split** that two July refactors silently broke
(`b44d13c` dropped the client transfer leg; `0bafdd9` dropped server recording).
`SalutePanel` again builds the burn + artist-transfer atomically and auto-creates
the artist ATA; `/api/salute` verifies the artist leg on-chain and records the
split honestly (lenient by default, `SALUTE_REQUIRE_ARTIST_SPLIT_TX=1` to hard
reject). Adds `ops/salute-split-monitor.sh` — a ledger tripwire (cron, every
10 min) that Telegram-alerts if payout-enabled cards start recording burns with
0 to the artist, so this can never silently regress again.

---

## Phase 7 — "Artist Co-Signs"  ·  build `uQB77cxjtXB4s3Qz3U3WI`  ·  2026-07-01

Trust now flows **from the artists themselves**. A verified artist — a wallet
that owns an approved, Council-certified token — can publicly vouch for any
torchbearer, and that endorsement lifts the torchbearer's Signal Weight.

- **Gas-free, provable.** The artist connects their Solana wallet and signs
  `UNATRARE:COSIGN:<artist>:<torchbearer>` (ed25519 `signMessage`, no gas). The
  server re-verifies the signature against the artist's own key before recording
  anything — Bitcoin/Counterparty ownership stays the root of truth.
- **Bounded weight.** Each distinct artist co-sign adds a fixed amount to Signal
  Weight, capped so no one wallet can be inflated by a single friend
  (`cosignPerArtist` × up to `cosignCapArtists`). One co-sign per artist→torchbearer
  pair (re-signing just updates the note).
- **On the profile.** Every torchbearer page gains an **"Artist Co-Signs"**
  section — the list of vouching artists (with optional short notes) and, for
  verified artists, a one-click **"+ co-sign as an artist"** action. The Signal
  banner shows an "artist co-signs" count when present.
- **Honest states.** Non-verified wallets are told plainly they can't co-sign;
  self-co-signs are rejected; unclaimed torchbearers with zero salutes are an
  accepted edge case (no Signal row until they salute).

New: `app/api/artist/cosign` (GET verify/list, POST record), `lib/artistCosign.js`,
`CosignButton` client component. Extended: `signalWeight.js`,
`torchbearerIdentity.js` (`cosignChallenge`/`verifyCosign`), `db.js`
(`artist_cosigns` table + `trust_scores.cosigns`/`cosign_count`).

## Home Refocus  ·  build `3iOY1r7SIwSFmKYb_5fPX`  ·  2026-07-01

The homepage stops asking visitors to "choose a path" as their first decision
and instead offers **two co-equal doors**, decided in one glance:

- **Support the art →** (`/directory`) — for the community: browse and salute.
- **Submit your art →** (`/submit`) — for artists: issue on Counterparty, get certified.

Both doors carry identical visual weight (amber vs green, same size) — neither
constituency is demoted. Everything below (thesis, Pepe Vault, Council of 8, live
numbers, final CTA) keeps its full presence as a guided scroll. The old five
"path" cards are reframed lower down as a quieter *"where are you coming from?"*
context row rather than a competing call to action. Mobile-first: doors stack on
phones, sit 2-up from 640px.

## Phase 6 — "Living Directory"  ·  build `0FtVH_O2zWVg8fpC4y4uT`  ·  2026-07-01

The directory stops being a static grid and starts telling you *who's behind
each work* and *what's genuinely rising* — using Signal Weight as a reading
glass, never a rewrite. Raw on-chain totals stay canonical everywhere.

- **Signal-weighted momentum.** The "momentum" sort + the "Gaining Momentum"
  strip now weight each recent salute by how trusted its backer is
  (`getCardMomentumBatch`). A salute from a Keeper of the Flame counts for more
  than a fresh wallet — so momentum reflects real conviction, not one whale.
  Gentle, bounded curve (1×–3.5×); unscored wallets fall back to 1×.
- **"Why now" context.** Momentum cards show who's backing — e.g. "1 trusted
  torchbearer backing" — the missing *why*, not just a dollar figure.
- **Artist on every card.** Each directory card now credits its artist
  (`by @handle`), so the grid is people, not just assets. (Hidden on
  as-yet-unrevealed mystery cards.)
- **Event-driven trust refresh (no blind cron).** Scores recompute the moment
  the ledger changes — on a confirmed salute (that wallet) and on a
  certification (early backers of that card). Both non-fatal. A thin scheduled
  reconciliation remains available via `scripts/compute-signal.mjs`.
- Read-only + additive. Default directory order is unchanged; momentum is an
  opt-in lens.
- **Patch `XMHcr5OG1HaRlm3mdrkqp` (2026-07-01).** Momentum cards now display the
  actual 7-day $CASH in the ranking window (labeled "past 7 days") instead of a
  24h figure that read "+0" whenever recent salutes were 1–7 days old — the
  number now matches what drives the ranking. Also tightened the card: dropped
  the catalog sub-line (Sx·#) and shortened the why-now copy ("N trusted
  torchbearer") so the layout no longer feels lopsided on mobile.

## Phase 5 — "Signal Weight"  ·  build `vFjDVhg4TO6Cm3H0VZCtG`  ·  2026-07-01

A recomputable trust score per wallet, derived entirely from existing
on-chain-backed data — rewards conviction that's hard to fake.

- New `trust_scores` table (a rebuildable cache; raw truth stays in `card_salutes`).
- `lib/signalWeight.js` scores each wallet from four signals:
  **EARLY** (saluted before the Council certified), **BROAD** (many distinct
  artists), **SUSTAINED** (active across many days), **FOUNDER** (claimed a
  Bitcoin genesis block), plus a log-scaled base from total $CASH burned.
- Recompute: `POST /api/admin/signal-weight` (admin) or `scripts/compute-signal.mjs`
  (cron-friendly). A wallet's score is also computed lazily on first profile view.
- Torchbearer profile now shows a **Signal Weight banner** — score, tier
  (Kindling → Steady → Trusted → Pillar → Keeper of the Flame), and the
  early/broad/sustained/founder breakdown.
- `resolveSignalWeights()` helper provided for future feed/trending weighting.
- Read-only + additive. No change to how salutes or claims work.

## Phase 4 — "The Hall of Fire"  ·  build `UZ5v9FXFLdlKebeU7PXQ4`  ·  2026-07-01

A permanent monument (distinct from the live `/burns` ledger) at `/hall`.

- **The Founders** — torchbearers who claimed a genesis block, ordered by the
  **Bitcoin block height at claim time** (earliest wins — Bitcoin keeps the order,
  not us). Showcases the Phase 3 identity layer. Hidden torchbearers opt out.
- **Greatest Single Flames** — the largest *single* salutes ever lit (one wallet,
  one tx), with solscan proof. Distinct from `/burns`, which aggregates.
- **Most Honored Artists** — per-artist salute rolls (total $CASH across all their
  cards), each linking to the artist's most-saluted piece.
- Monument stat line: $CASH enshrined, Bitcoin blocks claimed, torchbearers, artists honored.
- All-time only — never windowed, never resets. Read-only, additive, low risk.
- Nav link added (desktop "🏛 Hall" + mobile drawer "🏛 Hall of Fire").

## Phase 3 — "Torchbearer"  ·  build `zazKYKbUJQB7vjh93peDC`  ·  2026-07-01

Bitcoin block-claim supporter identity — "Bitcoin is the source of truth."

- Supporters who salute a card can claim an identity; Bitcoin **randomly deals
  them a genesis block** (provably-fair, hash-seeded), claimed exactly once.
- Handle + profile fields are **optional** — anons show as `Block #N`.
- Identity resolved by handle/block across the card, `/burns`, and
  `/torchbearer/[wallet]` profile pages (hidden-aware).
- `torchbearers` table gains `genesis_block`, `claim_seed_hash`,
  `claim_seed_height` (additive migration; existing data preserved).
- **Fixed:** server-component crash from illegal `onClick` on solscan links in
  `/burns` and the torchbearer profile.

### Phase 3.1 — returning-supporter hooks  ·  build `wqDH9_actYM2qHg47WK71`  ·  2026-07-01

- **Nav CTA** "🔥 Claim Block" (desktop + mobile drawer) — always-visible path.
- **Welcome-back banner** (`ClaimBanner`): silently reconnects a previously-approved
  wallet (`onlyIfTrusted`, no popup) and shows a dismissible "claim your block"
  banner to supporters who've saluted but not yet claimed.
- `GET /api/torchbearer/claim` now reports `eligible` + `saluteCount` for
  unclaimed wallets so the banner knows who to nudge.

### Phase 3.2 — audit hardening  ·  build `ojY9QuUXpuM4z2eV-6_Q_`  ·  2026-07-01

Triple-check pass on redundancy / UX / communication / flow gaps.

- **Flow:** claim page now checks eligibility right after connect — non-supporters
  see a friendly "salute a card first →" state instead of failing *after* signing.
- **Flow:** claim page silently reconnects a trusted wallet (`onlyIfTrusted`) so
  returning supporters arrive pre-recognized (no extra Connect click).
- **Redundancy:** `ClaimBanner` is suppressed on `/torchbearer/claim` itself.
- **Security:** avatar URLs restricted to `http(s)` before storage/render.
- **Anti-abuse:** reserved handles blocked (`admin`, `unatrare`, `satoshi`,
  `council`, `support`, …) ahead of any public announcement.

## Phase 2 — "Studio"  ·  build `_XN6SFmWLMpTAwZh1rCCX`  ·  2026-07-01

Artist Studio consolidation + emergency stabilization.

- Studio routes (`/studio`, `/studio/profile`, `/studio/update`) live; legacy
  `/profile` and `/update` kept as working aliases.
- **Fixed:** database-path bug that broke every live page after a rebuild
  (`lib/db.js` now resolves the DB robustly).
- **Fixed:** studio redirect loop; `/update` missing `official_signal` field.
- **Added:** Ops guardrails — maintenance mode, health alarm, deploy gate with
  rollback, nightly + off-site DB backups, archive audit. See `ops/README.md`.

## Phase 1 — "Foundation"  ·  (pre-guardrails)

Directory, cards, vault, salutes, cash-burn ceremony, council, P2P archive node,
Telegram bot. Data model + judging pipeline established.

---

### How to cut a release
1. `bash ops/deploy.sh` on the host (verifies before going live).
2. Copy the `build:` id it prints.
3. Add a new section at the top here with the phase, codename, build id, date, and
   a one-line summary of what changed.
