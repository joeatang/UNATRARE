/**
 * RarityBar — supply-based rarity tier indicator
 *
 * Tiers based on UNATRARE supply cap of 21,000:
 *   UNIQUE     supply = 1        ■■■■■  cyan
 *   LEGENDARY  supply 2–10       ■■■■■  Bitcoin orange
 *   EPIC       supply 11–100     ■■■■░  purple
 *   RARE       supply 101–1000   ■■■░░  amber
 *   UNCOMMON   supply 1001–5000  ■■░░░  green
 *   COMMON     supply 5001+      ■░░░░  dim
 */

export function getRarityTier(supply) {
  if (!supply || supply <= 0) return null;
  if (supply === 1)       return { tier: 'UNIQUE',    color: '#00ffff', filled: 5, total: 5 };
  if (supply <= 10)       return { tier: 'LEGENDARY', color: '#F7931A', filled: 5, total: 5 };
  if (supply <= 100)      return { tier: 'EPIC',      color: '#9b59b6', filled: 4, total: 5 };
  if (supply <= 1000)     return { tier: 'RARE',      color: '#C9A84C', filled: 3, total: 5 };
  if (supply <= 5000)     return { tier: 'UNCOMMON',  color: '#5abf5a', filled: 2, total: 5 };
  return                         { tier: 'COMMON',    color: '#666666', filled: 1, total: 5 };
}

/**
 * compact=true  — single line, fits inside card frame footer
 * compact=false — block display with larger text, for detail pages
 */
export default function RarityBar({ supply, compact = false }) {
  const rarity = getRarityTier(supply);
  if (!rarity) return null;

  const { tier, color, filled, total } = rarity;
  const blocks = Array.from({ length: total }, (_, i) => i < filled);

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '11px',
        lineHeight: 1,
      }}>
        {blocks.map((on, i) => (
          <span key={i} style={{ color: on ? color : '#2a2a2a' }}>■</span>
        ))}
        <span style={{
          color,
          marginLeft: '4px',
          fontFamily: "'VT323', monospace",
          fontSize: '13px',
          letterSpacing: '0.05em',
        }}>
          {tier}
        </span>
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {blocks.map((on, i) => (
          <span key={i} style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            background: on ? color : '#111',
            border: `1px solid ${on ? color : '#2a2a2a'}`,
          }} />
        ))}
      </div>
      <span style={{
        fontFamily: "'VT323', monospace",
        fontSize: '22px',
        color,
        letterSpacing: '0.08em',
        lineHeight: 1,
      }}>
        {tier}
      </span>
    </div>
  );
}
