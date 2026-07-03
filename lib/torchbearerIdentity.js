/**
 * torchbearerIdentity.js — Phase 3 supporter identity (server-side).
 *
 * A torchbearer is any Solana wallet that has saluted a card. Their fire history
 * is derived read-only from card_salutes. This module lets a wallet CLAIM a
 * display identity (handle, name, avatar, socials) by proving ownership with a
 * gas-free Solana signMessage over the challenge:
 *
 *     UNATRARE:TORCH:<wallet>
 *
 * Verification uses @noble/curves ed25519 (already a dependency) + an inline
 * base58 decoder (no new deps). Unclaimed wallets have no row and keep rendering
 * as a truncated address everywhere.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { createHash } from 'node:crypto';
import { getDb } from './db.js';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// ── base58 decode (Bitcoin/Solana alphabet) ──────────────────────────────────
function base58Decode(str) {
  if (typeof str !== 'string' || str.length === 0) throw new Error('empty base58 input');
  const map = new Map();
  for (let i = 0; i < B58_ALPHABET.length; i++) map.set(B58_ALPHABET[i], i);

  const bytes = [0];
  for (const ch of str) {
    const val = map.get(ch);
    if (val === undefined) throw new Error('invalid base58 character');
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // preserve leading zeros (each leading '1' == one 0x00 byte)
  for (let k = 0; k < str.length && str[k] === '1'; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

function base64ToBytes(b64) {
  return Uint8Array.from(Buffer.from(String(b64), 'base64'));
}

/** The exact message a wallet must sign to claim its profile. */
export function claimChallenge(wallet) {
  return `UNATRARE:TORCH:${wallet}`;
}

/**
 * Verify an arbitrary Solana signMessage signature against a wallet's pubkey.
 * Generic building block for any UNATRARE:* challenge signed with a SOL key.
 * @param {string} wallet        base58 Solana address (also the ed25519 pubkey)
 * @param {string} message       the exact UTF-8 message that was signed
 * @param {string} signatureB64  base64-encoded 64-byte detached signature
 * @returns {boolean}
 */
export function verifySolMessage(wallet, message, signatureB64) {
  try {
    if (!SOL_ADDR_RE.test(wallet)) return false;
    const pubkey = base58Decode(wallet);
    if (pubkey.length !== 32) return false;
    const sig = base64ToBytes(signatureB64);
    if (sig.length !== 64) return false;
    const msg = new TextEncoder().encode(String(message));
    return ed25519.verify(sig, msg, pubkey);
  } catch {
    return false;
  }
}

/**
 * Verify a Solana signMessage claim.
 * @param {string} wallet          base58 Solana address (also the ed25519 pubkey)
 * @param {string} signatureB64    base64-encoded 64-byte detached signature
 * @returns {boolean}
 */
export function verifyClaim(wallet, signatureB64) {
  try {
    if (!SOL_ADDR_RE.test(wallet)) return false;
    const pubkey = base58Decode(wallet);
    if (pubkey.length !== 32) return false;
    const sig = base64ToBytes(signatureB64);
    if (sig.length !== 64) return false;
    const msg = new TextEncoder().encode(claimChallenge(wallet));
    return ed25519.verify(sig, msg, pubkey);
  } catch {
    return false;
  }
}

/**
 * The exact message a verified artist must sign to co-sign (vouch for) a
 * torchbearer. Binds both wallets so a signature can't be replayed against a
 * different supporter. (Phase 7 — Artist Co-Signs.)
 */
export function cosignChallenge(artistWallet, torchbearerWallet) {
  return `UNATRARE:COSIGN:${artistWallet}:${torchbearerWallet}`;
}

/**
 * Verify an artist co-sign signature against the artist's SOL pubkey.
 * @param {string} artistWallet      base58 SOL address of the signing artist
 * @param {string} torchbearerWallet base58 SOL address being co-signed
 * @param {string} signatureB64      base64-encoded 64-byte detached signature
 * @returns {boolean}
 */
export function verifyCosign(artistWallet, torchbearerWallet, signatureB64) {
  try {
    if (!SOL_ADDR_RE.test(artistWallet) || !SOL_ADDR_RE.test(torchbearerWallet)) return false;
    const pubkey = base58Decode(artistWallet);
    if (pubkey.length !== 32) return false;
    const sig = base64ToBytes(signatureB64);
    if (sig.length !== 64) return false;
    const msg = new TextEncoder().encode(cosignChallenge(artistWallet, torchbearerWallet));
    return ed25519.verify(sig, msg, pubkey);
  } catch {
    return false;
  }
}

// ── Field normalization ──────────────────────────────────────────────────────
// Names nobody may claim: official/impersonation risks. Compared after
// normalization (lowercase, alnum + underscore only).
const RESERVED_HANDLES = new Set([
  'admin', 'administrator', 'root', 'mod', 'moderator', 'staff', 'team',
  'unatrare', 'unat', 'official', 'support', 'help', 'system',
  'satoshi', 'nakamoto', 'bitcoin', 'counterparty', 'council',
  'torchbearer', 'null', 'undefined', 'anon', 'anonymous',
]);

