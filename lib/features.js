// lib/features.js — the ONE switchboard for the $CASH reward economy.
//
// WHY THIS EXISTS (read this if you're not a dev):
// Every reward feature is OFF by default and can ONLY be turned on deliberately.
// There is no other way to enable one. This is what makes building in the open
// safe: new code ships to production completely dark, and the live experience
// changes the *moment you flip a switch* — not a second before.
//
// A feature is ON only if EITHER:
//   1. the settings table has a row  feature:<name> = '1'
//      (instant — toggle it from the admin panel, no SSH, no redeploy), OR
//   2. the env var <ENV> = '1'
//      (a "dark launch" fallback for testing before the toggle exists)
// An explicit '0' in the settings table ALWAYS wins (hard OFF, even over env).
// Anything else = OFF. An unknown feature name = OFF (fail-closed).
//
// SERVER-SIDE ONLY (it reads the database). In the UI, check the flag inside a
// server component and pass a plain boolean down to client components.

import { getDb } from './db';

// The complete, explicit list of reward-economy features. Nothing outside this
// registry can be toggled. `money: true` marks the rails where real $CASH moves
// — treat those with extra care (canary + tiny pool before widening).
export const FEATURES = {
  reward_badges:   { env: 'FEATURE_REWARD_BADGES',   money: false, label: 'Identity badges — status travels site-wide (visual only)' },
  reward_referral: { env: 'FEATURE_REWARD_REFERRAL', money: false, label: 'Fire Spread — referral accrual (accrues only, no payout)' },
  reward_claim:    { env: 'FEATURE_REWARD_CLAIM',    money: true,  label: 'Pull-based $CASH claim rail — MONEY MOVES' },
  reward_activity: { env: 'FEATURE_REWARD_ACTIVITY', money: false, label: 'Bitcoin-activity earning + bonus windows' },
  reward_grants:   { env: 'FEATURE_REWARD_GRANTS',   money: true,  label: 'Artist milestone grants — MONEY MOVES' },
  reward_tip:      { env: 'FEATURE_REWARD_TIP',      money: true,  label: 'Optional tip / top-up rail — MONEY MOVES' },
};

export function isFeatureName(name) {
  return Object.prototype.hasOwnProperty.call(FEATURES, name);
}

// Read a settings row. Any failure (DB missing, table absent) → null, which
// makes the caller fall back to env, which defaults to OFF. Never throws.
function readSetting(key) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? String(row.value) : null;
  } catch {
    return null;
  }
}

// The one function the rest of the app uses. Returns true ONLY when a feature
// has been explicitly turned on. Safe to call anywhere server-side.
export function featureEnabled(name) {
  if (!isFeatureName(name)) return false;              // unknown = OFF (fail-closed)
  const dbVal = readSetting(`feature:${name}`);
  if (dbVal === '0') return false;                     // explicit hard OFF always wins
  if (dbVal === '1') return true;                      // explicit ON (instant toggle)
  return process.env[FEATURES[name].env] === '1';      // dark-launch fallback, else OFF
}

// Flip a feature on/off in the DB (used by the admin toggle). Instant.
export function setFeature(name, on) {
  if (!isFeatureName(name)) throw new Error(`unknown feature: ${name}`);
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(`feature:${name}`, on ? '1' : '0');
  return featureEnabled(name);
}

// Full status of every feature — powers the admin panel + any status view.
export function allFeatureStates() {
  return Object.entries(FEATURES).map(([name, def]) => {
    const dbVal = readSetting(`feature:${name}`);
    let on = false;
    let source = 'default-off';
    if (dbVal === '1') { on = true; source = 'settings'; }
    else if (dbVal === '0') { on = false; source = 'settings'; }
    else if (process.env[def.env] === '1') { on = true; source = 'env'; }
    return { name, label: def.label, money: def.money, on, source };
  });
}
