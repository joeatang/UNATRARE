# $CASH Rewards & Referral Economy — Long-Term Map

Last updated: 2026-07-02 · Status: **DESIGN / planning (not built)**

Purpose: single reference for the rewards + referral economy — how much $CASH to
hold on hand, what each tier earns, and how we keep it from being gamed. This is
the "map" behind roadmap item 8 (*Fire Spread / Referrals*) and the high-tier
"work-to-earn via Bitcoin activity" idea.

Design goals (from the founder, verbatim intent):
- **Triple-win:** the artist wins → the community backing the artist wins → the
  platform inevitably wins.
- **Not every action earns.** Low tiers earn *status*; only *earned* higher tiers
  unlock real $CASH earning. This is the primary anti-farming gate.
- **Dynamic earning via Bitcoin activity** at the top tier — users *work* to earn.
- **Finite, simple treasury** we can size and hold — no minting (bonding-curve token).
- **Bitcoin is the source of truth** — every reward-triggering event is anchored to
  a BTC block height / provable on-chain action.
- **95%+ hands-off** — the founder funds a treasury wallet once (and tops it up when
  they choose). Everything else — tier math, holder checks, node checks, reward
  accrual, payout — runs automatically. No per-payout approvals.

---

## TL;DR in plain language

- We are **only adding a rewards layer** on top of tiers/badges that already exist.
  Nothing gets replaced.
