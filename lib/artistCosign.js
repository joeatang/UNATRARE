// ── Artist Co-Signs — Phase 7 ──────────────────────────────────────────────
// A verified artist publicly vouches for a torchbearer (supporter). The artist
// proves ownership of their verified SOL address with a gas-free signMessage
// over UNATRARE:COSIGN:<artist>:<torchbearer>. Each co-sign is a hard-to-fake
// endorsement that feeds the torchbearer's Signal Weight.
//
// Truth lives here (artist_cosigns); trust_scores.cosigns is a derived cache.

import { getDb } from './db.js';
import { verifyCosign } from './torchbearerIdentity.js';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function clean(str, max) {
  return String(str || '').trim().slice(0, max);
}

/**
 * Is this SOL wallet a verified artist? A wallet qualifies when it owns at least
 * one approved token whose artist SOL address has been verified.
 * @returns {{ verified: boolean, handle: string, tokens: string[] }}
 */
export function verifiedArtist(wallet) {
  if (!SOL_ADDR_RE.test(wallet || '')) return { verified: false, handle: '', tokens: [] };
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT token_name, artist_handle
        FROM tokens
       WHERE artist_sol_address = ?
         AND artist_sol_verified_at IS NOT NULL
         AND status = 'approved'
       ORDER BY artist_sol_verified_at ASC
    `).all(wallet);
    if (rows.length === 0) return { verified: false, handle: '', tokens: [] };
    const handle = rows.find(r => r.artist_handle)?.artist_handle || '';
    return { verified: true, handle, tokens: rows.map(r => r.token_name) };
  } catch {
    return { verified: false, handle: '', tokens: [] };
  }
}

/** Does this wallet have any presence as a torchbearer (claimed profile or a salute)? */
export function torchbearerExists(wallet) {
  if (!SOL_ADDR_RE.test(wallet || '')) return false;
  try {
    const db = getDb();
    const claimed = db.prepare('SELECT 1 FROM torchbearers WHERE sol_wallet = ?').get(wallet);
    if (claimed) return true;
    const saluted = db.prepare('SELECT 1 FROM card_salutes WHERE sol_wallet = ? LIMIT 1').get(wallet);
    return !!saluted;
  } catch {
    return false;
  }
}

/**
 * Record a verified artist's co-sign of a torchbearer. Idempotent per pair
 * (an artist can only co-sign a given torchbearer once). Assumes the signature
 * has already been checked by the caller, but re-verifies defensively.
 * @returns {{ ok: boolean, error?: string, cosign?: object, alreadyExisted?: boolean }}
 */
export function recordCosign({ artistWallet, torchbearerWallet, note = '', signature = '' }) {
  if (!SOL_ADDR_RE.test(artistWallet || '')) return { ok: false, error: 'invalid artist wallet' };
  if (!SOL_ADDR_RE.test(torchbearerWallet || '')) return { ok: false, error: 'invalid torchbearer wallet' };
  if (artistWallet === torchbearerWallet) return { ok: false, error: 'you cannot co-sign yourself' };

  if (!verifyCosign(artistWallet, torchbearerWallet, signature)) {
    return { ok: false, error: 'signature did not verify' };
  }

  const artist = verifiedArtist(artistWallet);
  if (!artist.verified) return { ok: false, error: 'only verified artists can co-sign' };
  if (!torchbearerExists(torchbearerWallet)) {
    return { ok: false, error: 'that wallet is not a torchbearer yet (no salutes on record)' };
  }

  try {
    const db = getDb();
    const existing = db.prepare(
      'SELECT * FROM artist_cosigns WHERE artist_sol_address = ? AND torchbearer_wallet = ?'
    ).get(artistWallet, torchbearerWallet);
    if (existing) {
      // Refresh the optional note / handle snapshot, keep the original timestamp.
      db.prepare(
        'UPDATE artist_cosigns SET note = ?, artist_handle = ?, signature = ? WHERE id = ?'
      ).run(clean(note, 140), artist.handle, clean(signature, 128), existing.id);
      return { ok: true, cosign: getCosign(existing.id), alreadyExisted: true };
    }
    const info = db.prepare(`
      INSERT INTO artist_cosigns
        (artist_sol_address, artist_handle, torchbearer_wallet, note, signature, created_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
    `).run(artistWallet, artist.handle, torchbearerWallet, clean(note, 140), clean(signature, 128));
    return { ok: true, cosign: getCosign(info.lastInsertRowid) };
  } catch (err) {
    return { ok: false, error: err.message || 'could not record co-sign' };
  }
}

function getCosign(id) {
  try {
    return getDb().prepare('SELECT * FROM artist_cosigns WHERE id = ?').get(id) || null;
  } catch {
    return null;
  }
}

/**
 * Public list of co-signs a torchbearer has received (newest first).
 * @returns {Array<{artist_sol_address, artist_handle, note, created_at}>}
 */
export function getCosignsForTorchbearer(wallet) {
  if (!SOL_ADDR_RE.test(wallet || '')) return [];
  try {
    const db = getDb();
    return db.prepare(`
      SELECT artist_sol_address, artist_handle, note, created_at
        FROM artist_cosigns
       WHERE torchbearer_wallet = ?
       ORDER BY created_at DESC
    `).all(wallet);
  } catch {
    return [];
  }
}

/**
 * Distinct co-signing-artist count per torchbearer, for many wallets at once.
 * Used by the Signal Weight recompute. @returns {Map<wallet, number>}
 */
export function cosignCountsFor(wallets = []) {
  const map = new Map();
  const list = [...new Set((wallets || []).filter(w => SOL_ADDR_RE.test(w)))];
  if (list.length === 0) return map;
  try {
    const db = getDb();
    const placeholders = list.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT torchbearer_wallet AS w, COUNT(DISTINCT artist_sol_address) AS n
        FROM artist_cosigns
       WHERE torchbearer_wallet IN (${placeholders})
       GROUP BY torchbearer_wallet
    `).all(...list);
    for (const r of rows) map.set(r.w, Number(r.n || 0));
  } catch {
    /* fall through — no co-signs resolved */
  }
  return map;
}
