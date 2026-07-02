// ── Signal Weight — Phase 5 ────────────────────────────────────────────────
// A recomputable trust score per wallet, derived entirely from existing,
// on-chain-backed data. It rewards conviction that is hard to fake:
//   • EARLY     — you saluted a card BEFORE the Council certified it
//   • BROAD      — you back many different artists, not just one
//   • SUSTAINED  — you keep showing up across many days, not one big spike
//   • FOUNDER    — you claimed a Bitcoin genesis block (identity anchor)
// plus a log-scaled BASE from total $CASH burned, so whales lift the floor
// without flattening everyone else.
//
// The trust_scores table is a cache: the raw truth lives in card_salutes, so
// the whole thing can be dropped and rebuilt at any time with no data loss.

import { getDb } from './db.js';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Component weights — tune here. Kept intentionally simple and transparent.
const W = {
  breadthPerArtist: 8,   // points per distinct artist backed
  earlyPerSalute:   12,  // points per salute placed before certification
  sustainedPerDay:  3,   // points per distinct active day
  sustainedCapDays: 30,  // don't reward beyond this many days
  founderBonus:     15,  // flat bonus for claiming a genesis block
};

export const SIGNAL_TIERS = [
  { key: 'keeper',   label: 'KEEPER OF THE FLAME', min: 250, color: '#ffd36a' },
  { key: 'pillar',   label: 'PILLAR',              min: 120, color: '#ff8f5a' },
  { key: 'trusted',  label: 'TRUSTED',             min:  60, color: '#ffb86b' },
  { key: 'steady',   label: 'STEADY HAND',         min:  25, color: '#b4ff6f' },
  { key: 'kindling', label: 'KINDLING',            min:   0, color: '#8f8f8f' },
];

export function signalTier(score) {
  const n = Number(score || 0);
  for (const t of SIGNAL_TIERS) if (n >= t.min) return t;
  return SIGNAL_TIERS[SIGNAL_TIERS.length - 1];
}

const round1 = (n) => Math.round(Number(n || 0) * 10) / 10;

// Pure scoring math from raw per-wallet aggregates. Shared by the batch
// recompute and single-wallet lazy computation so the two can never diverge.
export function scoreParts(raw) {
  const totalBurned = Number(raw.total_burned || 0);
  const artists     = Number(raw.artists || 0);
  const activeDays  = Number(raw.active_days || 0);
  const early       = Number(raw.early_salutes || 0);
  const isFounder   = !!raw.founder;

  const base      = totalBurned > 0 ? Math.log10(1 + totalBurned) * 10 : 0;
  const breadth   = artists * W.breadthPerArtist;
  const earliness = early * W.earlyPerSalute;
  const sustained = Math.min(activeDays, W.sustainedCapDays) * W.sustainedPerDay;
  const founder   = isFounder ? W.founderBonus : 0;
  const score     = base + breadth + earliness + sustained + founder;

  return {
    score: round1(score),
    base: round1(base),
    breadth: round1(breadth),
    earliness: round1(earliness),
    sustained: round1(sustained),
    founder: round1(founder),
    total_burned: totalBurned,
    artists,
    active_days: activeDays,
    early_salutes: early,
  };
}

