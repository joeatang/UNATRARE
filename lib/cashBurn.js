// Cash Burn Ceremony — domain model, tier system, character roster.
// Pure data + helpers. No DB, no fs. Safe to import anywhere.

// ── Tier system ─────────────────────────────────────────────────────────────
// Scales the ceremony graphic & language by burn size. Every tier unlocks
// more visual treatment in lib/burnImage.js (flames, scorch, crown, etc).
// Order matters — first match wins, evaluated top-down.
export const BURN_TIERS = [
  { key: 'cataclysm', label: 'CATACLYSM',  min: 1_000_000_000, color: '#ffd36a', accent: '#ff6a3a', flames: 6, crown: true,  border: 'gold',   ashParticles: 28, ground: 'inferno' },
  { key: 'legendary', label: 'LEGENDARY',  min:   100_000_000, color: '#ffd36a', accent: '#ff8f5a', flames: 5, crown: true,  border: 'gold',   ashParticles: 18, ground: 'inferno' },
  { key: 'inferno',   label: 'INFERNO',    min:    10_000_000, color: '#ff8f5a', accent: '#ff6a3a', flames: 4, crown: false, border: 'amber',  ashParticles: 12, ground: 'scorch'  },
  { key: 'bonfire',   label: 'BONFIRE',    min:     1_000_000, color: '#ffb86b', accent: '#ff8f5a', flames: 3, crown: false, border: 'amber',  ashParticles: 8,  ground: 'scorch'  },
  { key: 'flame',     label: 'FLAME',      min:       100_000, color: '#ffb86b', accent: '#ff8f5a', flames: 2, crown: false, border: 'dim',    ashParticles: 4,  ground: 'glow'    },
  { key: 'torch',     label: 'TORCH',      min:        10_000, color: '#b4ff6f', accent: '#ffb86b', flames: 1, crown: false, border: 'dim',    ashParticles: 2,  ground: 'glow'    },
  { key: 'ember',     label: 'EMBER',      min:             1, color: '#b4ff6f', accent: '#a89060', flames: 1, crown: false, border: 'dim',    ashParticles: 0,  ground: 'none'    },
];

export function tierForBurn(amount) {
  const n = Number(amount || 0);
  for (const t of BURN_TIERS) if (n >= t.min) return t;
  return BURN_TIERS[BURN_TIERS.length - 1];
}

// ── Character roster ────────────────────────────────────────────────────────
// `sprite` is the filename in /public/sprites/.
// `key` is the stable identifier used in DB + URLs.
// `suggested_tiers` only affects the AUTO-PICK default. Admin can override
// to any character regardless of tier.
export const BURN_CHARACTERS = [
  { key: 'classic',  title: 'THE CLASSIC',     sprite: '01_classic.webp',  serial_prefix: 'FRK', bureau: 'Federal Reserve of Kek',     quote: 'FEELS GOOD. FEELS RIGHT. FEELS PEPE.',           suggested_tiers: ['ember', 'torch', 'flame', 'bonfire'] },
  { key: 'satoshi',  title: 'THE SATOSHI',     sprite: '02_satoshi.webp',  serial_prefix: 'BOS', bureau: 'Bank of Satoshi',            quote: 'TWENTY-ONE MILLION REASONS. ONE FROG.',          suggested_tiers: ['inferno', 'legendary', 'cataclysm'] },
  { key: 'lord',     title: 'THE LORD',        sprite: '03_lord.webp',     serial_prefix: 'KOK', bureau: 'Kek Order of Kings',         quote: 'BOW. THE PEPE LORD ACCEPTS YOUR BURN.',          suggested_tiers: ['legendary', 'cataclysm'] },
  { key: 'anon',     title: 'THE ANON',        sprite: '04_anon.webp',     serial_prefix: 'ANN', bureau: 'Anonymous Reserve',          quote: 'WE ARE LEGION. WE BURN AS ONE.',                 suggested_tiers: ['flame', 'bonfire', 'inferno'] },
  { key: 'trump',    title: 'THE BIGLY',       sprite: '05_trump.webp',    serial_prefix: 'BIG', bureau: 'Bigly Bureau',               quote: 'TREMENDOUS BURN. THE BEST BURN. EVERYONE SAYS SO.', suggested_tiers: ['inferno', 'legendary'] },
  { key: 'pepecash', title: 'THE CASH FROG',   sprite: '06_pepecash.webp', serial_prefix: 'PCH', bureau: 'Pepecash Honorary Mint',     quote: 'IN HONOR OF PEPECASH \u2014 MINTED ON BITCOIN, 2016.', suggested_tiers: ['flame', 'bonfire', 'inferno', 'legendary'] },
  { key: 'homer',    title: 'THE HOMER',       sprite: '07_homer.webp',    serial_prefix: 'DOH', bureau: 'Department of Hubris',       quote: 'D\u2019OH. RIGHT INTO THE FIRE.',                suggested_tiers: ['ember', 'torch', 'flame'] },
  { key: 'jong',     title: 'THE SUPREME',     sprite: '08_jong.webp',     serial_prefix: 'SPM', bureau: 'Supreme Reserve',            quote: 'A GREAT BURN OF THE PEOPLE.',                    suggested_tiers: ['bonfire', 'inferno', 'legendary'] },
  { key: 'hair',     title: 'THE VOLUME',      sprite: '09_hair.webp',     serial_prefix: 'VOL', bureau: 'Volume Bureau',              quote: 'MAXIMUM VOLUME. MAXIMUM BURN.',                  suggested_tiers: ['torch', 'flame', 'bonfire'] },
  { key: 'gox',      title: 'THE GOX',         sprite: '10_gox.webp',      serial_prefix: 'GOX', bureau: 'Mt. Gox Memorial',           quote: 'GONE. UNRECOVERABLE. JUST LIKE OLD TIMES.',      suggested_tiers: ['inferno', 'legendary', 'cataclysm'] },
  { key: 'flooney',  title: 'THE FLOONEY',     sprite: '11_flooney.webp',  serial_prefix: 'LON', bureau: 'Loon Reserve',               quote: 'BURN BABY BURN. AROOO.',                         suggested_tiers: ['torch', 'flame', 'bonfire'] },
  { key: 'djpepe',   title: 'DJ PEPE',         sprite: '12_djpepe.webp',   serial_prefix: 'DJP', bureau: 'Beat Street Mint',           quote: 'DROP THE BEAT. DROP THE BURN.',                  suggested_tiers: ['flame', 'bonfire', 'inferno'] },
  { key: 'bane',     title: 'THE FIRE',        sprite: '13_bane.webp',     serial_prefix: 'FIR', bureau: 'Pain Bureau',                quote: 'I AM THE FIRE.',                                 suggested_tiers: ['inferno', 'legendary', 'cataclysm'] },
  { key: 'classic2', title: 'THE CLASSIC II',  sprite: '14_classic2.webp', serial_prefix: 'FR2', bureau: 'Federal Reserve of Kek (B)', quote: 'TWICE AS CLASSIC. STILL FEELS PEPE.',            suggested_tiers: ['torch', 'flame', 'bonfire'] },
  { key: 'cool',     title: 'THE COOL',        sprite: '15_cool.webp',     serial_prefix: 'COL', bureau: 'Cool Cash Bureau',           quote: 'STAY COOL. BURN WARM.',                          suggested_tiers: ['ember', 'torch', 'flame'] },
  { key: 'haze',     title: 'THE HAZE',        sprite: '16_haze.webp',     serial_prefix: 'HAZ', bureau: 'Higher Ministry',            quote: 'ELEVATED BURN. ELEVATED MIND.',                  suggested_tiers: ['flame', 'bonfire', 'inferno'] },
  { key: 'fine',     title: 'THE FINE',        sprite: '17_fine.webp',     serial_prefix: 'BFR', bureau: 'Bureau of Fine Reserves',    quote: 'THIS IS FINE. WE ARE STILL HERE.',               suggested_tiers: ['ember', 'torch', 'flame', 'bonfire', 'inferno'] },
  { key: 'bear',     title: 'THE BEAR',        sprite: '18_bear.webp',     serial_prefix: 'BMR', bureau: 'Bear Market Reserve',        quote: 'BURN THROUGH THE WINTER. SUMMER REMEMBERS.',     suggested_tiers: ['torch', 'flame', 'bonfire', 'inferno'] },
  { key: 'threed',   title: 'THE THIRD DIM.',  sprite: '19_3d.webp',       serial_prefix: 'D3D', bureau: 'Dimensional Reserve',        quote: 'BURNED ACROSS THREE DIMENSIONS. UNRECOVERABLE.', suggested_tiers: ['inferno', 'legendary', 'cataclysm'] },
];

