# UNATRARE — Releases

Named, referenceable builds. Newest first. When you tell me "we're on Studio" or
"roll back to Phase 1," this is the shared language.

Naming: **Phase N — "Codename"** · build ID (Next.js `BUILD_ID`) · date.

---

## Phase 5 — "Signal Weight"  ·  build `pending`  ·  2026-07-01

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
