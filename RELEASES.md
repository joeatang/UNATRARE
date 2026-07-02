# UNATRARE — Releases

Named, referenceable builds. Newest first. When you tell me "we're on Studio" or
"roll back to Phase 1," this is the shared language.

Naming: **Phase N — "Codename"** · build ID (Next.js `BUILD_ID`) · date.

---

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
