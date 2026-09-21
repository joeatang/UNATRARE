// BIP-137 message-signature verification for Bitcoin-rail binding.
//
// Ported from unatrare-checkout/lib/bip137.js, but instead of pulling in the
// `bitcoinjs-message` dependency it reuses the repo's own verifier in
// lib/btcVerify.mjs (@noble/curves-based, no native deps) — the same one
// confirm-payment already trusts. Supports legacy P2PKH ("1…") addresses.

import { verifyBitcoinMessage } from '../btcVerify.mjs';

export const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;      // legacy / p2sh base58
export const SIG_RE = /^[A-Za-z0-9+/=]{87,88}$/;                  // base64 BIP-137 sig

export function challengeFor(txid) {
  return `UNATRARE:BUY:${String(txid).toLowerCase()}`;
}

export function challengeForList(asset) {
  return `UNATRARE:LIST:${String(asset).toUpperCase()}`;
}

// Verify a signature over an arbitrary message (used for listing ownership proof).
export function verifyRaw(address, message, signature) {
  if (!ADDR_RE.test(address || '')) return { ok: false, error: 'address must be a legacy/p2sh Bitcoin address' };
  if (!SIG_RE.test(signature || '')) return { ok: false, error: 'invalid BIP-137 signature format' };
  for (const m of [message, `${message}\n`, `${message}\r\n`, `${message}\r`]) {
    try { if (verifyBitcoinMessage(address, m, signature).ok) return { ok: true }; } catch { /* next */ }
  }
  return { ok: false, error: 'signature does not match the address' };
}

// Returns { ok, error? }. Tolerates trailing newline variants some wallets add.
export function verify(address, txid, signature) {
  if (!ADDR_RE.test(address || '')) return { ok: false, error: 'auth address must be a legacy Bitcoin address (starts with 1 or 3)' };
  if (!SIG_RE.test(signature || '')) return { ok: false, error: 'invalid BIP-137 signature format' };
  const base = challengeFor(txid);
  for (const msg of [base, `${base}\n`, `${base}\r\n`, `${base}\r`]) {
    try { if (verifyBitcoinMessage(address, msg, signature).ok) return { ok: true }; } catch { /* try next variant */ }
  }
  return { ok: false, error: 'signature does not match the auth address for this txid' };
}
