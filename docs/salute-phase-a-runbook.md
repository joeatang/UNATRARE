# UNATRARE Salute Phase A Runbook

Purpose: execute a safe canary for split-aware salutes with clear ownership, rollback, monitoring, and communication.

Date: June 2026

## 1) Owners and Contacts
- Product owner: approves go/no-go at each gate.
- Engineering owner: executes config/code checks and validates API behavior.
- Ops owner: applies env flags, restarts app, monitors runtime health.
- Comms owner: posts canary status updates and incident notes.

## 2) Scope of Phase A
- Validate split-aware salute behavior in production-like conditions.
- Keep blast radius small (single certified canary card first).
- Confirm both modes:
  - split enforcement off: legacy burn flow still works.
  - split enforcement on: split math and artist leg are enforced.

## 3) Preconditions (Must Be True Before Start)
- Repo on target server is up to date and app builds cleanly.
- Admin tools are accessible and auth is working.
- Canary card is approved and has artist payout address configured.
- Artist payout wallet has a valid $CASH token account.
- Monitoring access available for API errors and salute audit panel.
- Rollback command is prepared and tested (Section 9).

## 4) Environment Flags Matrix
Recommended Phase A defaults:
- SALUTE_ENFORCE_CEREMONY_WINDOW=1
- SALUTE_ENFORCE_CEREMONY_STRICT=0
- SALUTE_REQUIRE_ARTIST_SPLIT_TX=0 (first pass), then 1 (second pass)
- SALUTE_ENABLE_NODE_PRESET=0

Notes:
- Keep strict mode off during first canary to avoid blocking non-configured cards.
- Turn SALUTE_REQUIRE_ARTIST_SPLIT_TX on only after baseline pass is green.

## 5) Preflight Checklist (Ops + Engineering)
1. SSH to prod and confirm app health:
   - pm2 status
   - curl /api/salute/global
   - curl /api/salute/top-wallets
2. Confirm DB migrations already include split fields:
   - card_salutes has artist/node/snapshot columns.
3. Confirm ceremony config exists for canary card in admin panel.
4. Confirm artist SOL payout binding exists for canary card.
5. Confirm canary card ceremony window is active (or about to activate).
6. Record baseline metrics snapshot before changes:
   - salute success rate
   - 422 verification failures
   - RPC errors

## 6) Canary Execution Plan

### Pass A - Legacy safety check (split enforcement OFF)
1. Set SALUTE_REQUIRE_ARTIST_SPLIT_TX=0 and restart app.
2. Submit one valid burn-only salute on canary card.
3. Expected results:
   - salute accepted
   - leaderboard updates
   - no abnormal error spike

Gate A: continue only if all expected results pass.

### Pass B - Split enforcement check (split enforcement ON)
1. Set SALUTE_REQUIRE_ARTIST_SPLIT_TX=1 and restart app.
2. Test tx variants on canary card:
   - Valid transfer+burn tx with correct ratio -> must pass.
   - Burn-only tx -> must fail.
   - Transfer+burn with wrong ratio -> must fail.
3. Validate audit trail in admin salute verification panel:
   - split_missing_artist_leg
   - split_ratio_mismatch
   - split_missing_artist_address (if simulated)

Gate B: continue only if acceptance/rejection behavior matches policy exactly.

## 7) Visual/UX Audit Gate (Mandatory)
Run this before declaring canary complete:
1. Desktop and mobile pass of salute panel states:
   - connect, loading, confirm, success, error.
2. Verify clarity of split explanation copy on active split ceremony.
3. Verify no clipping, overflow, or misaligned controls.
4. Verify action feedback is immediate:
   - copy badge,
   - refresh states,
   - error messages.
5. Verify audit panel readability and triage speed for operations.

Gate UX: design owner and engineering owner both sign off.

## 8) Monitoring During Canary (Day 0)
Track every 15-30 minutes:
- Success/failure counts for /api/salute POST.
- Split failure event mix from admin audit panel.
- RPC timeout/error rates.
- Leaderboard freshness and aggregate consistency.
- Wallet-specific issue patterns (if any).

Escalation triggers:
- sustained 422 spikes unrelated to known invalid tests,
- elevated RPC failures,
- user-visible salute submission regressions.

## 9) Rollback Plan (Immediate)
If any gate fails:
1. Set SALUTE_REQUIRE_ARTIST_SPLIT_TX=0.
2. Optionally set SALUTE_ENFORCE_CEREMONY_WINDOW=0 if needed.
3. Restart app process.
4. Re-test one burn-only salute.
5. Post rollback notice to internal channel with reason and timestamp.

Rollback success condition:
- burn-only salute path is healthy and stable.

## 10) Comms Template (Internal)
Status update format:
- Phase: A Pass A or A Pass B
- Environment: production canary
- Card: TOKENNAME
- Flag state: list active salute flags
- Result: green or blocked
- Issues: short bullets
- Next action: continue, rollback, or fix-forward

## 11) Day-1 Report Template
- What shipped:
- What passed:
- What failed:
- Top failure reasons (from audit panel):
- UX findings and fixes:
- Policy/flag changes made:
- Recommendation:
  - proceed to broader rollout,
  - repeat canary,
  - pause and patch.

## 12) Exit Criteria for Phase A Complete
- Pass A and Pass B both green.
- No unresolved critical UX issues.
- Rollback tested and confirmed.
- Day-1 report published.
- Go/no-go decision recorded for next phase.