- You drop a fixed pot of $CASH into a **treasury** (recommend 75B). It pays out a
  shrinking slice each month (like Bitcoin's halving) so it **never runs dry** and
  **early supporters earn the most**.
- **Low ranks earn status/badges, not cash.** You must *earn your way up* to a mid
  rank before real $CASH flows — this is what stops bots/farmers.
- People earn **any time they participate** (universal). If they *happen* to be active
  during special Bitcoin moments, they earn a **bonus** — bigger the higher their rank.
- **UNATPEPE holders** and **pepenode runners** each get their own special badge and
  their own earning **multiplier**, so both cohorts feel uniquely rewarded.
- It runs itself: users **claim** what they've earned (like claiming a block); the
  founder never signs individual payouts.

---

## 0) Grounding numbers (real, 2026-07-02)

| Metric | Value |
|---|---|
| $CASH total supply | **3.934 T** (bonding-curve, 6 decimals — platform can only *hold*, never mint) |
| Lifetime salutes | 234 |
| **Unique wallets ever** | **11** |
| Cards saluted | 62 |
| Lifetime $CASH burned | ~163 B |
| Weekly burn | 17–44 B (avg ~32 B) |
| Avg single salute | ~0.70 B |
| Active wallets / week | 3–9 |

**Read:** we are *very* early (11 wallets). This program is a **growth engine**
first. And with so few actors, a naive "every action pays" design gets farmed on
day one — hence the tiered, earn-your-way-in gate.

---

## 1) The treasury (finite, simple)

One **Flame Treasury** — a pre-funded $CASH reserve we buy and hold. Recommended
seed: **75 B $CASH** (midpoint of the 50–100 B appetite ≈ **1.9% of supply**).

The 69/31 split (**69% burn · 31% artist**) is **NOT touched.** Rewards are funded
entirely from this separate treasury. (Optional future top-up: an *additive* node
tip — see §6 — never carved from the sacred split.)

### Three envelopes inside the one treasury
| Envelope | Share | Purpose |
|---|--:|---|
| **Growth Reserve** | 70% (~52.5 B) | referral rebates + the Bitcoin-activity earning pool |
| **Artist Milestone Grants** | 20% (~15 B) | keeps artists winning on top of their 31% |
| **Ops / buffer** | 10% (~7.5 B) | bounty overflow, corrections, launch promos |

### Emission rule — Bitcoin-halving-style decay (this is what makes a *finite*
### treasury last)
The Growth Reserve pays out on **epochs**, and each epoch distributes a fixed
fraction of the **remaining** reserve. Recommended:

- **Epoch = 1 Bitcoin month** (~4,032 blocks, provably fair, on-theme). ~13/yr.
- **Payout per epoch = 10% of the remaining Growth Reserve.**

This is a geometric decay — mathematically it **can never drain to zero**, it is
**front-loaded** (rewards early adopters, exactly like Bitcoin's issuance curve),
and every epoch's pool is **known and announced in advance** so people know what's
on the table.

| Epoch (month) | Pool paid | Reserve left |
|--:|--:|--:|
| 1 | 5.25 B | 47.25 B |
| 2 | 4.73 B | 42.52 B |
| 3 | 4.25 B | 38.27 B |
| 6 | ~3.1 B | ~28 B |
| 12 | ~1.7 B | ~15 B |
| — | ~year-1 total ≈ 37 B | ~15 B still in reserve |

Tune the two knobs (seed size, decay %) to stretch or compress the runway.

### 1a) Does it survive rapid growth? (100 → 1,000 → 100,000 users) — YES

**The single most important property: outflow is CAPPED no matter how many people
show up.** The month-1 pool is *always* ~5.25B whether 3 or 100,000 users arrive.
The treasury **cannot overspend or drain** — the math self-throttles, so it never
"breaks."

What *does* change is cash-per-head (a fixed pot split more ways). Assuming ~20% of
active users reach the TRUSTED earning gate:

| Active users | Eligible earners | Base $CASH / earner / mo | Feels like |
|--:|--:|--:|---|
| 100 | 20 | 262.5 M | meaningful |
| 1,000 | 200 | 26.3 M | status-tier |
| 10,000 | 2,000 | 2.6 M | status-tier |
| 100,000 | 20,000 | 262.5 K | symbolic |

This is **correct behaviour for a finite pot**, not a bug — but on its own, base
emission alone becomes symbolic past ~1,000 users. The fix is built into the design:

**The optional tip / top-up is the SCALING lever.** At scale, burn volume is huge, so
a tiny top-up dwarfs the base emission and grows *with* the community — automatically:

| Active users | Est. monthly burn | 1% tip top-up / mo | Effective monthly pool |
|--:|--:|--:|--:|
| 1,000 | ~1,750 B | 17.5 B | ~22.8 B |
| 10,000 | ~17,500 B | 175 B | ~180 B |
| 100,000 | ~175,000 B | 1,750 B | ~1,755 B |

So the model has **two layers**: a fixed, unbreakable **floor** (the 75B treasury) +
an activity-proportional **top-up** that scales rewards with success. Founder does
nothing — the top-up is a % of activity. **75B is only 1.91% of supply; year-1 base
emission is 0.96%.** Conservative even before top-ups.

**Takeaway:** the math is safe at every scale. Early = generous per-head (great for
growth). Massive scale = rewards shift toward status/badges + windows, with the tip
top-up keeping cash meaningful. Nothing ever over-pays or runs dry.

---

## 2) The tier ladder (Flame Ranks)

**Reuse the live Signal Weight tiers — do not invent a parallel system.**
Signal Weight already scores conviction that is hard to fake (real burns, breadth
across artists, early backing before certification, tenure, artist co-signs).

| Rank | Signal Weight | Earns $CASH? | Unlocks |
|---|--:|:--:|---|
| **KINDLING** | 0+ | ❌ | status, profile, referral link active, activity multiplier |
| **STEADY HAND** | 25+ | ⚠️ *indirect* | **referral rebates** (earn only when referrals actually burn) |
| **TRUSTED** | 60+ | ✅ base | **Bitcoin-activity earning program** (base multiplier) |
| **PILLAR** | 120+ | ✅ boosted | higher earning multiplier + bounty access |
| **KEEPER OF THE FLAME** | 250+ | ✅ max | max multiplier, curation/governance earning, exclusive drops |

**The gate:** no direct $CASH flows to a wallet below **TRUSTED (60)**. You *earn
your way in* through real, costly, Bitcoin-anchored participation. That single rule
kills most farming before it starts.

### 2a) Badges & multipliers (both cohorts get special recognition)
Badges are **cosmetic recognition**; multipliers are **how much bigger your slice of
the earning pool is**. All are detected automatically (no manual granting).

| Badge | Who | Detected via | Earning multiplier |
|---|---|---|--:|
| 🔥 **Flame Rank** | everyone (KINDLING→KEEPER) | Signal Weight (live) | 1.0× → 3.5× |
| 🐸 **UNATPEPE Holder** | verified BTC holder of UNATPEPE | TAP check (`/api/check-unat`, live) | **+ special holder boost** |
| 🖥️ **Pepenode Runner** | runs a P2P archive node | node registry heartbeat (live) | **+ special runner boost** |
| ⛓ **Founder** | holds a genesis block | torchbearers.genesis_block (live) | small holding bonus |
| 🎨 **Artist** / 🏛 **Council** | verified artist / council | existing verification | dedicated rails (§3.3) |

**Stacking (with a cap so it never runs away):**
```
yourMultiplier = flameRankMult
              × (isUnatpepeHolder ? UNATPEPE_BOOST : 1)
              × (isNodeRunner    ? NODE_BOOST     : 1)
capped at MAX_MULT   // e.g. 5×, so no single wallet dominates a pool
```
Recommended starting boosts (tunable): **UNATPEPE holder 1.5×**, **node runner 1.4×**,
`MAX_MULT = 5×`. A KEEPER who both holds UNATPEPE and runs a node hits the 5× cap —
maximum recognition, but still bounded so the pool stays fair for everyone else.

Why holders/runners get a *multiplier* not a fixed payout: it makes their status
**worth it every single epoch** (your ask — "make it worth it") without creating a
fixed bounty that can be farmed. Their edge shows up as a bigger share whenever they
participate at all.

---

## 3) Three reward rails

### Rail 1 — Fire Spread (referrals · growth)
- Referral code is tied to a **claimed torchbearer** (genesis block = one per
  wallet, salute-gated → sybil-resistant).
- You earn **only when your referral makes a real burn** (a costly action — cost to
  fake > reward).
- Reward = **rebate ≈ 3% of the referee's burns**, paid **from the Growth Reserve**
  (not from the artist's 31%, not from the burn).
- **Anti-gaming:** referrer must be ≥ STEADY HAND · referee must claim their own
  genesis block · **diminishing returns + hard cap per referee** · no self-referral
  (wallet/BTC identity check) · rebate rate rides the epoch decay.
- **Scale guard — referral sub-cap:** referrals draw from the SAME monthly Growth
  budget as activity, capped at **≤ 40% of the month's budget** (activity keeps
  ≥ 60%). At 100k users this stops referrals from eating the entire pool; if claims
  exceed the sub-cap they pro-rate. Keeps both rails bounded forever.

### Rail 2 — Bitcoin-Activity Earning (the high-tier "work to earn")
Gated to **TRUSTED+**. The epoch pool is **shared and split by verified activity ×
your multiplier** (§2a) — it is *not* a fixed per-action bounty (fixed bounties get
farmed; a shared pool means farming only dilutes everyone → self-limiting).

**Universal baseline (earn ANY time):** every qualifying action accrues activity
points whenever you do it — no need to watch the clock. Provable "work", all
Bitcoin/on-chain-anchored:
- **Hold** a claimed genesis block (holding bonus).
- **Run a pepenode** — uptime *is* work; heartbeats accrue points (rewards the
  runners who keep the archive alive).
- **Bring a new artist** who gets Council-certified → bounty from Ops envelope.
- **Curate / verify:** flag good submissions, verify art hashes, quality co-signs.
- **Salute / support** activity within the epoch.

**Opportunistic bonus windows (reward attention, don't require it):** during special
Bitcoin moments the activity you do *right then* is worth more. Nobody is forced to
watch — but someone paying attention can capitalize, and the higher your rank the
bigger the window bonus. Windows are provably-fair (anyone can verify the block).
Examples:
- difficulty-retarget blocks (every 2,016) · round-number heights · heights
  containing "69" · halving-adjacent blocks · live salute ceremonies / drop windows.
- window multiplier scales with rank, e.g. `1 + 0.25 × rankIndex` (KINDLING gets the
  smallest bump, KEEPER the largest) — so status pays off exactly when it matters.

**Payout for the epoch:**
```
yourShare = epochPool × (activityPoints × yourMultiplier) / Σ(all eligible)
```
where `activityPoints` already includes any window bonuses earned during the epoch,
and `yourMultiplier` is the capped stack from §2a (Flame Rank × UNATPEPE × node).

**Two fairness guards (verified against the math):**
1. **One monthly budget covers everything.** The month's Growth budget (e.g. 5.25B
   in month 1) funds *both* referral rebates *and* the activity pool. Referrals are
   paid first (they're earned + deterministic); whatever's left is the shared
   activity pool. This keeps total emission bounded — the decay guarantee holds no
   matter how activity spikes.
2. **Per-wallet epoch cap.** No single wallet can take more than **~40% of an epoch
   pool**; the excess rolls forward to next month. Early on, when only a few wallets
   qualify, this stops one whale from vacuuming the pool while still paying them the
   most. Generous, but never lopsided.

### Rail 3 — Artist Alignment (triple-win anchor)
Artists **always** keep their full 31%. On top, from the Milestone Grants envelope:
- First N Council-certified artists get a launch grant.
- Cards crossing burn milestones (e.g. 5 B / 25 B / 100 B) trigger an artist bonus.
This guarantees the artist keeps winning as the community grows — the whole point.

---

## 4) Anti-gaming toolkit (first-class)

1. **Identity root** = SOL wallet + genesis block (one per wallet, salute-gated).
2. **Earn-your-way-in gate** — no $CASH below TRUSTED (60), and tier is built from
   hard-to-fake signals (real burns, breadth, early backing, tenure, co-signs).
3. **Shared pools, not fixed bounties** — farming dilutes the farmer, can't drain.
4. **Referral rewards trigger only on real burns**, capped + diminishing per referee.
5. **Geometric epoch decay** — total emission is mathematically bounded.
6. **Vesting / cooldown** on rewards so wash round-trips aren't instantly profitable.
7. **Treasury tripwire** — reuse the split-monitor pattern: Telegram-alert on any
   anomalous payout spike or treasury drawdown.
8. **Bitcoin-anchored audit** — every reward event references a BTC block height /
   tx, so the whole ledger is tamper-proof and publicly recomputable.

---

## 4a) Automation — how this stays 95%+ hands-off

The founder's only recurring job is **funding the treasury wallet** (once at launch,
top up when you want). Everything else is automatic:

| Piece | How it runs itself |
|---|---|
| Tier / Flame Rank | already event-driven (recomputes on salute + certification) |
| UNATPEPE holder badge | live TAP check (`/api/check-unat`) — re-checked on a schedule |
| Node runner badge | node registry heartbeats — no manual grant |
| Activity points + window bonuses | computed by a **cron each epoch** from the ledger (Bitcoin block heights = source of truth) |
| Epoch pool size | derived from remaining reserve × decay % — a formula, not a decision |
| **Payout** | **pull, not push** — users **claim** their accrued rewards (like the genesis-block claim), server sends from the treasury wallet. Unclaimed $CASH just stays in the treasury. |
| Safety | reuse the **split-monitor tripwire**: Telegram-alert on any abnormal treasury drawdown or payout spike; per-wallet + per-epoch rate caps; short vesting/cooldown so wash round-trips aren't profitable. |

**Why pull-based claims:** the founder never signs individual payouts, the treasury
only pays what's actually claimed, and a single automated signer (hot wallet) with
rate caps + the tripwire is far safer than pushing to everyone. This is the most
hands-off *and* the most secure option.

---

## 5) Phasing (cheapest-highest-leverage first)

- **Phase 0 (now):** lock seed size + decay %, fund the treasury wallet, publish
  the ladder so users know exactly what they earn (transparency = trust).
- **Phase 1:** Fire Spread referrals + status tiers (roadmap item 8). Highest growth
  leverage, lowest build cost. Rebates go live.
- **Phase 2:** Bitcoin-Activity Earning for TRUSTED+ (shared epoch pool + bounties).
- **Phase 3:** Artist Milestone Grants + optional node tip rail (§6).

---

## 6) Optional future — additive node tip (never touches 69/31)
A saluter may *opt to add a tip on top* of their burn, routed to nodes and/or the
treasury. This can top the Flame Treasury back up over time **without** touching the
sacred 69% burn / 31% artist split. Design later; capture now.

---

## 7) Decisions still to lock (founder) — plain-language, pick or say "you decide"
- [ ] **How much to put in the pot** (recommend **75 B**) and **how fast it pays out**
      (recommend **10% of what's left per month** — never empties).
- [ ] **Referral thank-you**: % of a friend's burn you earn + max per friend
      (recommend **3%**, cap ~1 B/friend).
- [ ] **Earning wall**: which rank unlocks real $CASH (recommend **TRUSTED**).
- [ ] **Holder/runner boosts**: UNATPEPE holder (recommend **1.5×**), node runner
      (recommend **1.4×**), overall cap (recommend **5×**).
- [ ] Which "work" activities + which Bitcoin bonus windows go live first.
- [ ] Optional additive node tip: now or defer to Phase 3?

> If any of this still feels like a lot: say **"use your recommended defaults"** and
> I'll lock every number above to the recommendation so you can approve one bundle.

---

## 8) UX principle — over-communicative, but clean & elegant

The rule: **the user should never wonder "what am I, and what can I earn right now?"**
We say a lot, but through small, quiet, consistent surfaces — not walls of text.

- **Your status is always one glance away.** The shared `<IdentityBadges>` chip (§4b)
  follows you — nav, rows, profile. Tap it → a clean sheet: your Flame Rank, your
  multiplier, your badges, and "what unlocks next."
- **The Bitcoin window is unmistakable when live.** A single slim banner/pill:
  *"🔥 69-BLOCK WINDOW LIVE · 2× activity · ends in ~14 min"* with a countdown. Dark
  when no window is active (no clutter). One line, provably-real, impossible to miss.
- **Every earn is explained inline.** When you claim, show the arithmetic in plain
  words: *"5.25B pool × your 3.3× share = 1.26B — boosted by 🐸 UNATPEPE."*
- **A personal "Flame Ledger"** page: what you've earned, what's claimable, what's
  vesting, your rank progress bar, next unlock. One page, calm layout.
- **Elegance guardrails:** at most ONE live banner at a time; badges are small
  glyph+color chips (not loud); numbers use the existing `fmtCash` style; reuse the
  existing fire/amber design language. Communicate through *consistency*, not volume.

---

## 9) Phase-by-phase delivery plan (ship in thin, safe slices)

Each phase is independently shippable, flag-gated, and leaves the live UX untouched
until we flip it on. Ordered by leverage-per-effort.

**Phase 0 — Foundations (no user-visible change).**
- Additive DB tables: `reward_epochs`, `reward_accruals`, `referrals`,
  `reward_claims` (STRICT, guarded migrations — never alter existing columns).
- Config module with all constants behind env flags (all OFF by default).
- Treasury wallet created + funded (founder action, one time).
- *Ships dark. Zero UI. Zero risk.*

**Phase 1 — Status travels (pure visual win, no economics).**
- Build `<IdentityBadges>` + a badges API; drop into nav/rows/profile.
- Now artists / nodes / UNATPEPE holders visibly flex site-wide.
- *No money moves. Safe, high-delight, sets the stage.*

**Phase 2 — Fire Spread (referrals).**
- Referral code on claimed torchbearers; attribution captured at salute.
- Accrual engine (3% of referee burns, per-referee cap, sub-cap) — accrues only.
- Referral panel on profile. Still no payout (accrual visible, "claim soon").

**Phase 3 — Claim rail + first epoch (money turns on).**
- Pull-based claim flow (mirror the block-claim UX) + treasury signer + tripwire.
- First monthly epoch computes; referrals become claimable.
- *This is the first real payout — canary with a tiny pool + flag first.*

**Phase 4 — Bitcoin-activity earning + windows.**
- Universal activity points + the opportunistic BTC windows + rank-scaled bonus.
- The live window banner + Flame Ledger page.

**Phase 5 — Artist milestone grants + optional tip/top-up rail.**
- Milestone bonuses from the Artist envelope; the tip rail that scales the pot.

---

## 10) How we build & iterate WITHOUT touching the live experience

This is the operating discipline. The live site stays exactly as-is until *we*
choose to reveal each piece.

1. **Feature flags first (dark launch).** Every new surface reads an env flag that
   defaults OFF (same pattern as the live `SALUTE_*` flags). Code ships to prod
   *disabled*; users see nothing until we flip one flag. Instant on/off, instant
   rollback — no redeploy.
2. **Additive-only DB migrations.** New tables / new columns with guarded `ALTER`.
   NEVER rename/drop/repurpose an existing column. Existing pages keep reading the
   exact same shape. (This is already how `initSchema()` works.)
3. **Local first, always.** Snapshot the prod DB into local `data/`, run
   `npm run start -- -p 3008`, click through the new flow with flags ON locally.
   Prod stays flags-OFF the whole time.
4. **Ship via `ops/deploy.sh` only.** It maint-gates → snapshots the DB → builds on
   host → **verifies a real card renders** → goes live, or **auto-rolls-back and
   stays closed** if anything fails. A broken build can't reach users.
5. **Reveal in slices, behind the flag.** Turn a flag on for a canary (e.g. your own
   wallet / a test rank) before everyone. Watch the tripwire + logs, then widen.
6. **Money is last and smallest.** Payout rail (Phase 3) launches with a deliberately
   tiny epoch pool + a per-wallet cap + the treasury tripwire, so the worst case is
   trivial and alarmed. Widen only once a full epoch reconciles cleanly.
7. **Never touch the P2P processes** (`peer` / `seeder` / `tgbot`) or the `/art` &
   `/uploads` paths — those render in wallets globally.

**One-line mental model:** *additive code + default-off flags + host-verified deploy
= you can build the entire economy in the open, and the live experience only changes
the moment you personally flip a switch.*

---

## 11) Fail-proof operating manual (for a non-dev) — the safety harness is BUILT

The rules in §10 are now enforced by tools, so you don't have to remember them.
Three pieces exist in the codebase today:

### A. The switchboard — `lib/features.js`
The ONE place every reward feature is turned on or off. **Every feature is OFF by
default and can only be turned on deliberately.** Unknown/typo'd names are also OFF
(fail-closed). Features currently registered (all OFF):
`reward_badges`, `reward_referral`, `reward_claim` 💰, `reward_activity`,
`reward_grants` 💰, `reward_tip` 💰 (💰 = real money moves).

Any new feature we build wraps its behavior in `featureEnabled('reward_x')`, so
shipping the code changes *nothing* until you flip its switch.

### B. Flip a switch — from your browser, no terminal
Feature flags live in the `settings` table and are toggled through the existing
admin API (`POST /api/admin/settings` with `{ "key": "feature:reward_badges",
"value": "1" }`, `"0"` to turn back off). It's **instant** and reversible. A hard
`"0"` always wins, so "off" is always truly off. (A one-click toggle panel in the
admin screen comes with Phase 1.)

### C. The green light — `npm run preflight`
Before every deploy, from the `app/` folder, type the one word:

```
npm run preflight
```

(`npm run safe-check` is the same thing, kept as an alias.) It answers one
question — *"is it safe to ship right now?"* — by checking:
1. you're in the right folder, 2. no destructive DB edits (drop/delete/truncate),
3. no feature accidentally forced ON, 4. the app actually builds.
It's **read-only** — it never touches prod, the DB, or git. You get either:
- **✅ SAFE TO DEPLOY** → proceed, or
- **🛑 STOP** → it lists exactly what to fix. Do not deploy on red.

### Your forever-safe loop (memorize these 4 steps)
1. **Build behind a switch.** New feature ships OFF; the live site is unaffected.
2. **`npm run preflight`** → wait for the green ✅.
3. **Ship:** commit + push, then on the host run `bash ops/deploy.sh` (it maint-gates,
   builds on the host, *verifies a real card renders*, and auto-rolls-back on any
   failure — a broken build physically cannot reach users).
4. **Reveal when ready.** Flip the feature's switch from the admin panel — for money
   rails, turn it on for your own wallet first (canary), watch, then widen.

**If anything ever feels wrong:** flip the switch back to `"0"` (instant hide) — no
deploy needed. Worst case is always one toggle away from undone.
