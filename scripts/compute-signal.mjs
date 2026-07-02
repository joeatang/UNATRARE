#!/usr/bin/env node
// Recompute Signal Weight (Phase 5) for every wallet. Cron-friendly: run on a
// schedule on the host, or manually. Reads/writes the same DB the app uses.
//
//   node scripts/compute-signal.mjs
//
import { computeSignalWeights, signalTier } from '../lib/signalWeight.js';
import { getDb } from '../lib/db.js';

try {
  const { wallets, ms } = computeSignalWeights();
  const db = getDb();
  const top = db.prepare('SELECT sol_wallet, score FROM trust_scores ORDER BY score DESC LIMIT 5').all();
  const stamp = new Date().toISOString();
  console.log(`[signal] ${stamp} recomputed ${wallets} wallet(s) in ${ms}ms`);
  for (const r of top) {
    console.log(`[signal]   ${r.sol_wallet.slice(0, 4)}…${r.sol_wallet.slice(-4)}  ${r.score}  ${signalTier(r.score).label}`);
  }
  process.exit(0);
} catch (err) {
  console.error('[signal] FAILED:', err.message);
  process.exit(1);
}
