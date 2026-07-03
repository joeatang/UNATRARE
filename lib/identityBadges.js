// lib/identityBadges.js — server-side badge engine (Phase 1, visual only).
//
// Builds the small "who you are" chips that travel with a wallet across the
// site (profile headers, leaderboard rows, /burns, hall …). Reads only cheap
// CACHED data (trust_scores + torchbearers) — never a live network call, never
// a write — so it is safe to call on any render path.
//
// GATE: getIdentityBadges() returns [] whenever the `reward_badges` feature
// flag is OFF (the default). Nothing renders anywhere until the founder flips
// the switch in /admin. Consumers that build chips from already-known numbers
// via badgesFromSignals() MUST check featureEnabled('reward_badges') first.

import { getDb } from './db.js';
import { featureEnabled } from './features.js';
import { signalTier } from './signalWeight.js';
import { tierFor, fmtCash } from './saluteDisplay.js';
import { resolveLinkedFlags, linkedStatusFor } from './walletLink.js';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// The two sealed honors, capped at 69. Ordering is Bitcoin/earliest-action
// truth so it can't be gamed. Cheap (LIMIT 69) — computed once per request.
const HONOR_CAP = 69;
function first69Sets(db) {
  const claim = new Set();
  const spark = new Set();
  try {
    for (const r of db.prepare(`
      SELECT sol_wallet FROM torchbearers
      WHERE genesis_block IS NOT NULL
      ORDER BY (claim_seed_height IS NULL), claim_seed_height ASC, claimed_at ASC
      LIMIT ${HONOR_CAP}
    `).all()) claim.add(r.sol_wallet);
  } catch { /* ignore */ }
  try {
    for (const r of db.prepare(`
      SELECT sol_wallet FROM (
        SELECT sol_wallet, MIN(burned_at) AS first_burn
        FROM card_salutes
        GROUP BY sol_wallet
      )
      ORDER BY first_burn ASC
      LIMIT ${HONOR_CAP}
    `).all()) spark.add(r.sol_wallet);
  } catch { /* ignore */ }
  return { claim, spark };
}

// Static descriptors for the boolean badges. Flame/burn chips are generated
// dynamically because their colour + label come from the tier they land in.
//
// NOTE: the generic "founder" glyph is retired from the chip row — every wallet
// that claims gets a genesis block, so it was meaningless as a badge (the ⛓
// Genesis Block #N still shows as its own element). Scarcity now lives in the
// two SEALED-FOREVER honors below, both capped at 69 and ordered by Bitcoin /
// earliest-action truth so they can't be gamed.
export const BADGE_META = {
  founder:  { glyph: '🧱', label: 'Founder',  color: '#ffd36a', title: 'Claimed a Bitcoin genesis block' },
  unatpepe: { glyph: '🐸', label: 'UNATPEPE', color: '#8bd450', title: 'Holds UNATPEPE on Bitcoin' },
  node:     { glyph: '🖥️', label: 'Node',     color: '#7ac7ff', title: 'Runs a UNATRARE node' },
  // Scarce, sealed-forever honors (cap 69). Labels are easily renamed here.
  founding69: { glyph: '⛓', label: 'Founding 69', color: '#ffd36a', title: 'One of the first 69 to claim a Bitcoin genesis block' },
  firstSpark: { glyph: '⚡', label: 'First Spark', color: '#ff8f5a', title: 'One of the first 69 wallets to ever light a salute' },
};

// Pure — no DB, no flag check. Turns a set of already-known signals into an
// ordered list of chip descriptors. Callers that already have the numbers
// (e.g. a leaderboard row) use this to avoid an extra per-row query.
export function badgesFromSignals({
  score = 0,
  totalBurned = 0,
  founder = false,          // kept for API compat; no longer emits a chip
  unatpepe = false,
  node = false,
  founding69 = false,
  firstSpark = false,
} = {}) {
  const out = [];

  // Scarce honors lead the row (rarest first).
  if (founding69) out.push({ key: 'founding69', ...BADGE_META.founding69 });
  if (firstSpark) out.push({ key: 'firstSpark', ...BADGE_META.firstSpark });
  if (unatpepe) out.push({ key: 'unatpepe', ...BADGE_META.unatpepe });
  if (node) out.push({ key: 'node', ...BADGE_META.node });

  // Flame Rank — conviction (early/broad/sustained). Skip the base "kindling"
  // tier so the badge stays meaningful.
  const st = signalTier(Number(score) || 0);
  if (st && st.key !== 'kindling') {
    out.push({
      key: `flame_${st.key}`,
      glyph: '🔥',
      label: st.label,
      color: st.color,
      title: `Flame Rank: ${st.label} — Signal Weight ${Math.round(Number(score) || 0).toLocaleString()}`,
    });
  }

  // Burn tier — raw volume saluted. Skip "dormant" and "ember" (a single
  // salute) so only meaningful volume earns a chip.
  const bt = tierFor(Number(totalBurned) || 0);
  if (bt && bt.key !== 'dormant' && bt.key !== 'ember') {
    out.push({
      key: `burn_${bt.key}`,
      glyph: '✦',
      label: bt.label,
      color: bt.color,
      title: `Burn tier: ${bt.label} — ${fmtCash(Number(totalBurned) || 0)} $CASH saluted`,
    });
  }

  return out;
}

