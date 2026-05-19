/**
 * Brain Functions — shared pattern for all UNATRARE judge brains.
 * Each judge's brain directory imports this exact pattern.
 * Scan, fulfill, log, sendTo, cooldown.
 */

import { signalStrength, detectAngle, pick, COOLDOWN_MS } from '../_shared.js';
import roleConfig from './roleConfig.js';

let lastResponseTime = 0;

/**
 * Scan text for signals that activate this judge's domain.
 * Returns scan result with signal strength, matched keywords, and dominant angle.
 * Used to: (1) enrich LLM prompts, (2) route topics, (3) drive template fallback.
 *
 * @param {string} text — topic instruction + context text
 * @param {object} [meta] — optional metadata (judgeId, topicId, etc.)
 * @returns {{ brain, signal, keywords, angle, summary }}
 */
export function scan(text, meta = {}) {
  const { signal, matched } = signalStrength(text, roleConfig.triggers);
  const angle = detectAngle(text, roleConfig.angles);

  return {
    brain: roleConfig.id,
    signal,
    keywords: matched,
    angle,
    summary: matched.length > 0
      ? `${roleConfig.title} activated on: ${matched.slice(0, 5).join(', ')} — angle: ${angle}`
      : `${roleConfig.title} — low resonance, angle: ${angle}`,
  };
}

/**
 * Generate a template-based response (no LLM required).
 * Used as fallback when Groq is unavailable or rate-limited.
 *
 * @param {string} text
 * @param {object} scanResult — output of scan()
 * @returns {string}
 */
export function fulfill(text, scanResult = {}) {
  const angle = scanResult.angle || 'general';
  const pool = roleConfig.templates[angle] || roleConfig.templates.general;
  return pick(pool);
}

/**
 * Log a scan/response event.
 */
export function log(event, data) {
  console.log(`[${roleConfig.id}] ${event}:`, JSON.stringify(data).slice(0, 200));
}

/**
 * Route a message to another brain.
 */
export function sendTo(targetBrain, text, meta = {}) {
  return { target: targetBrain, text, meta: { ...meta, from: roleConfig.id } };
}

/** Check if this brain instance is past its cooldown. */
export function isReady() {
  return Date.now() - lastResponseTime >= COOLDOWN_MS;
}

/** Mark that a response was just sent (resets cooldown). */
export function markResponded() {
  lastResponseTime = Date.now();
}
