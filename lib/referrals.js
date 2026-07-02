// lib/referrals.js — Fire Spread referral engine (Rewards Phase 2).
//
// ACCRUE-ONLY. This module records who referred whom (first-touch) and writes a
// 3% rebate LEDGER whenever a referee makes a real burn. It NEVER moves $CASH —
// paying out is a separate, money-moving phase (the claim rail). Every function
// is safe to call unconditionally; the SALUTE ROUTE gates the calls behind the
// `reward_referral` feature flag and wraps them so scoring/accrual can never
// block a confirmed on-chain salute.

import { signalTier } from './signalWeight.js';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Locked economy parameters (see docs/cash-rewards-economy.md §3 Rail 1).
export const REBATE_RATE = 0.03;          // 3% of the referee's burn
export const MIN_REFERRER_SCORE = 25;     // must be >= STEADY HAND to earn

// Monthly epoch tag, e.g. "2026-07". Used only to bucket accruals; the actual
// per-epoch pool math lives in the (future) claim rail.
export function currentEpoch(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// A referral code is either a raw SOL wallet or a torchbearer handle. Resolve it
// to the referrer's wallet — but ONLY if that wallet is a claimed torchbearer
// (has a genesis block). Returns null when it can't be resolved to a founder.
export function resolveReferrerWallet(db, rawCode) {
  const code = String(rawCode || '').trim().replace(/^@/, '');
  if (!code) return null;

  // Direct wallet code
  if (SOL_ADDR_RE.test(code)) {
    const row = db
      .prepare('SELECT sol_wallet FROM torchbearers WHERE sol_wallet = ? AND genesis_block IS NOT NULL')
      .get(code);
    return row ? row.sol_wallet : null;
  }

  // Handle code (case-insensitive)
  const row = db
    .prepare('SELECT sol_wallet FROM torchbearers WHERE lower(handle) = lower(?) AND genesis_block IS NOT NULL')
    .get(code);
  return row ? row.sol_wallet : null;
}

// First-touch attribution. Records referee → referrer exactly once (the PK on
// referee_wallet means a later ref link can't steal an already-attributed user).
// Guards: valid referee, resolvable founder referrer, and no self-referral.
// Returns the referrer wallet if a (new or existing) attribution stands, else null.
export function recordAttribution(db, { referee, code, source = '' } = {}) {
  if (!SOL_ADDR_RE.test(referee || '')) return null;

  const referrer = resolveReferrerWallet(db, code);
  if (!referrer) return null;
  if (referrer === referee) return null; // no self-referral

  db.prepare(
    `INSERT OR IGNORE INTO referrals (referee_wallet, referrer_wallet, code, source)
     VALUES (?, ?, ?, ?)`
  ).run(referee, referrer, String(code || '').trim().replace(/^@/, ''), String(source || ''));

  const row = db
    .prepare('SELECT referrer_wallet FROM referrals WHERE referee_wallet = ?')
    .get(referee);
  return row ? row.referrer_wallet : null;
}

// Whether a referrer may actually earn on a referee's burn RIGHT NOW:
//   • referrer is >= STEADY HAND (Signal Weight), and
//   • referee has claimed their own genesis block, and
//   • not a self-referral.
export function eligibleToEarn(db, referrerWallet, refereeWallet) {
  if (!referrerWallet || !refereeWallet || referrerWallet === refereeWallet) return false;

  const ts = db.prepare('SELECT score FROM trust_scores WHERE sol_wallet = ?').get(referrerWallet);
  const score = ts ? Number(ts.score || 0) : 0;
  if (signalTier(score).key === 'kindling' || score < MIN_REFERRER_SCORE) return false;

  const refereeTb = db
    .prepare('SELECT genesis_block FROM torchbearers WHERE sol_wallet = ?')
    .get(refereeWallet);
  return !!(refereeTb && refereeTb.genesis_block != null);
}

// Accrue the rebate for one confirmed salute. Idempotent on tx_sig. Writes a
// ledger row only when there IS an eligible referral behind this referee.
// Returns the accrued amount (0 when nothing accrued). Moves no money.
export function accrueForSalute(db, { refereeWallet, txSig, burnAmount, epoch } = {}) {
  if (!SOL_ADDR_RE.test(refereeWallet || '') || !txSig) return 0;

  const ref = db
    .prepare('SELECT referrer_wallet FROM referrals WHERE referee_wallet = ?')
    .get(refereeWallet);
  if (!ref) return 0;

  const referrer = ref.referrer_wallet;
  if (!eligibleToEarn(db, referrer, refereeWallet)) return 0;

  const burn = Number(burnAmount) || 0;
  if (burn <= 0) return 0;
  const rebate = burn * REBATE_RATE;

  db.prepare(
    `INSERT OR IGNORE INTO referral_accruals
       (referrer_wallet, referee_wallet, tx_sig, burn_amount, rebate_amount, epoch)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(referrer, refereeWallet, String(txSig), burn, rebate, epoch || currentEpoch());

  return rebate;
}

// Read a wallet's Fire Spread summary for their profile. Pure read.
// `accrued` is lifetime rebate credited (NOT yet claimable in Phase 2).
export function getReferralSummary(db, wallet) {
  if (!SOL_ADDR_RE.test(wallet || '')) return null;

  const tb = db
    .prepare('SELECT handle, genesis_block FROM torchbearers WHERE sol_wallet = ?')
    .get(wallet);
  const isFounder = !!(tb && tb.genesis_block != null);

  const referees = db
    .prepare('SELECT COUNT(*) AS n FROM referrals WHERE referrer_wallet = ?')
    .get(wallet);

  const accrued = db
    .prepare('SELECT COALESCE(SUM(rebate_amount), 0) AS total FROM referral_accruals WHERE referrer_wallet = ?')
    .get(wallet);

  const ts = db.prepare('SELECT score FROM trust_scores WHERE sol_wallet = ?').get(wallet);
  const score = ts ? Number(ts.score || 0) : 0;

  return {
    // The share code: prefer the handle, fall back to the wallet.
    code: tb && tb.handle ? tb.handle : wallet,
    isFounder,
    eligible: score >= MIN_REFERRER_SCORE,
    referees: Number(referees?.n || 0),
    accrued: Number(accrued?.total || 0),
  };
}
