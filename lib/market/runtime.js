// Shared runtime helpers for the marketplace route handlers: rate-locked quote
// store, per-IP rate limiter, chain-specific id/address regexes, and the block
// explorer link builder. Module-level state is fine under a single `next start`
// process (PM2 runs one instance); if the app is ever horizontally scaled, move
// QUOTES/hits to a shared store (Redis/DB).

import { CURRENCIES } from './currencies.js';

export const HEX64 = /^[0-9a-fA-F]{64}$/;
export const B58SIG = /^[1-9A-HJ-NP-Za-km-z]{43,90}$/;               // Solana tx signature
// Delivery must go to a Counterparty-capable address ("1…" P2PKH or "3…" P2SH).
// bech32/exchange addresses are rejected — an XCP asset sent there can strand.
export const XCP_ADDR = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export const isBitcoinRail = (code) => code === 'BTC' || code === 'XCP' || code === 'PEPECASH' || code === 'NAT';

// ── Rate-locked quotes ──────────────────────────────────────────────────────
export const QUOTES = new Map();
export const QUOTE_TTL = 15 * 60 * 1000;
export const PRICE_TOLERANCE = 0.005; // accept payments within 0.5% under the locked amount

// ── Per-IP rate limit for verification endpoints (anti-hammer). ─────────────
const hits = new Map();
export function checkRate(request) {
  const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'x')
    .toString().split(',')[0].trim() || 'x';
  const now = Date.now(), win = 60_000, max = 20;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= max) return false;
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return true;
}

// Best-effort block explorer link for a payment txid, by currency chain.
export function explorerFor(currency, txid) {
  const c = CURRENCIES[currency] || {};
  switch (c.chain) {
    case 'solana': return `https://solscan.io/tx/${txid}`;
    case 'bitcoin': return `https://mempool.space/tx/${txid}`;
    case 'counterparty': return `https://xchain.io/tx/${txid}`;
    case 'ethereum': return `https://etherscan.io/tx/${txid}`;
    case 'bitcoin-tap': return `https://ordinals.com/inscription/${txid}i0`;
    default: return null;
  }
}
