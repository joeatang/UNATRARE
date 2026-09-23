# UNATRARE Marketplace — Hardening & Build Plan

Goal: take the marketplace from "works with trusted friends" to "safe for the public" —
no payment vulnerabilities, trustless delivery, transparent ledger, zero dead-ends,
and clean cross-chain support. Every phase is flag-gated, additive, and canary-tested,
following the existing safe-deploy discipline (preflight → deploy.sh verify-gate → flip flag).

---

## Guiding principles
- **Bitcoin is the source of truth.** Block height = canonical clock; earliest Bitcoin-anchored
  record wins any dispute. Applies to orders, deliveries, ownership.
- **Non-custodial by default.** We never hold user keys or assets unless a phase explicitly
  requires bonded escrow, and even then it's minimized + disclosed.
- **Protect BOTH sides.** A buyer must never pay and get nothing; a seller must never deliver
  and get nothing. Delivery and payment are bound together.
- **Everything ledgered + verifiable.** No trust in one server's private database. Orders,
  payments, and deliveries are recorded to an append-only, Bitcoin-anchored ledger anyone can audit.
- **Dark until safe.** Public marketplace (`market_public`) stays OFF until Phase 2 delivery is trustless.

---

## Honest architecture notes (Trac & TAP — no hype)

### What Trac Network actually gives us here
`intercom/` is already a Pear/Trac deep node: a Hyperswarm + Hyperbee peer-to-peer archive that
every desktop install replicates, plus an SC-Bridge event channel (verdicts/council). Trac's role
in THIS plan is the **decentralized, tamper-evident LEDGER**:
- Every listing / sale / payment-proof (txid) / delivery (delivery txid) is written to a
  replicated Hyperbee/Autobase that all nodes carry and anyone can independently verify.
- It is NOT a payment network and NOT a bridge. It's the transparent record + the P2P distribution
  layer. Bitcoin remains the settlement + timestamp truth; Trac makes the record public + durable.

### What TAP protocol actually is (and isn't)
TAP is a **Bitcoin-native token metaprotocol** (ordinals-inscribed tokens, indexed by Trac).
It is excellent for **Bitcoin-side tokens** (`unatpepe`, `nat`) and Bitcoin-native settlement.
It is **NOT a general SOL/ETH cross-chain bridge** — it doesn't move value between Solana/Ethereum
and Bitcoin by itself. Anyone claiming TAP "does cross-chain" for EVM/Solana is overselling it.
So our cross-chain model (Phase 4) is **verify-payment-on-chain-A → release-asset-on-Bitcoin**,
with BOTH legs recorded on the ledger — not a magic atomic bridge. TAP/Trac is the Bitcoin-side
rail + the ledger backbone; SOL/ETH are verified-then-released.

---

## PHASE 0 — Payment safety rails (STOP the bleeding) · highest priority
Fixes the real vulnerabilities that exist today.
- **Oversell / double-spend lock.** On a verified purchase, atomically decrement listing quantity
  in the same transaction as the order insert. Two buyers can never both win a 1-of-1.
- **Sold-out state.** When quantity hits 0 → listing `status='sold'`, removed from For-sale, and
  BOTH quote + purchase re-check quantity and fail fast ("sold out — you were not charged" BEFORE pay).
- **Soft reservation on quote.** A short hold (e.g. 10 min, = quote TTL) so a buyer mid-checkout
  isn't beaten to a 1-of-1; hard re-check at purchase is the backstop.
- **Exact-amount discipline.** App already copies the exact amount; add a "must match exactly" note
  + tolerance display so a fat-fingered send can't silently under/overpay (FreeWallet footgun start).
- **Ledger v1 (local).** Every order/delivery row gets an order-hash + the Bitcoin txid so it's
  audit-ready for the Trac ledger in Phase 3.
Deliverables: `listings.js` atomic decrement + `sold` status; `listing-quote`/`listing-purchase`
quantity guards; app "sold out" state; flag `market_oversell_lock` (default ON once tested).

## PHASE 1 — Communication & trust loop (no dead-ends)
Closes every "I'm on an island" gap.
- **Buyer "My Purchases"** in-app: reads existing `order/[id]` + `receipt/[orderId]` endpoints →
  status timeline (Paid → Awaiting release → Delivered) with the delivery txid + explorer link.
- **Artist "My Sales / Listings"**: quantity left, orders needing release, one-tap fulfill,
  earnings. Reuses `artist/[address]/orders`.
- **In-app onboarding / glossary**: plain-English "how a purchase works", and definitions
  (Counterparty, XCP, dispenser, delivery, salute). Grandma-proof.
