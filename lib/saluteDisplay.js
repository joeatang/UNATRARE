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
// Strip trailing zeros ONLY after a decimal point (e.g. "1.500"->"1.5", "2.00"->"2")
// WITHOUT eating the trailing zero of a whole number (e.g. "690" must stay "690").
function trimZeros(s) {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
export function fmtCash(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  if (x >= 1_000_000_000_000) return trimZeros((x / 1_000_000_000_000).toFixed(x >= 100_000_000_000_000 ? 0 : 3)) + 'T';
  if (x >= 1_000_000_000) return trimZeros((x / 1_000_000_000).toFixed(x >= 100_000_000_000 ? 0 : 3)) + 'B';
  if (x >= 1_000_000)     return trimZeros((x / 1_000_000).toFixed(x >= 100_000_000 ? 0 : 2)) + 'M';
  if (x >= 1_000)         return trimZeros((x / 1_000).toFixed(x >= 100_000 ? 0 : 2)) + 'K';
  if (x >= 100) return Math.round(x).toString();
  return trimZeros(x.toFixed(2));
}

export function truncateWallet(addr) {
  if (!addr || typeof addr !== 'string') return '';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
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
