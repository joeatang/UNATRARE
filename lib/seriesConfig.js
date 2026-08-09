/**
 * Series structure — canonical config for the whole catalog.
 *
 * Locked 2026-08-09:
 * - Series 0 = HONORARY (admin-invited, code-gated) — cap 6.
 * - Series 1..6 = ART series — cap 69 each.
 * - Total across all series = 6 (honorary) + 6 × 69 (art) = 420.
 *
 * Changing these numbers changes the auto-graduation ceiling, admin
 * validation, and directory progress copy. Keep in sync with:
 * - app/api/admin/action/route.js (approve + genesis)
 * - app/directory/page.js (progress, sealed badge, global counter)
 * - app/admin/page.js (SERIES OVERRIDE hint)
 */

export const HONORARY_SERIES = 0;
export const HONORARY_CAP    = 6;

export const ART_SERIES_CAP  = 69;    // per art series
export const ART_SERIES_COUNT = 6;    // Series 1..6
export const LAST_ART_SERIES  = HONORARY_SERIES + ART_SERIES_COUNT; // 6

// 6 (honorary) + 6 × 69 = 420
export const TOTAL_CAP = HONORARY_CAP + ART_SERIES_CAP * ART_SERIES_COUNT;

export function isHonorary(series) {
  return Number(series) === HONORARY_SERIES;
}

export function capForSeries(series) {
  return isHonorary(series) ? HONORARY_CAP : ART_SERIES_CAP;
}

/**
 * @param {number} series
 * @returns {{key:string,label:string,short:string,roman:string}}
 */
export function seriesLabel(series) {
  if (isHonorary(series)) {
    return { key: 'honorary', label: 'Honorary', short: 'HON', roman: '0' };
  }
  return {
    key: `s${series}`,
    label: `Series ${toRoman(series)}`,
    short: `S${toRoman(series)}`,
    roman: toRoman(series),
  };
}

function toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let out = ''; let x = Number(n) || 0;
  for (let i = 0; i < vals.length; i++) {
    while (x >= vals[i]) { out += syms[i]; x -= vals[i]; }
  }
  return out || '0';
}
