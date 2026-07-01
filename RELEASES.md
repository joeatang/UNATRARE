# UNATRARE — Releases

Named, referenceable builds. Newest first. When you tell me "we're on Studio" or
"roll back to Phase 1," this is the shared language.

Naming: **Phase N — "Codename"** · build ID (Next.js `BUILD_ID`) · date.

---

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