// Gather raw aggregates for every wallet (or just one, when `wallet` is set).
function gatherRaw(db, wallet) {
  const wClause = wallet ? 'WHERE s.sol_wallet = ?' : '';
  const base = db.prepare(`
    SELECT s.sol_wallet                                        AS sol_wallet,
           COALESCE(SUM(s.amount_display), 0)                  AS total_burned,
           COUNT(DISTINCT NULLIF(t.artist_handle, ''))         AS artists,
           COUNT(DISTINCT CAST(s.burned_at / 86400 AS INTEGER)) AS active_days
    FROM card_salutes s
    LEFT JOIN tokens t ON t.token_name = s.card_name
    ${wClause}
    GROUP BY s.sol_wallet
  `).all(...(wallet ? [wallet] : []));

  const early = db.prepare(`
    SELECT s.sol_wallet AS sol_wallet, COUNT(*) AS early
    FROM card_salutes s
    JOIN tokens t ON t.token_name = s.card_name
    WHERE t.council_certified = 1
      AND t.judged_at IS NOT NULL
      AND s.burned_at < t.judged_at
      ${wallet ? 'AND s.sol_wallet = ?' : ''}
    GROUP BY s.sol_wallet
  `).all(...(wallet ? [wallet] : []));
  const earlyMap = new Map(early.map(r => [r.sol_wallet, Number(r.early || 0)]));

  const founders = db.prepare(`
    SELECT sol_wallet FROM torchbearers
    WHERE genesis_block IS NOT NULL ${wallet ? 'AND sol_wallet = ?' : ''}
  `).all(...(wallet ? [wallet] : []));
  const founderSet = new Set(founders.map(r => r.sol_wallet));

  return base.map(r => ({
    sol_wallet: r.sol_wallet,
    total_burned: Number(r.total_burned || 0),
    artists: Number(r.artists || 0),
    active_days: Number(r.active_days || 0),
    early_salutes: earlyMap.get(r.sol_wallet) || 0,
    founder: founderSet.has(r.sol_wallet),
  }));
}

/**
 * Recompute Signal Weight for every wallet (or a single wallet).
 * Idempotent UPSERT — safe to run as often as you like.
 * @returns {{ wallets: number, ms: number }}
 */
export function computeSignalWeights(db = getDb(), { wallet = null } = {}) {
  const started = Date.now();
  const raws = gatherRaw(db, wallet);

  const upsert = db.prepare(`
    INSERT INTO trust_scores
      (sol_wallet, score, base, breadth, earliness, sustained, founder,
       total_burned, artists, active_days, early_salutes, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(sol_wallet) DO UPDATE SET
      score = excluded.score, base = excluded.base, breadth = excluded.breadth,
      earliness = excluded.earliness, sustained = excluded.sustained,
      founder = excluded.founder, total_burned = excluded.total_burned,
      artists = excluded.artists, active_days = excluded.active_days,
      early_salutes = excluded.early_salutes, computed_at = excluded.computed_at
  `);

  const run = db.transaction
    ? db.transaction((list) => {
        for (const r of list) writeOne(upsert, r);
      })
    : null;

  if (run) {
    run(raws);
  } else {
    // node:sqlite (DatabaseSync) has no .transaction() — use manual BEGIN/COMMIT.
    db.exec('BEGIN');
    try {
      for (const r of raws) writeOne(upsert, r);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  return { wallets: raws.length, ms: Date.now() - started };
}

function writeOne(upsert, r) {
  const p = scoreParts(r);
  upsert.run(
    r.sol_wallet, p.score, p.base, p.breadth, p.earliness, p.sustained,
    p.founder, p.total_burned, p.artists, p.active_days, p.early_salutes,
  );
}

/**
 * Read a single wallet's Signal Weight. Lazily computes + persists it the
 * first time so a freshly-active supporter sees their score immediately,
 * even before the scheduled recompute runs.
 * @returns {object|null} the trust_scores row, or null if the wallet has no salutes
 */
export function getSignalWeight(wallet) {
  if (!SOL_ADDR_RE.test(wallet || '')) return null;
  try {
    const db = getDb();
    let row = db.prepare('SELECT * FROM trust_scores WHERE sol_wallet = ?').get(wallet);
    if (!row) {
      computeSignalWeights(db, { wallet });
      row = db.prepare('SELECT * FROM trust_scores WHERE sol_wallet = ?').get(wallet);
    }
    return row || null;
  } catch {
    return null;
  }
}

/**
 * Batch-read stored Signal Weights for many wallets (does NOT lazy-compute —
 * intended for ranked lists / future feed weighting).
 * @returns {Map<string, object>} wallet → trust_scores row
 */
export function resolveSignalWeights(wallets = []) {
  const map = new Map();
  const list = [...new Set((wallets || []).filter(w => SOL_ADDR_RE.test(w)))];
  if (list.length === 0) return map;
  try {
    const db = getDb();
    const placeholders = list.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT * FROM trust_scores WHERE sol_wallet IN (${placeholders})`
    ).all(...list);
    for (const r of rows) map.set(r.sol_wallet, r);
  } catch {
    /* fall through — unresolved wallets simply have no signal */
  }
  return map;
}