- **Status + nudges**: order polling; optional Telegram/email receipt on delivery.
Deliverables: desktop "My Purchases" + "My Sales" panels; glossary sheet; order-status IPC.

## PHASE 2 — Trustless delivery via Counterparty dispensers (protect both sides)
The web3-native answer to double-spend + guaranteed delivery for BTC/XCP.
- Artist funds an on-chain **dispenser** with the asset. Buyers pay the dispenser; Counterparty
  **auto-delivers**; it **auto-closes when empty = native sold-out**. No human in the loop, no oversell.
- **Dispenser creation flow** (artist funds), **live dispenser status** (X of N left), and
  **exact-amount enforcement** to kill the FreeWallet loss footgun (app computes the exact sats;
  eventually the in-app wallet sends it so a human never types the amount).
- **Buyer protection**: app verifies the dispenser is OPEN + has stock before showing "pay";
  blocks payment into a closed/empty dispenser.
Deliverables: dispenser create/verify lib; `release_method='dispenser'` becomes real; app dispenser UI.
Note: dispensers are **BTC/XCP only** — cross-chain uses Phase 4.

## PHASE 3 — The public ledger (Trac): everything ledgered, clearly
- Extend `intercom/` into an append-only, Bitcoin-anchored **order ledger** (Hyperbee/Autobase)
  replicated by every node: listing → sale → payment txid → delivery txid, each stamped with the
  BTC block height (canonical order).
- Anyone can independently audit the full trade history; disputes resolved by earliest anchored record.
- Reuses the SC-Bridge event pattern already built for council verdicts.
Deliverables: ledger schema + writer in intercom; desktop "verify on the ledger" surface.

## PHASE 4 — Cross-chain payments, safely (SOL / ETH / USDT → Bitcoin delivery)
- **Model**: verify the buyer's SOL/ETH/USDT payment reached the artist → release the XCP asset on
  Bitcoin, with BOTH legs written to the ledger. Dispensers can't take SOL, so cross-chain uses a
  **bonded authority/artist release** guaranteed by the oversell lock (Phase 0) + public ledger
  (Phase 3) so overselling/non-delivery is provable and slashable.
- **Add the ETH/USDT-ETH verifier** (Etherscan/Alchemy) so ETH is a real, labeled rail — and label
  every stablecoin by chain ("USDT · Solana" / "USDT · Ethereum") so nobody sends to the wrong chain.
- Honest ceiling: fully trustless SOL↔BTC atomic swaps are bleeding-edge; the verify-then-release +
  public-ledger + bond model is the pragmatic, safe path now, upgradeable later.
Deliverables: ETH verifier; per-chain currency labels; cross-chain release path bound to the ledger.

## PHASE 5 — Wallet completeness (move XCP in AND out) + clean collection view
- **Counterparty SEND** from the in-app wallet (build + broadcast the XCP transfer) with exact-amount
  + address-type guardrails (anti-FreeWallet-loss). Today the wallet can receive XCP but not send.
- **Collection-grouped holdings**: UNATRARE / Rare Pepe / Fake Rares / Other — sectioned, badged,
  counted, cross-referenced against the UNATRARE catalog. The clean "view your assets" experience.
Deliverables: wallet XCP send; grouped asset view.

## PHASE 6 — Distribution & update integrity
- **Auto-update ceremony** (multisig Pear release): founder generates + holds 2-of-3 keys; releases
  are quorum-signed; soft P2P auto-update (no re-download for minor versions). Ends the treadmill.
- **Windows code signing** (Authenticode/EV) to remove SmartScreen "nothing happened".
- Once Phase 2 delivery is trustless + Phase 1 comms are in: **flip `market_public` ON**.

---

## Cross-cutting: security / no vulnerabilities (every phase)
- Flag-gated dark launches; additive-only migrations; `npm run preflight` + deploy verify-gate; canary.
- Payment invariants: rate-locked quotes, oversell lock, idempotent txid, exact-amount tolerance,
  replay guards, fixed-origin fetches, signature scoping (`^UNATRARE:`), native send confirmation.
- Per-phase threat model note before flipping any money flag.

## Suggested sequencing (ASAP, some parallel)
1. **P0** (days) — closes the live payment vulnerability. DO FIRST.
2. **P1** (days) — trust/comms loop; can overlap P0.
3. **P2** (1–2 wks) — dispensers = trustless BTC/XCP delivery.
4. **P3** (1–2 wks) — Trac ledger; can overlap P2.
5. **P4** (1–2 wks) — cross-chain + ETH verifier.
6. **P5** (1 wk) — wallet XCP send + collection view.
7. **P6** (ongoing) — update ceremony + Windows signing → go public.
