# Social Layer — Heralds, Reach & Beacon Windows

Last updated: 2026-07-05 · Status: **Phase 1 in build**

Companion to `cash-rewards-economy.md`. This is the **social/awareness** enhancer.
It does not replace anything — it reuses Signal Weight tiers, the anti-farm gate,
the treasury, and the Bitcoin-window concept already designed in the economy doc.

## Core thesis
The social layer is the **front-end of the Fire Spread referral rail**, surfaced as
shareable card links, scored publicly as **Reach**, lit up by **Beacon Windows**.
A share that converts (click → salute) *is* a referral. One system, two views:
- **Clicks** build public **Reach** (free, all ranks, no money needed).
- **Conversions** (a referred burn) build Reach *and* — only at TRUSTED+ — a $CASH
  rebate from the Growth Reserve.

## Naming
| Thing | Name |
|---|---|
| Social score | **Reach** (distinct from on-chain "Signal Weight") |
| Role | **Herald** |
| Bitcoin-aligned bonus moment | **Beacon Window** |
| The act | *light a beacon* (share) |

Profiles show **two bars: Signal (on-chain) + Reach (social)** — advertising the free lane.

## Reach model
- `Reach = Σ shares of (baseValue × accountQuality × outcomeWeight)`, capped + decayed.
- `outcomeWeight`: **conversion ≫ real click ≫ nothing**. Bots don't convert.
- `accountQuality`: unlinked share spreads word but earns **0 Reach**; linked wallet earns base.
  (Verified-badge bonus deferred — needs paid X API; we reward *results*, not badges.)
- **Burn multiplier**: contribution × `(1 + burnBoost)`, log-scaled from total burned.
  Non-burner = ×1 (fully in); burner amplified. Burning multiplies, sharing still counts.
- **Gate (reused):** Reach earns *status* at every rank; **$CASH only at TRUSTED+**.

## Beacon Windows (Bitcoin-network multipliers)
Burns are $CASH on Solana, so Bitcoin state costs users nothing → pure thematic
attention signal. Detected free via mempool.space.
1. **Attention windows (network heat):** `fees/recommended` fastestFee above rolling
   threshold OR mempool backlog high → Reach ×1.5–2×. Reward attention/activity —
   **never price** (speculative, off-brand).
2. **Ceremonial windows (heights):** difficulty retarget (every 2,016), heights with
   "69", round heights (%10,000), halving-adjacent.
- Multiplier scales with rank: `1 + 0.25 × rankIndex`.
- Guardrails: window bonus applies only to **clicks/conversions**, never the raw
  share tap; **one live banner at a time**; diminishing returns + per-window cap.

## Card-awareness loop
Card "Light a beacon" button → unique tracked link + card image → posted → real
clicks → card **Buzz** stat (feeds Directory momentum, transparent) + some **salutes**
→ Herald earns Reach (+ rebate if TRUSTED+) and is credited in **"Heralds of this
card."** Plus a **Top Heralds** leaderboard (weekly/all-time).

## Artist Signal (new)
Numeric artist reputation: **traction** (salutes received, distinct supporters,
momentum) + **amplification** (own promo shares, weighted LOWER than an outsider's)
+ **reciprocity** (co-signs) + **consistency** (updates/tenure, decayed). Same Beacon
multipliers. Transparent Directory lens, never a silent reorder.

## Anti-gaming (reuse economy toolkit + additions)
Identity root (wallet+block) · earn-your-way-in gate (no cash < TRUSTED) · shared
pools not fixed bounties · rewards on real burns · diminishing returns + caps ·
Bitcoin-anchored audit · treasury tripwire. **Reach adds:** outcome-weighting
(conversions unfakeable), link attribution, visitor dedup, per-window caps, admin revoke.

## Phased delivery (thin, flag-gated, live UX untouched)
- **Phase 0 — Foundations (invisible):** STRICT tables `share_links`, `share_events`,
  `reach_scores`; `lib/social.js` config (flags). Guarded migrations, no column alters.
- **Phase 1 — Tracked links + Reach (status only, FREE):** `POST /api/share`,
  `GET /s/[code]` redirect+click, conversion hook in `/api/salute` (non-fatal),
  profile **Reach bar**, card **"Heralds of this card"** + share button.
- **Phase 2 — Beacon Windows:** mempool heat + ceremonial heights, one-line live
  banner, rank-scaled Reach multiplier.
- **Phase 3 — Artist Signal:** artist-side score + surfaces.
- **Phase 4 — Wire Reach into $CASH economy:** conversions at TRUSTED+ pay rebates
  from Growth Reserve (Fire Spread live). Needs treasury funded.

## Triple-win
- **Community:** free way in (Reach + status), credited on cards, leaderboards, rally
  moments, real $CASH at TRUSTED+. Inclusion without a speculation casino.
- **Artists:** awareness engine → real supporters → more of their 31%; rep for showing up.
- **Platform:** growth loop, $0/month to run, anti-gamed by conversions, Bitcoin-anchored.
