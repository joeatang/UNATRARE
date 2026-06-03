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
- Phase 2 target: 69 burn / 21 artist / 10 nodes pool (feature-flagged until enabled).

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

## Launch Operations (Must Be Detailed Before Public Push)
Purpose: launch cleanly, avoid confusion, and prevent rushed policy drift.

Required launch pack for each phase:
1. Owner list:
  - product owner,
  - engineering owner,
  - ops/deploy owner,
  - comms owner.
2. Ship checklist:
  - migration applied,
  - feature flags set,
  - canary verified,
  - rollback command tested,
  - announcement copy approved.
3. Day-0 monitoring:
  - salute success rate,
  - verify error rate,
  - RPC failure rate,
  - leaderboard freshness,
  - split reconciliation sanity checks.
4. Day-1 report:
  - what shipped,
  - what failed,
  - what changed,
  - next actions.

## Visual Experience Gate (Mandatory Every Phase)
Purpose: maintain premium feel and trust, not just technical correctness.

UI/UX audit checklist (required before each phase goes public):
1. Layout rhythm:
  - spacing scale is consistent,
  - no cramped controls,
  - no dead whitespace blocks.
2. Typography and readability:
  - hierarchy is obvious at a glance,
  - labels and microcopy are concise,
  - mobile text remains readable without zoom.
3. Interaction quality:
  - button states are clear (idle/loading/success/error),
  - no ambiguous click targets,
  - copy and external-link actions give immediate feedback.
4. Motion and pacing:
  - animation supports meaning,
  - no distracting or jittery transitions,
  - loading states do not feel stalled.
5. Cross-device pass:
  - desktop, tablet, mobile checked,
  - wallet flow checked on at least one mobile wallet browser,
  - no horizontal overflow.
6. Brand/polish review:
  - visual language feels intentional,
  - ceremony moments feel ceremonial,
  - no placeholder-looking UI in production surfaces.

Exit gate:
- Design owner and engineering owner both sign off that UI quality is release-grade.

## Salute Wizard Expansion (Admin Flexibility)
Goal: keep split rules strict while making distribution planning flexible.

Admin wizard must support:
1. Fixed split preset selection (no custom percentages).
2. Distribution logic mode selection:
  - none,
  - top burners,
  - weighted burners,
  - raffle burners,
  - manual curated.
3. Distribution asset field (what will be distributed).
4. Distribution rule notes field (human-readable rule intent).

Note:
- Distribution automation is staged later.
- Launch focus stays on split testing + ceremony control + transparent policy.

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
  - Spotlight activation is fixed at 48h.
  - Ceremony gating is env-controlled and can be disabled.

## Phase 0 - Clean Baseline + Safety Rails
Status: Ready to execute

Operational runbook:
- See `docs/salute-phase-a-runbook.md` for owner map, command flow, canary gates, rollback, comms, and UX audit sign-off.

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
Status: In progress (core shipped)

Shipped:
- `salute_ceremonies` table and indexes in `lib/db.js`.
- Split preset and distribution planning fields in `salute_ceremonies`.
- New read endpoints:
  - `/api/salute/ceremony`
  - `/api/salute/history`
  - `/api/salute/global`
- Per-salute split snapshot fields in `card_salutes`.
- Split-aware global/top-wallet analytics outputs.
- Admin split verification audit API + panel.

Next:
- Add integration tests for split validation and aggregates.
- Add feature flag checks around split-aware UI surfaces.
- Add ops runbook per launch phase (owner mapping, canary commands, rollback).
- Add production E2E validation checklist for split-on and split-off modes.

Exit gate:
- Existing salute endpoints remain unchanged and stable.
- New and existing endpoints return deterministic aggregates against production-like data.

## Phase 2 - Artist-First Split (Always Open + 48h Spotlight)
Status: In progress (enforcement shipped, rollout pending)

Scope:
- Keep base salutes always open platform-wide.
- Spotlight overlays use 48h only.
- Introduce preset: 69 burn / 31 artist.
- Enforce split lock at spotlight activation.
- Enable admin wizard controls for distribution planning (mode, asset, rule notes).
- Publish transparent counters:
  - total burned
  - total artist support
  - total saluters and spotlight stats

Shipped:
- Client can build split salute tx when required.
- Server verifies artist leg + burn/artist ratio when split enforcement flag is enabled.
- Artist SOL payout binding is wired into BTC-signed artist update flow.
- Card panel and analytics expose burn vs artist totals.

Next:
- Run live canary ceremony with split enforcement enabled.
- Record rejection reason distribution and wallet compatibility results.
- Approve launch comms copy that explains split behavior in plain language.

Exit gate:
- Artist-first split is live with no burn flow regressions.

## Phase 3 - Campaign Layer and Frontpage Highlights
Status: Ready after Phase 2 canary

Scope:
- Keep spotlight fixed at 48h for now.
- Add optional frontpage highlight slots for top burners and active spotlight cards.
- Add campaign controls for future paid reruns (disabled by default at launch).
- Add promo-ready visuals/animation hooks tied to real verified data.

Exit gate:
- Spotlight campaigns can be run repeatedly without changing core fairness rules.

## Phase 3.5 - UX/Visual Excellence Sweep
Status: Not started

Scope:
- Full UI review of salute surfaces (admin tools, salute panel, analytics views).
- Pixel-level spacing and typography pass.
- Interaction pass for all key actions:
  - connect,
  - burn/split submit,
  - error recovery,
  - audit actions.
- Mobile wallet browser pass for pacing and readability.
- Copy pass for creative-director tone consistency.

Exit gate:
- No major UI friction findings remain open.
- Interface quality sign-off captured in launch report.

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
