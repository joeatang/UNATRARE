# UNATRARE — Multi-Currency Checkout Handoff

## 1. PROJECT
Council-certified directory of Bitcoin-native Counterparty (XCP) art. Each XCP asset's on-chain description links `unatrare.wtf/c/TOKENNAME.json` (CIP-25). GOAL: decentralized checkout — buyers pay in an APPROVED currency for XCP art delivered natively on Bitcoin, gated by a token-authority (Council verdict + Trac nodes).

## 2. REPO MAP
- `app/app/c/[token]/route.js` CRITICAL catalog endpoint (never change URL).
- `app/lib/metadata.js` CIP-25 JSON; `app/lib/tokenValidator.js` XCP names.
- CHECKOUT: `app/app/api/payment-config/route.js` (fees/addrs); `confirm-payment/route.js` (verify BTC/NAT/PEPECASH).
- SOLANA $CASH: `app/lib/solanaBurnVerify.js`, `api/salute/route.js`, `app/solana/unatrare-salute-burn-program/`.
- TAP/INDEXER: `app/lib/tapApi.js`, `app/lib/tracBridge.js`, `intercom/`, `app/tgbot/`. DB `app/lib/db.js` (SQLite `tokens`,`nodes`,`cash_burns`).

## 3. APPROVED CURRENCIES
- natcash/$CASH: mint `oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat`, Solana SPL Token-2022. Decimals UNCONFIRMED.
- XCP: native Counterparty on Bitcoin, 8 dec. Art assets are XCP-layer.
- BTC: native, 8 dec. Verified mempool.space; fee `PAYMENT_BTC_SATS` (def 10000).
- ETH: no code — UNKNOWN.
- SOL: native; RPC `SOLANA_RPC_URL`. No SOL-pay path; carries $CASH only.
- $TAP: TAP protocol; checkout uses tick `nat` via api.tap3.link. `$TAP` tick UNKNOWN.
- $TRAC: Trac net token. No address in repo — UNKNOWN.

## 4. TREASURY / RECEIVE ADDRESSES
- BTC: env `PAYMENT_BTC_ADDRESS` (uncommitted). XCP: env `PAYMENT_XCP_ADDRESS`. Admin peer registers `15w1CFYpLHWGAinTFCSy9i327FHoj5t9re` for both BTC+XCP (`ecosystem.config.cjs`) — UNCONFIRMED as treasury.
- SOL: NO central treasury. Salutes burn $CASH; splits -> per-token `tokens.artist_sol_address`.
- Counterparty art delivery / ETH: none yet.

## 5. TOKENS
- $CASH/natcash: Solana SPL Token-2022 (mint above), name NATCASH, nat.fun bonding curve (10,080 Danknote bills, blocks 102816-112895). Supply/decimals UNCONFIRMED.
- UNATPEPE: TAP tick `unatpepe` on Bitcoin. Supply 2016 (`drops/create` MAX_SUPPLY) — UNCONFIRMED cap. Decimals UNKNOWN.

## 6. CERTIFIED CATALOG
Per-token at `unatrare.wtf/c/TOKENNAME.json` (`app/app/c/[token]/route.js`, CORS `*`, SQLite `tokens`; `next.config.mjs` rewrites `.json`). No aggregate endpoint. Approved entry (CIP-25 v2):
```json
{"name":"TOKENNAME","description":"...",
 "image":"https://unatrare.wtf/uploads/<hash>_icon.png",
 "image_large":"https://unatrare.wtf/art/<hash>.jpg",
 "images":[{"type":"large","url":".."},{"url":"ORD:<64hex>"}]}
```
Else `{"status":"pending"|"rejected"}`.

## 7. INDEXER / NODES
- `intercom/` = Pear/Trac Deep Node (Hyperswarm P2P art archive). Repo `github.com/joeatang/unatrare-intercom`.
- Subnet channel `unatrare-art-archive-v1`; bootstrap `38a1b001756148f3f96f8cff7bd38d2924669f5c1880b4f779512d6449cfff56`.
- SC-Bridge `ws://127.0.0.1:49222` (port 49222), token env `SC_BRIDGE_TOKEN`; channels `unatrare-verdicts`,`unatrare-council`. Hyperswarm UDP hole-punch, no port-forward. PoW entry `0000intercom` diff 12.
- Run: `pear run . --peer-store-name unatrare-node --subnet-bootstrap 38a1...ff56 --btc-address <A>` OR `docker compose up -d` in `intercom/` (Node 22/23 + Pear).

## 8. SETTLEMENT
FEES only (not art purchase): `confirm-payment` verifies txid (BTC=mempool.space, NAT=tap3.link, PEPECASH=tokenscan.io), replay-guards, flips `tokens.status`. Authority gate = 5-judge Council (`judges.config.json`, 3/5, PROF_NAKA_C tiebreak) -> `broadcastVerdict` via SC-Bridge; approval reveals catalog JSON. NO buyer->art swap exists.

## 9. OPEN QUESTIONS / TODO
- Define ETH/SOL/$TAP/$TRAC canonical tokens + decimals (UNKNOWN).
- Create real per-chain treasury addresses (BTC/XCP env unset; no ETH/SOL/CP escrow).
- Cross-chain flow: Solana/EVM pay -> XCP delivery (bridge/dispense/swap).
- Confirm $CASH + UNATPEPE supply/decimals on-chain.
- Art-release: direct XCP send vs node-gated. Verify treasury address.
