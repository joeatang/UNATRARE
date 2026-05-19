/**
 * UNATRARE Brain — Shared Utilities
 * Common helpers used by all 8 judge brain modules.
 */

/**
 * Compute signal strength for a piece of text against a trigger list.
 * Returns { signal: 0-1, matched: string[] }
 */
export function signalStrength(text, triggers = []) {
  const lower = text.toLowerCase();
  const matched = triggers.filter(t => lower.includes(t.toLowerCase()));
  // Signal saturates at 1.0 after ~5 matched triggers
  return {
    signal: Math.min(1.0, matched.length / Math.max(3, triggers.length * 0.12)),
    matched,
  };
}

/**
 * Detect the dominant angle for a piece of text by scoring angle keyword clusters.
 * Returns the angle name with the highest match count, or 'general' if none.
 */
export function detectAngle(text, angles = {}) {
  const lower = text.toLowerCase();
  let best = 'general';
  let bestScore = 0;
  for (const [angle, keywords] of Object.entries(angles)) {
    const score = keywords.filter(k => lower.includes(k.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; best = angle; }
  }
  return best;
}

/**
 * Pick a random item from an array.
 */
export function pick(arr) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Minimum ms between responses for a single brain instance */
export const COOLDOWN_MS = 60_000;
