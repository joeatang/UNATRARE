// Shared helpers for rendering salute totals in a consistent, branded way.
// Used by directory strips, /burns page, and card page badges.

export const SALUTE_TIERS = [
  { key: 'legendary', label: 'LEGENDARY',     min: 69_000_000, color: '#ffd36a' },
  { key: 'inferno',   label: 'INFERNO',       min: 10_000_000, color: '#ff8f5a' },
  { key: 'bonfire',   label: 'BONFIRE',       min:  1_000_000, color: '#ffb86b' },
  { key: 'flame',     label: 'FLAME',         min:    100_000, color: '#ffb86b' },
  { key: 'torch',     label: 'TORCH',         min:     10_000, color: '#b4ff6f' },
  { key: 'ember',     label: 'EMBER',         min:          1, color: '#b4ff6f' },
  { key: 'dormant',   label: 'AWAITING SALUTE', min:        0, color: '#8f8f8f' },
];

export function tierFor(totalBurned) {
  const n = Number(totalBurned || 0);
  for (const t of SALUTE_TIERS) {
    if (n >= t.min) return t;
  }
  return SALUTE_TIERS[SALUTE_TIERS.length - 1];
}

// Compact human-friendly amount formatter for $CASH burns.
// 1234         -> "1.23K"
// 4_200_000    -> "4.2M"
// 2_016_000_000 -> "2.016B"
export function fmtCash(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  if (x >= 1_000_000_000) return (x / 1_000_000_000).toFixed(x >= 100_000_000_000 ? 0 : 3).replace(/\.?0+$/, '') + 'B';
  if (x >= 1_000_000)     return (x / 1_000_000).toFixed(x >= 100_000_000 ? 0 : 2).replace(/\.?0+$/, '') + 'M';
  if (x >= 1_000)         return (x / 1_000).toFixed(x >= 100_000 ? 0 : 2).replace(/\.?0+$/, '') + 'K';
  if (x >= 100) return Math.round(x).toString();
  return x.toFixed(2).replace(/\.?0+$/, '');
}

export function truncateWallet(addr) {
  if (!addr || typeof addr !== 'string') return '';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// Site-wide $CASH burned totals: card salutes + admin cash-burn ceremonies.
// Always returns a numeric breakdown — callers can show one combined figure
// and optionally render the split.
//   { total, salutes, ceremonies, ceremonyCount }
// Only verified ceremonies (tx_sig non-empty, status != archived) are counted.
// Card salutes are already on-chain verified at write time.
export function getSitewideBurnTotals(db) {
  const zero = { total: 0, salutes: 0, ceremonies: 0, ceremonyCount: 0 };
  if (!db) return zero;
  try {
    const sal = db.prepare(
      'SELECT COALESCE(SUM(amount_display), 0) AS total FROM card_salutes'
    ).get();
    let cer = { total: 0, n: 0 };
    try {
      cer = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n
        FROM cash_burns
        WHERE status != 'archived' AND tx_sig != ''
      `).get() || cer;
    } catch { /* table may not exist on cold start; treat as 0 */ }
    const salutes    = Number(sal?.total || 0);
    const ceremonies = Number(cer?.total || 0);
    return {
      total:         salutes + ceremonies,
      salutes,
      ceremonies,
      ceremonyCount: Number(cer?.n || 0),
    };
  } catch {
    return zero;
  }
}

// Per-card salute summary used by directory strips.
// Single SQL roundtrip per card, batched by caller via getSalutesByCardBatch().
export function getSalutesByCardBatch(db, cardNames) {
  if (!Array.isArray(cardNames) || cardNames.length === 0) return new Map();
  const placeholders = cardNames.map(() => '?').join(',');
  const since24h = Math.floor(Date.now() / 1000) - 86400;

  const rows = db.prepare(`
    SELECT
      card_name,
      SUM(amount_display)                                AS total_burned,
      COUNT(DISTINCT sol_wallet)                         AS unique_burners,
      COUNT(*)                                           AS burn_count,
      SUM(CASE WHEN burned_at >= ? THEN amount_display ELSE 0 END) AS total_24h
    FROM card_salutes
    WHERE card_name IN (${placeholders})
    GROUP BY card_name
  `).all(since24h, ...cardNames);

  const map = new Map();
  for (const r of rows) map.set(r.card_name, r);
  return map;
}
