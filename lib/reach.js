// lib/reach.js — Heralds & Reach (Social Phase 1).
//
// The social sibling of Signal Weight. Where Signal measures on-chain conviction
// (burns), REACH measures awareness a Herald actually generated: real people who
// clicked their tracked share link (?ref=<code>) and — the big lever — people who
// then saluted (a conversion). Reach is a rebuildable cache; the truth lives in
// reach_events (clicks) + referrals (conversions). Nothing here moves $CASH.
//
// Anti-gaming: clicks are deduped per visitor per (code, card); conversions come
// from the sybil-resistant referral attribution (claimed-block referees only);
// conversions vastly outweigh clicks so botting clicks is near-worthless; and a
// burn multiplier means your on-chain conviction amplifies — but never gates —
// your social score (a non-burner still earns full base Reach at ×1).

import crypto from 'node:crypto';
import { getDb } from './db.js';
import { resolveReferrerWallet } from './referrals.js';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Tunable weights — kept simple and transparent.
export const R = {
  clickValue:      2,    // points per unique real click
  conversionValue: 25,   // points per referred person (a click that led to a salute)
  clickCap:        750,  // soft cap on counted clicks per Herald (anti-farm)
  burnBoostCap:    1.0,   // max +100% multiplier from burning
};

export const REACH_TIERS = [
  { key: 'blaze',  label: 'BLAZE',   min: 500, color: '#ffd36a' },
  { key: 'signal', label: 'SIGNAL',  min: 200, color: '#ff8f5a' },
  { key: 'spark',  label: 'SPARK',   min:  60, color: '#ffb86b' },
  { key: 'ember',  label: 'EMBER',   min:  10, color: '#b4ff6f' },
  { key: 'quiet',  label: 'QUIET',   min:   0, color: '#8f8f8f' },
];

export function reachTier(reach) {
  const n = Number(reach || 0);
  for (const t of REACH_TIERS) if (n >= t.min) return t;
  return REACH_TIERS[REACH_TIERS.length - 1];
}

const round1 = (n) => Math.round(Number(n || 0) * 10) / 10;

/** Stable, privacy-preserving visitor fingerprint (never stores raw IP). */
export function visitorHash(ip, ua) {
  return crypto
    .createHash('sha256')
    .update(`${ip || ''}|${ua || ''}`)
    .digest('hex')
    .slice(0, 32);
}

/** log-scaled burn multiplier: non-burner = 1.0, heavy burner up to 1 + burnBoostCap. */
function burnMultiplier(totalBurned) {
  const t = Number(totalBurned || 0);
  if (t <= 0) return 1;
  const boost = Math.min(Math.log10(1 + t) / 12, R.burnBoostCap);
  return 1 + Math.max(0, boost);
}

/**
 * Log a CLICK from a tracked link. Deduped per visitor per (code, card).
 * Resolves the code to a claimed-torchbearer Herald; ignores unresolved codes
 * and self-clicks aren't distinguishable at click time (handled by dedup + the
 * fact that clicks are worth little). Returns the referrer wallet or null.
 */