export function isReservedHandle(handle) {
  return RESERVED_HANDLES.has(String(handle || '').toLowerCase());
}

export function normalizeHandle(raw) {
  const h = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (h.length < 3 || h.length > 20) return null;
  return h;
}

function clean(str, max) {
  return String(str || '').trim().slice(0, max);
}

function normalizeTwitter(raw) {
  return clean(raw, 40).replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '');
}

function normalizeWebsite(raw) {
  const w = clean(raw, 200);
  if (!w) return '';
  if (/^https?:\/\//i.test(w)) return w;
  return `https://${w}`;
}

// Avatar is rendered as <img src>. Only allow absolute http(s) URLs so a
// crafted scheme (javascript:, data:, etc.) can never reach the DOM.
function normalizeAvatar(raw) {
  const a = clean(raw, 300);
  if (!a) return '';
  return /^https?:\/\//i.test(a) ? a : '';
}

// ── Bitcoin block identity ───────────────────────────────────────────────────
// Every torchbearer is dealt a random, unclaimed Bitcoin block as their identity
// anchor. The draw is seeded by a real Bitcoin block hash so it is provably fair
// (not even admin can rig it): assigned = SHA256(seedHash : wallet : nonce) mod (tip+1).
// While unclaimed blocks remain in [0, tip] (~900k+), assignment is instant. Once
// every block up to the tip is taken, new claims naturally pace to Bitcoin's ~10-min
// cadence as fresh blocks arrive.

/** Fetch the current Bitcoin tip height + hash from mempool.space (entropy source). */
export async function fetchBitcoinTip() {
  const base = 'https://mempool.space/api';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const [hRes, hashRes] = await Promise.all([
      fetch(`${base}/blocks/tip/height`, { cache: 'no-store', signal: ctrl.signal }),
      fetch(`${base}/blocks/tip/hash`, { cache: 'no-store', signal: ctrl.signal }),
    ]);
    if (!hRes.ok || !hashRes.ok) throw new Error('could not reach Bitcoin (mempool.space)');
    const height = parseInt((await hRes.text()).trim(), 10);
    const hash = (await hashRes.text()).trim();
    if (!Number.isFinite(height) || !/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error('bad tip data from mempool.space');
    }
    return { height, hash };
  } finally {
    clearTimeout(timer);
  }
}

/** Deterministic, provably-fair candidate block for a wallet given a Bitcoin seed. */
function deriveGenesisBlock(seedHash, wallet, tipHeight, nonce) {
  const digest = createHash('sha256').update(`${seedHash}:${wallet}:${nonce}`).digest();
  const n = digest.readBigUInt64BE(0);
  return Number(n % BigInt(tipHeight + 1)); // 0..tipHeight inclusive
}

/**
 * Deal a torchbearer their permanent Bitcoin block on first claim (idempotent).
 * Retries on the (astronomically rare) UNIQUE collision by bumping the nonce.
 * @returns {{ ok: boolean, block?: number, fresh?: boolean, error?: string }}
 */
export function ensureGenesisBlock(wallet, { seedHash, seedHeight, tipHeight }) {
  if (!SOL_ADDR_RE.test(wallet)) return { ok: false, error: 'invalid wallet' };
  if (!/^[0-9a-f]{64}$/.test(String(seedHash)) || !Number.isFinite(tipHeight)) {
    return { ok: false, error: 'invalid Bitcoin seed' };
  }
  try {
    const db = getDb();
    const existing = db.prepare('SELECT genesis_block FROM torchbearers WHERE sol_wallet = ?').get(wallet);
    if (existing && existing.genesis_block != null) {
      return { ok: true, block: existing.genesis_block, fresh: false };
    }
    for (let nonce = 0; nonce < 10000; nonce++) {
      const cand = deriveGenesisBlock(seedHash, wallet, tipHeight, nonce);
      const taken = db.prepare('SELECT 1 FROM torchbearers WHERE genesis_block = ?').get(cand);
      if (taken) continue;
      try {
        if (existing) {
          db.prepare(`UPDATE torchbearers SET genesis_block = ?, claim_seed_hash = ?, claim_seed_height = ?, updated_at = unixepoch() WHERE sol_wallet = ?`)
            .run(cand, seedHash, seedHeight, wallet);
        } else {
          db.prepare(`INSERT INTO torchbearers (sol_wallet, genesis_block, claim_seed_hash, claim_seed_height, claimed_at, updated_at)
                      VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`)
            .run(wallet, cand, seedHash, seedHeight);
        }
        return { ok: true, block: cand, fresh: true };
      } catch (err) {
        if (String(err.message || '').includes('UNIQUE')) continue; // concurrent claim took it
        return { ok: false, error: err.message || 'could not assign block' };
      }
    }
    // Every block up to the tip is claimed — wait for Bitcoin's next block.
    return { ok: false, error: 'all blocks up to the current tip are claimed — wait for the next Bitcoin block (~10 min)' };
  } catch (err) {
    return { ok: false, error: err.message || 'database unavailable' };
  }
}

