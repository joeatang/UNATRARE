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

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Static descriptors for the boolean badges. Flame/burn chips are generated
// dynamically because their colour + label come from the tier they land in.
export const BADGE_META = {
  founder:  { glyph: '🧱', label: 'Founder',  color: '#ffd36a', title: 'Claimed a Bitcoin genesis block' },
  unatpepe: { glyph: '🐸', label: 'UNATPEPE', color: '#8bd450', title: 'Holds UNATPEPE on Bitcoin' },
  node:     { glyph: '🖥️', label: 'Node',     color: '#7ac7ff', title: 'Runs a UNATRARE node' },
};

// Pure — no DB, no flag check. Turns a set of already-known signals into an
// ordered list of chip descriptors. Callers that already have the numbers
// (e.g. a leaderboard row) use this to avoid an extra per-row query.
export function badgesFromSignals({
  score = 0,
  totalBurned = 0,
  founder = false,
  unatpepe = false,
  node = false,
} = {}) {
  const out = [];

  if (founder) out.push({ key: 'founder', ...BADGE_META.founder });
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

    return badgesFromSignals({
      score: ts ? Number(ts.score || 0) : 0,
      totalBurned: ts ? Number(ts.total_burned || 0) : 0,
      founder,
    });
  } catch {
    return [];
  }
}
