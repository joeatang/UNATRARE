# UNATRARE SALUTE RITUAL - Execution Phases

This plan is built for live production safety.

## Operating Constraints
- Additive migrations only.
- Feature-flag all new ceremony UI/logic before public enablement.
- Preserve existing burn submission UX while new architecture is built.
- Keep node runner infrastructure behavior unchanged.
- Keep manual TxID fallback available at all times.

## Phase 0 - Live Safety Rails
Status: In progress

Checklist:
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

## Phase 1 - Data Foundation (Additive)
Status: In progress

Shipped:
- `salute_ceremonies` table and indexes in `lib/db.js`.
- New read endpoints:
  - `/api/salute/ceremony`
  - `/api/salute/history`
  - `/api/salute/global`

Next:
- Add integration tests for window filters and pagination.
- Add feature flag checks around new UI surfaces that consume these endpoints.

Exit gate:
- Existing salute endpoints remain unchanged and stable.
- New endpoints return deterministic aggregates against production-like data.

## Phase 2 - Artist-First Card Experience
Status: Not started

Scope:
- Card salute intensity visuals from verified metrics.
- Ritual copy and headline system.
- Public tx-proof drawer and historical ceremony view.
- Reduced-motion and mobile performance fallbacks.

Exit gate:
- Visually upgraded card experience with no burn UX regressions.

## Phase 3 - Admin Ceremony Studio
Status: Not started

Scope:
- Animated admin ceremony state machine:
  - ready -> awaiting-signature -> broadcasting -> confirming -> verified -> synced
- Capture mode for screen recording and marketing clips.
- Verified-only success scenes (no fake success transitions).

Exit gate:
- Reproducible, secure ceremony recordings tied to real verified burns.

## Phase 4 - Winner Verification + Fulfillment
Status: Not started

Scope:
- Winner rule presets (top1/top3/top5/any burner).
- Wallet signature ownership verification.
- Reward address collection and admin fulfillment tracking.
- CSV export for winner proofs.

Exit gate:
- Lightweight but auditable winner verification pipeline.

## Phase 5 - Controlled Public Testing
Status: Not started

Scope:
- Cohort-based rollout for live ceremonies.
- Validate desktop/mobile/manual burn completion rates.
- Monitor rejection reasons, latency, and leaderboard freshness.

Exit gate:
- Go/no-go decision for broad public rollout.