// ── DB helpers ───────────────────────────────────────────────────────────────
/** Read one torchbearer identity, or null if unclaimed. */
export function getTorchbearer(wallet) {
  try {
    const db = getDb();
    return db.prepare('SELECT * FROM torchbearers WHERE sol_wallet = ?').get(wallet) || null;
  } catch {
    return null;
  }
}

/** Is a handle taken by a different wallet? */
export function handleTaken(handle, exceptWallet = '') {
  try {
    const db = getDb();
    const row = db.prepare('SELECT sol_wallet FROM torchbearers WHERE handle = ?').get(handle);
    return !!row && row.sol_wallet !== exceptWallet;
  } catch {
    return false;
  }
}

/**
 * Create or update a torchbearer identity. Assumes the caller has already
 * verified wallet ownership via verifyClaim().
 * @returns {{ ok: boolean, error?: string, torchbearer?: object }}
 */
export function upsertTorchbearer(wallet, fields = {}) {
  if (!SOL_ADDR_RE.test(wallet)) return { ok: false, error: 'invalid wallet' };

  const handle = fields.handle != null ? normalizeHandle(fields.handle) : '';
  if (fields.handle != null && fields.handle !== '' && handle === null) {
    return { ok: false, error: 'handle must be 3–20 chars: letters, numbers, underscore' };
  }
  if (handle && isReservedHandle(handle)) {
    return { ok: false, error: 'that handle is reserved — please choose another' };
  }
  if (handle && handleTaken(handle, wallet)) {
    return { ok: false, error: 'that handle is already taken' };
  }

  const row = {
    handle:       handle || '',
    display_name: clean(fields.display_name, 40),
    avatar_url:   normalizeAvatar(fields.avatar_url),
    bio:          clean(fields.bio, 280),
    twitter:      normalizeTwitter(fields.twitter),
    website:      normalizeWebsite(fields.website),
    hidden:       fields.hidden ? 1 : 0,
    show_wallet:  fields.show_wallet ? 1 : 0,
  };

  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO torchbearers
        (sol_wallet, handle, display_name, avatar_url, bio, twitter, website, hidden, show_wallet, claimed_at, updated_at)
      VALUES
        (@sol_wallet, @handle, @display_name, @avatar_url, @bio, @twitter, @website, @hidden, @show_wallet, unixepoch(), unixepoch())
      ON CONFLICT(sol_wallet) DO UPDATE SET
        handle       = excluded.handle,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        bio          = excluded.bio,
        twitter      = excluded.twitter,
        website      = excluded.website,
        hidden       = excluded.hidden,
        show_wallet  = excluded.show_wallet,
        updated_at   = unixepoch()
    `).run({ sol_wallet: wallet, ...row });
    return { ok: true, torchbearer: getTorchbearer(wallet) };
  } catch (err) {
    return { ok: false, error: err.message || 'could not save identity' };
  }
}

/**
 * Resolve display identities for a list of wallets in one query.
 * @returns {Map<wallet, {handle, display_name, avatar_url, hidden, show_wallet}>}
 */
export function resolveIdentities(wallets = []) {
  const map = new Map();
  const list = [...new Set(wallets.filter(w => SOL_ADDR_RE.test(w)))];
  if (list.length === 0) return map;
  try {
    const db = getDb();
    const placeholders = list.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT sol_wallet, handle, display_name, avatar_url, hidden, show_wallet, genesis_block
         FROM torchbearers WHERE sol_wallet IN (${placeholders})`
    ).all(...list);
    for (const r of rows) map.set(r.sol_wallet, r);
  } catch {
    /* fall through — unresolved wallets just render truncated */
  }
  return map;
}

export function truncateWallet(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/**
 * Single source of truth for how a wallet should be shown in the UI, anon-aware.
 * - claimed with a handle  → "@handle" (wallet masked unless show_wallet)
 * - claimed, name only     → display name
 * - unclaimed              → truncated wallet
 * @param {object|null} identity  a torchbearers row (or null / Map entry)
 * @param {string} wallet         the sol wallet address
 */
export function displayFor(identity, wallet) {
  const trunc = truncateWallet(wallet);
  if (!identity) {
    return { label: trunc, handle: '', name: '', block: null, avatar: '', bio: '', twitter: '', website: '',
             showWallet: true, hidden: false, claimed: false };
  }
  const handle = identity.handle || '';
  const name   = identity.display_name || '';
  const block  = identity.genesis_block ?? null;
  const showWallet = !!identity.show_wallet;
  const label = handle ? `@${handle}` : (name || (block != null ? `Block #${block}` : trunc));
  return {
    label, handle, name, block,
    avatar:  identity.avatar_url || '',
    bio:     identity.bio || '',
    twitter: identity.twitter || '',
    website: identity.website || '',
    showWallet,
    hidden:  !!identity.hidden,
    claimed: true,
  };
}
