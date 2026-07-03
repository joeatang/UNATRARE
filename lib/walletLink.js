// lib/walletLink.js — bind a Solana identity to a Bitcoin identity (server-side).
//
// A torchbearer's public presence everywhere is their Solana wallet, but their
// UNATPEPE holding and any node they run are keyed by a Bitcoin address. This
// module lets a wallet prove BOTH ownerships once, so the 🐸 UNATPEPE and 🖥️
// Node badges can travel with the Solana wallet across the whole site.
//
// The link is DOUBLY-SIGNED so neither identity can be forged onto the other:
//   • the Solana key signs   UNATRARE:LINK:<btcAddress>
//   • the Bitcoin key signs   UNATRARE:LINK:<solWallet>
// Each message references the counterpart, so a signature can't be replayed to
// attach a stranger's status. BTC verification reuses the same BIP-137 path as
// /register; SOL verification reuses the ed25519 verifier from torchbearerIdentity.

import { getDb } from './db.js';
import { verifySolMessage } from './torchbearerIdentity.js';
import { verifyBitcoinMessage } from './btcVerify.mjs';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // legacy P2PKH

export function solLinkChallenge(btcAddress) {
  return `UNATRARE:LINK:${btcAddress}`;
}

export function btcLinkChallenge(solWallet) {
  return `UNATRARE:LINK:${solWallet}`;
}

/**
 * Verify both halves of a proposed link.
 * @returns {{ok:true} | {ok:false, error:string}}
 */
export function verifyLink({ solWallet, btcAddress, solSig, btcSig }) {
  if (!SOL_ADDR_RE.test(solWallet || '')) return { ok: false, error: 'Invalid Solana wallet' };
  if (!BTC_ADDR_RE.test(btcAddress || '')) return { ok: false, error: 'btcAddress must be a legacy Bitcoin address (starts with 1)' };

  // SOL owner authorizes linking THIS btc address.
  if (!verifySolMessage(solWallet, solLinkChallenge(btcAddress), (solSig || '').trim())) {
    return { ok: false, error: 'Solana signature did not verify — reconnect and sign again' };
  }

  // BTC owner authorizes linking THIS sol wallet (BIP-137, tolerate line-ending variants).
  const challenge = btcLinkChallenge(solWallet);
  const candidates = [challenge, challenge + '\r\n', challenge + '\n', challenge + '\r'];
  let btcOk = false;
  for (const c of candidates) {
    if (verifyBitcoinMessage(btcAddress, c, (btcSig || '').trim()).ok) { btcOk = true; break; }
  }
  if (!btcOk) return { ok: false, error: 'Bitcoin signature did not verify — sign the exact message with the BTC address shown' };

  return { ok: true };
}

/**
 * Record a verified link (idempotent upsert on sol_wallet). Callers MUST have
 * already run verifyLink(). xcpAddress is optional (defaults to btcAddress).
 */