export const CHARACTER_BY_KEY = Object.fromEntries(BURN_CHARACTERS.map(c => [c.key, c]));

export function isValidCharacterKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(CHARACTER_BY_KEY, key);
}

// Smart default: pick a character whose suggested_tiers include the burn tier.
// Falls back to CLASSIC if nothing matches. Deterministic per (tier + seed).
export function pickCharacterForTier(tierKey, seed = 0) {
  const eligible = BURN_CHARACTERS.filter(c => c.suggested_tiers.includes(tierKey));
  const pool = eligible.length ? eligible : BURN_CHARACTERS;
  const idx = Math.abs(Number(seed) | 0) % pool.length;
  return pool[idx];
}

// ── Amount formatting ───────────────────────────────────────────────────────
// Two formats: compact (for graphic chrome) and full (for primary display).

export function fmtCompact(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  if (x >= 1e12) return (x / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
  if (x >= 1e9)  return (x / 1e9 ).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (x >= 1e6)  return (x / 1e6 ).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (x >= 1e3)  return (x / 1e3 ).toFixed(2).replace(/\.?0+$/, '') + 'K';
  return Math.round(x).toString();
}

// Full formatted with comma separators. Whole numbers only on the graphic.
export function fmtFull(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  return Math.round(x).toLocaleString('en-US');
}

// Returns the display string + a font-size hint for the graphic. Auto-scales
// down as the number of characters grows so 6.9B and 6,942,069,420 both fit.
export function displayAmountForGraphic(n) {
  const full = fmtFull(n);
  const compact = fmtCompact(n);
  // Use full if it fits in ~14 chars (e.g. "69,420,000"). Otherwise compact.
  const primary = full.length <= 14 ? full : compact;
  const fontSize =
    primary.length <= 6  ? 128 :
    primary.length <= 9  ? 108 :
    primary.length <= 12 ? 88  : 72;
  return { primary, secondary: primary === full ? compact : full, fontSize };
}

// ── Serial numbers ──────────────────────────────────────────────────────────
// Stable, human-readable. e.g. "BFR-000042 / SERIES 0"
export function makeSerial(characterKey, sequence) {
  const ch = CHARACTER_BY_KEY[characterKey] || CHARACTER_BY_KEY.classic;
  const padded = String(Math.max(0, Number(sequence) | 0)).padStart(6, '0');
  return `${ch.serial_prefix}-${padded}`;
}
