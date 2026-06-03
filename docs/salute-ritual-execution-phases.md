# UNATRARE SALUTE RITUAL - Execution Phases

This plan is built for live production safety.

## Locked Decisions (June 3, 2026)
- Burn floor: minimum 69% of every salute must be burned.
- Spotlight window: 48h only for launch.
- Base mode: salutes remain always open on certified cards.
- Spotlight mode: optional 48h overlay for campaigns and leaderboard momentum.
- Split controls: fixed presets only. No arbitrary custom percentages.

Launch presets:
- Phase 1 default: 69 burn / 31 artist.
- Phase 2 target: 69 burn / 21 artist / 10 nodes pool.

Policy rails:
- Never allow burn below 69% unless governance explicitly approves.
- Split is locked once a spotlight starts.
- Split changes apply to future spotlights only, never retroactively.

## Operating Constraints
- Additive migrations only.
- Feature-flag all new ceremony UI/logic before public enablement.
- Preserve existing burn submission UX while new architecture is built.
- Keep node runner infrastructure behavior unchanged.
- Keep manual TxID fallback available at all times.

## Snapshot: Current Live State
Verified touchpoints:
- Salute verification and ledger:
  - `app/api/salute/route.js`
  - `app/api/salute/history/route.js`
  - `app/api/salute/global/route.js`
  - `app/api/salute/top-wallets/route.js`
- Ceremony controls:
  - `app/api/admin/salute-ceremonies/route.js`
  - `app/api/salute/ceremony/route.js`
- Wallet burn client:
  - `app/components/SalutePanel.js`
- On-chain burn program:
  - `solana/unatrare-salute-burn-program/programs/unatrare_salute_burn/src/lib.rs`
- Existing ceremony behavior:
  - 48h is a default fallback, not a hard cap.
  - Ceremony gating is env-controlled and can be disabled.

## Phase 0 - Clean Baseline + Safety Rails
Status: Ready to execute

Checklist:
- Commit and tag pre-split baseline.
- Preflight snapshot process before each deploy.
- Canary rollout before broad enablement.
- Rollback path documented per feature flag.
- Smoke tests for submit/profile/admin/nodes/metadata and current salute flow.
- Salute ceremony gate flags documented and default-off:
  - `SALUTE_ENFORCE_CEREMONY_WINDOW=0` (default, no behavior change)
  - `SALUTE_ENFORCE_CEREMONY_WINDOW=1` (enforce active ceremony windows for configured cards)
  - `SALUTE_ENFORCE_CEREMONY_STRICT=1` (optional strict mode: reject cards with no ceremony config)

Canary sequence:
1. Keep both flags off in production.
2. Configure one certified card in admin as `active` with explicit start/end.
3. Enable only `SALUTE_ENFORCE_CEREMONY_WINDOW=1` and restart.
4. Verify:
   - configured active card accepts burns,
   - configured inactive/expired card rejects with clear reason,
   - non-configured cards continue to work.
5. Only after validation, decide if strict mode is desired.
6. Rollback is immediate: set both flags back to `0`/unset and restart.

Exit gate:
- No regressions in current live UX/data flow.

## Phase 1 - Policy and Data Foundation (69% floor)
Status: Ready to execute

Shipped:
- `salute_ceremonies` table and indexes in `lib/db.js`.
- New read endpoints:
  - `/api/salute/ceremony`
  - `/api/salute/history`
  - `/api/salute/global`

Next:
- Add additive fields for split accounting (burn, artist, nodes, preset key).
- Add split preset table/config with hard validation enforcing burn >= 69.
- Add integration tests for split validation and aggregates.
- Add feature flag checks around split-aware UI surfaces.

Exit gate:
- Existing salute endpoints remain unchanged and stable.
- New and existing endpoints return deterministic aggregates against production-like data.

## Phase 2 - Artist-First Split (Always Open + 48h Spotlight)
Status: Not started

Scope:
- Keep base salutes always open platform-wide.
- Spotlight overlays use 48h only.
- Introduce preset: 69 burn / 31 artist.
- Enforce split lock at spotlight activation.
- Publish transparent counters:
  - total burned
  - total artist support
  - total saluters and spotlight stats

Exit gate:
- Artist-first split is live with no burn flow regressions.

## Phase 3 - Campaign Layer and Frontpage Highlights
Status: Not started

Scope:
- Keep spotlight fixed at 48h for now.
- Add optional frontpage highlight slots for top burners and active spotlight cards.
- Add campaign controls for future paid reruns (disabled by default at launch).
- Add promo-ready visuals/animation hooks tied to real verified data.

Exit gate:
- Spotlight campaigns can be run repeatedly without changing core fairness rules.

## Phase 4 - Node Share (Phase 2 economics)
Status: Not started

Scope:
- Introduce preset: 69 burn / 21 artist / 10 nodes pool.
- Route node share to pool wallet.
- Add auditable periodic node payout process by heartbeat weight.
- Publish node payout ledger and reconciliation checks.

Exit gate:
- Node share is running with transparent accounting and no burn-floor violations.

## Phase 5 - Controlled Public Rollout
Status: Not started

Scope:
- Cohort-based rollout for split salutes.
- Validate desktop/mobile/manual burn completion rates.
- Monitor rejection reasons, latency, leaderboard freshness, and split reconciliation.
- Weekly transparency update during first month.

Exit gate:
- Go/no-go decision for broad public rollout.