export function recordLink({ solWallet, btcAddress, xcpAddress, solSig, btcSig }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO wallet_links (sol_wallet, btc_address, xcp_address, sol_sig, btc_sig, linked_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(sol_wallet) DO UPDATE SET
      btc_address = excluded.btc_address,
      xcp_address = excluded.xcp_address,
      sol_sig     = excluded.sol_sig,
      btc_sig     = excluded.btc_sig,
      linked_at   = unixepoch()
  `).run(solWallet, btcAddress, (xcpAddress || btcAddress || '').trim(), solSig || '', btcSig || '');
}

/** The linked Bitcoin identity row for one Solana wallet, or null. */
export function getLinkedBitcoin(solWallet) {
  if (!SOL_ADDR_RE.test(solWallet || '')) return null;
  try {
    const db = getDb();
    return db.prepare('SELECT btc_address, xcp_address, linked_at FROM wallet_links WHERE sol_wallet = ?').get(solWallet) || null;
  } catch {
    return null;
  }
}

// Given a set of BTC/XCP addresses, which ones hold UNATPEPE and which run a node.
function statusForAddresses(db, addresses) {
  const list = [...new Set(addresses.filter(Boolean))];
  const out = { unatpepe: false, node: false };
  if (list.length === 0) return out;
  const ph = list.map(() => '?').join(',');
  try {
    const h = db.prepare(
      `SELECT 1 FROM holders WHERE tap_balance > 0 AND (btc_address IN (${ph}) OR xcp_address IN (${ph})) LIMIT 1`
    ).get(...list, ...list);
    out.unatpepe = !!h;
  } catch { /* ignore */ }
  try {
    const n = db.prepare(
      `SELECT 1 FROM nodes WHERE btc_address IN (${ph}) OR xcp_address IN (${ph}) OR tap_address IN (${ph}) LIMIT 1`
    ).get(...list, ...list, ...list);
    out.node = !!n;
  } catch { /* ignore */ }
  return out;
}

/**
 * Resolve UNATPEPE / node flags for MANY Solana wallets in a few queries.
 * @returns {Map<string,{unatpepe:boolean,node:boolean,btcAddress:string}>}
 */
export function resolveLinkedFlags(wallets = []) {
  const map = new Map();
  const list = [...new Set((wallets || []).filter(w => SOL_ADDR_RE.test(w)))];
  if (list.length === 0) return map;
  try {
    const db = getDb();
    const ph = list.map(() => '?').join(',');
    const links = db.prepare(
      `SELECT sol_wallet, btc_address, xcp_address FROM wallet_links WHERE sol_wallet IN (${ph})`
    ).all(...list);
    if (links.length === 0) return map;

    // Gather every linked address, resolve holder/node membership in bulk.
    const allAddrs = [];
    for (const l of links) { if (l.btc_address) allAddrs.push(l.btc_address); if (l.xcp_address) allAddrs.push(l.xcp_address); }
    const uniq = [...new Set(allAddrs)];
    const ph2 = uniq.map(() => '?').join(',');

    const holderSet = new Set();
    const nodeSet = new Set();
    if (uniq.length) {
      try {
        for (const r of db.prepare(`SELECT btc_address, xcp_address FROM holders WHERE tap_balance > 0 AND (btc_address IN (${ph2}) OR xcp_address IN (${ph2}))`).all(...uniq, ...uniq)) {
          if (r.btc_address) holderSet.add(r.btc_address);
          if (r.xcp_address) holderSet.add(r.xcp_address);
        }
      } catch { /* ignore */ }
      try {
        for (const r of db.prepare(`SELECT btc_address, xcp_address, tap_address FROM nodes WHERE btc_address IN (${ph2}) OR xcp_address IN (${ph2}) OR tap_address IN (${ph2})`).all(...uniq, ...uniq, ...uniq)) {
          if (r.btc_address) nodeSet.add(r.btc_address);
          if (r.xcp_address) nodeSet.add(r.xcp_address);
          if (r.tap_address) nodeSet.add(r.tap_address);
        }
      } catch { /* ignore */ }
    }

    for (const l of links) {
      const addrs = [l.btc_address, l.xcp_address].filter(Boolean);
      map.set(l.sol_wallet, {
        btcAddress: l.btc_address || '',
        unatpepe: addrs.some(a => holderSet.has(a)),
        node: addrs.some(a => nodeSet.has(a)),
      });
    }
  } catch { /* fall through — no flags */ }
  return map;
}

/** Single-wallet convenience wrapper (used on the profile / badge lookup). */
export function linkedStatusFor(solWallet) {
  const row = getLinkedBitcoin(solWallet);
  if (!row) return { linked: false, unatpepe: false, node: false, btcAddress: '' };
  try {
    const db = getDb();
    const s = statusForAddresses(db, [row.btc_address, row.xcp_address]);
    return { linked: true, btcAddress: row.btc_address, ...s };
  } catch {
    return { linked: true, btcAddress: row.btc_address, unatpepe: false, node: false };
  }
}