export function recordClick(db, { code, card = '', ip = '', ua = '', refHost = '', blockHeight = null } = {}) {
  const referrer = resolveReferrerWallet(db, code);
  if (!referrer) return null;

  const cleanCode = String(code || '').trim().replace(/^@/, '').slice(0, 64);
  const cleanCard = String(card || '').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 50);
  const vh = visitorHash(ip, ua);

  try {
    db.prepare(
      `INSERT OR IGNORE INTO reach_events
         (code, referrer_wallet, card_name, visitor_hash, ref_host, block_height)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(cleanCode, referrer, cleanCard, vh, String(refHost || '').slice(0, 120), blockHeight);
  } catch {
    return referrer; // dedup collision or transient — safe to ignore
  }
  return referrer;
}

/** Gather raw click/conversion aggregates for one wallet (or all). */
function gatherReach(db, wallet) {
  const w = wallet && SOL_ADDR_RE.test(wallet) ? wallet : null;

  const clicks = db.prepare(`
    SELECT referrer_wallet AS wallet,
           COUNT(*)                       AS clicks,
           COUNT(DISTINCT card_name)      AS cards_shared
    FROM reach_events
    ${w ? 'WHERE referrer_wallet = ?' : ''}
    GROUP BY referrer_wallet
  `).all(...(w ? [w] : []));

  // Conversions = distinct real people this wallet referred (sybil-resistant:
  // referrals only holds claimed-block referees). Present only when the
  // reward_referral flag has ever run, else simply 0 — Reach still works.
  const conv = db.prepare(`
    SELECT referrer_wallet AS wallet, COUNT(*) AS conversions
    FROM referrals
    ${w ? 'WHERE referrer_wallet = ?' : ''}
    GROUP BY referrer_wallet
  `).all(...(w ? [w] : []));
  const convMap = new Map(conv.map(r => [r.wallet, Number(r.conversions || 0)]));

  return clicks.map(r => ({
    wallet: r.wallet,
    clicks: Number(r.clicks || 0),
    cards_shared: Number(r.cards_shared || 0),
    conversions: convMap.get(r.wallet) || 0,
  }));
}

function scoreReach(db, raw) {
  const clicks = Math.min(Number(raw.clicks || 0), R.clickCap);
  const conversions = Number(raw.conversions || 0);
  const burnedRow = db
    .prepare('SELECT COALESCE(SUM(amount_display), 0) AS tb FROM card_salutes WHERE sol_wallet = ?')
    .get(raw.wallet);
  const mult = burnMultiplier(Number(burnedRow?.tb || 0));
  const bases = clicks * R.clickValue + conversions * R.conversionValue;
  return {
    reach: round1(bases * mult),
    clicks: Number(raw.clicks || 0),
    conversions,
    cards_shared: Number(raw.cards_shared || 0),
    burn_mult: round1(mult),
  };
}

/** Recompute Reach for one wallet (or every Herald). Idempotent UPSERT. */
export function computeReach(db = getDb(), { wallet = null } = {}) {
  const started = Date.now();
  const raws = gatherReach(db, wallet);

  const upsert = db.prepare(`
    INSERT INTO reach_scores
      (sol_wallet, reach, clicks, conversions, cards_shared, burn_mult, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(sol_wallet) DO UPDATE SET
      reach = excluded.reach, clicks = excluded.clicks,
      conversions = excluded.conversions, cards_shared = excluded.cards_shared,
      burn_mult = excluded.burn_mult, computed_at = excluded.computed_at
  `);

  const writeAll = () => {
    for (const raw of raws) {
      const p = scoreReach(db, raw);
      upsert.run(raw.wallet, p.reach, p.clicks, p.conversions, p.cards_shared, p.burn_mult);
    }
  };

  db.exec('BEGIN');
  try { writeAll(); db.exec('COMMIT'); }
  catch (err) { db.exec('ROLLBACK'); throw err; }

  return { wallets: raws.length, ms: Date.now() - started };
}

/** Read one wallet's Reach; lazily computes + persists on first read. */
export function getReach(wallet) {
  if (!SOL_ADDR_RE.test(wallet || '')) return null;
  try {
    const db = getDb();
    let row = db.prepare('SELECT * FROM reach_scores WHERE sol_wallet = ?').get(wallet);
    if (!row) {
      computeReach(db, { wallet });
      row = db.prepare('SELECT * FROM reach_scores WHERE sol_wallet = ?').get(wallet);
    }
    return row || null;
  } catch {
    return null;
  }
}

/** Top Heralds who amplified a given card, ranked by unique real clicks. */
export function getHeraldsForCard(card, limit = 8) {
  const cleanCard = String(card || '').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 50);
  if (!cleanCard) return [];
  try {
    const db = getDb();
    return db.prepare(`
      SELECT referrer_wallet                   AS wallet,
             COUNT(DISTINCT visitor_hash)       AS reach_clicks,
             MIN(created_at)                    AS first_at
      FROM reach_events
      WHERE card_name = ?
      GROUP BY referrer_wallet
      ORDER BY reach_clicks DESC, first_at ASC
      LIMIT ?
    `).all(cleanCard, Math.max(1, Math.min(50, limit)));
  } catch {
    return [];
  }
}

/** Batch-read stored Reach for many wallets (does NOT lazy-compute). */
export function resolveReach(wallets = []) {
  const map = new Map();
  const list = [...new Set((wallets || []).filter(w => SOL_ADDR_RE.test(w)))];
  if (list.length === 0) return map;
  try {
    const db = getDb();
    const ph = list.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM reach_scores WHERE sol_wallet IN (${ph})`).all(...list);
    for (const r of rows) map.set(r.sol_wallet, r);
  } catch { /* empty map */ }
  return map;
}