// Look up one wallet's badges from cached tables. Returns [] when the
// reward_badges flag is OFF, the wallet is malformed, or on any DB error.
export function getIdentityBadges(wallet) {
  if (!featureEnabled('reward_badges')) return [];
  if (!SOL_ADDR_RE.test(wallet || '')) return [];

  try {
    const db = getDb();
    const ts = db
      .prepare('SELECT score, total_burned, founder FROM trust_scores WHERE sol_wallet = ?')
      .get(wallet);

    let founder = ts ? Number(ts.founder || 0) > 0 : false;
    if (!founder) {
      const tb = db
        .prepare('SELECT genesis_block FROM torchbearers WHERE sol_wallet = ?')
        .get(wallet);
      founder = !!(tb && tb.genesis_block != null);
    }

    // UNATPEPE / node status travels via a signed Bitcoin↔Solana link.
    const linked = linkedStatusFor(wallet);

    // Sealed-forever scarce honors (cap 69).
    const { claim, spark } = first69Sets(db);

    return badgesFromSignals({
      score: ts ? Number(ts.score || 0) : 0,
      totalBurned: ts ? Number(ts.total_burned || 0) : 0,
      founder,
      unatpepe: linked.unatpepe,
      node: linked.node,
      founding69: claim.has(wallet),
      firstSpark: spark.has(wallet),
    });
  } catch {
    return [];
  }
}

/**
 * Batch-build badge chip rows for MANY wallets in a handful of queries — for
 * leaderboards / halls / card rows where a per-row DB call would be wasteful.
 * Returns [] for every wallet when the reward_badges flag is OFF.
 *
 * @param {string[]} wallets
 * @param {object}   [opts]
 * @param {Map<string,number>} [opts.totalsByWallet] page-supplied burn totals
 *        (e.g. a leaderboard already SUM()'d amount_display) — used for the burn
 *        tier chip so it stays truthful even when trust_scores is sparse.
 * @returns {Map<string, Array>} wallet → chip descriptors
 */
export function resolveIdentityBadges(wallets = [], { totalsByWallet } = {}) {
  const out = new Map();
  const list = [...new Set((wallets || []).filter(w => SOL_ADDR_RE.test(w)))];
  if (list.length === 0) return out;
  if (!featureEnabled('reward_badges')) {
    for (const w of list) out.set(w, []);
    return out;
  }

  let scores = new Map();
  let founders = new Set();
  let linked = new Map();
  let honorClaim = new Set();
  let honorSpark = new Set();
  try {
    const db = getDb();
    const ph = list.map(() => '?').join(',');
    for (const r of db.prepare(`SELECT sol_wallet, score, total_burned, founder FROM trust_scores WHERE sol_wallet IN (${ph})`).all(...list)) {
      scores.set(r.sol_wallet, r);
      if (Number(r.founder || 0) > 0) founders.add(r.sol_wallet);
    }
    for (const r of db.prepare(`SELECT sol_wallet FROM torchbearers WHERE genesis_block IS NOT NULL AND sol_wallet IN (${ph})`).all(...list)) {
      founders.add(r.sol_wallet);
    }
    linked = resolveLinkedFlags(list);
    const sets = first69Sets(db);
    honorClaim = sets.claim;
    honorSpark = sets.spark;
  } catch {
    for (const w of list) out.set(w, []);
    return out;
  }

  for (const w of list) {
    const ts = scores.get(w);
    const lk = linked.get(w) || {};
    const totalBurned = totalsByWallet?.has(w)
      ? Number(totalsByWallet.get(w) || 0)
      : (ts ? Number(ts.total_burned || 0) : 0);
    out.set(w, badgesFromSignals({
      score: ts ? Number(ts.score || 0) : 0,
      totalBurned,
      founder: founders.has(w),
      unatpepe: !!lk.unatpepe,
      node: !!lk.node,
      founding69: honorClaim.has(w),
      firstSpark: honorSpark.has(w),
    }));
  }
  return out;
}
