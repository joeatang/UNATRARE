# Cash Incentive Model - Live Status

Last updated: 2026-06-03 (Phase A execution in progress)

Purpose: single source of truth for where the salute split rollout stands. Use this doc to rehydrate context quickly in a new window/session.

## 1) Current State Summary
- Core split architecture is shipped.
- Production is running latest commit: b2334ff.
- Phase A Pass A baseline is active and healthy.
- Phase A Pass B is blocked by missing artist SOL payout binding on canary card.

## 2) What Is Live in Production
- Split-aware salute verification path (flag-gated).
- Split snapshot fields per salute row.
- Split-aware card/global analytics.
- Admin split verification audit panel + quick filters + severity.
- Artist BTC-signed SOL payout binding path on status flow.

## 3) Phase A Flag State (Current)
- SALUTE_ENFORCE_CEREMONY_WINDOW=1
- SALUTE_ENFORCE_CEREMONY_STRICT=0
- SALUTE_REQUIRE_ARTIST_SPLIT_TX=0
- SALUTE_ENABLE_NODE_PRESET=0

Interpretation:
- Ceremony windows are enforced.
- Strict configured-only mode is off.
- Artist split tx enforcement is currently off (Pass A mode).

## 4) Safety / Data Preservation
- DB backup created before Phase A operations:
  - /var/www/unatrare/data/unatrare.db.phasea-backup-20260603181153
- No destructive schema actions performed.
- All rollout changes were additive.

## 5) Completed Checks (Pass A - Non-blocked)
- PM2 process health: online.
- Local and public ceremony endpoint parity: confirmed.
- Split fields now visible in ceremony payload:
  - splitPreset
  - burnPct
  - artistPct
  - nodePct
  - artistSolAddress
  - requireArtistSplitTx
- Global salute API healthy and returning split-aware totals.

## 6) Active Blocker
- Canary card: RAREUNATPEPE
- Current ceremony payload shows artistSolAddress is empty.
- Without artist payout address, split-enforcement success case cannot pass.

## 7) Required Human Step (Artist)
Artist needs to do one simple action in status page:
1. Paste SOL payout address in "Artist SOL Payout Address".
2. Sign BTC message in same manage listing section.
3. Save changes.

Once complete, engineering can immediately run Pass B end-to-end.

## 8) Next Execution Steps (Immediate)
1. Re-check ceremony payload until artistSolAddress is populated.
2. Enable split enforcement flag:
   - SALUTE_REQUIRE_ARTIST_SPLIT_TX=1
3. Run Pass B matrix on canary card:
   - valid split tx -> pass
   - burn-only tx -> fail
   - wrong ratio tx -> fail
4. Confirm audit events in admin panel:
   - split_missing_artist_leg
   - split_ratio_mismatch
   - split_missing_artist_address (if simulated)
5. Publish Day-0/Day-1 Phase A report.

## 9) Rollback (Ready)
If needed:
1. Set SALUTE_REQUIRE_ARTIST_SPLIT_TX=0
2. Optional: set SALUTE_ENFORCE_CEREMONY_WINDOW=0
3. Restart app with env update.
4. Re-test burn-only salute.

## 10) UI/UX Direction (Artist Simplicity)
- Artist payout section now includes plain-language 3-step setup.
- Goal: non-technical artist can complete payout binding without support.
- Continue measuring friction and tighten copy if support requests repeat.

## 11) Recent Milestone Commits
- 3400ceb - split-aware verification + client tx flow
- f04efd3 - split totals in card API/panel
- 8aaa63b - split-aware global analytics
- 1b5c2bb - admin split verification audit panel
- f28ac1f - severity + quick filters
- a16a948 - tx copy + solscan actions
- 8158f80 - inline copied badge
- 9f0f328 - phase roadmap + UI audit gate
- b2334ff - Phase A canary runbook
