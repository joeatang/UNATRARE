// POST /api/cash-burn/contribute
// Public endpoint — community wallets call this AFTER signing a $CASH burn
// during an active ceremony's open window. We:
//   1. Verify the tx is a real confirmed $CASH burn signed by sol_wallet
//   2. Confirm the ceremony is active (or, on race, the burn happened before close)
//   3. Reject if tx_sig already attributed to a card_salute or another contribution
//   4. Enforce the 69 $CASH floor
//   5. Insert the contribution row
//
// No custody, no signing on our side — the burn already happened on-chain.

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyCashBurn } from '../../../../lib/solanaBurnVerify';

export const dynamic = 'force-dynamic';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

// Culture-coded minimum. Keeps dust-spam off the leaderboard.
const MIN_CONTRIBUTION_DISPLAY = 69;

// Burn must have landed on-chain no more than 30s after admin closed the
// ceremony for it to still count. Generous race-condition tolerance.
const POST_CLOSE_GRACE_SECONDS = 30;

const RATE_WINDOW_MS = Number(process.env.SALUTE_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_PER_IP = Number(process.env.SALUTE_RATE_LIMIT_PER_IP || 20);
const RATE_LIMIT_PER_WALLET = Number(process.env.SALUTE_RATE_LIMIT_PER_WALLET || 10);

function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip') || '';
  return first || real || 'unknown';
}

function registerRateHit(db, scope, key, windowMs) {
  const id = key || 'unknown';
  const bucket = Math.floor(Date.now() / windowMs) * windowMs;
  const row = db.prepare(`
    INSERT INTO rate_limit_counters (scope, key, window_start, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(scope, key, window_start) DO UPDATE SET count = count + 1
    RETURNING count
  `).get(scope, id, bucket);
  return row?.count ?? 1;
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const ceremonyId = Number(body?.cash_burn_id ?? body?.ceremony_id);
  const sol_wallet = String(body?.sol_wallet || '').trim();
  const tx_sig     = String(body?.tx_sig || '').trim();

  if (!Number.isInteger(ceremonyId) || ceremonyId <= 0) {
    return NextResponse.json({ error: 'cash_burn_id required' }, { status: 400 });
  }
  if (!SOL_ADDR_RE.test(sol_wallet)) {
    return NextResponse.json({ error: 'invalid sol_wallet' }, { status: 400 });
  }
  if (!SOL_SIG_RE.test(tx_sig)) {
    return NextResponse.json({ error: 'invalid tx_sig' }, { status: 400 });
  }

  const db = getDb();
  const clientIp = getClientIp(request);
  if (registerRateHit(db, 'ip', clientIp, RATE_WINDOW_MS) > RATE_LIMIT_PER_IP) {
    return NextResponse.json({ error: 'too many requests — try again shortly' }, { status: 429 });
  }
  if (registerRateHit(db, 'wallet', sol_wallet, RATE_WINDOW_MS) > RATE_LIMIT_PER_WALLET) {
    return NextResponse.json({ error: 'too many attempts for this wallet — try again shortly' }, { status: 429 });
  }

  // Ceremony must exist + be active (or recently closed within grace window).
  const ceremony = db.prepare('SELECT id, ordinal, status, closed_at FROM cash_burns WHERE id = ?').get(ceremonyId);
  if (!ceremony) {
    return NextResponse.json({ error: 'ceremony not found' }, { status: 404 });
  }
  if (ceremony.status === 'archived') {
    return NextResponse.json({ error: 'ceremony has been archived' }, { status: 410 });
  }

  // Cross-table tx_sig dedupe — a burn can't be claimed for both a card salute
  // AND a ceremony, and can't be claimed twice for the same ceremony.
  const dupContrib = db.prepare('SELECT id, cash_burn_id, ordinal FROM cash_burn_contributions WHERE tx_sig = ?').get(tx_sig);
  if (dupContrib) {
    return NextResponse.json({
      error: `this transaction was already counted toward ceremony #${String(dupContrib.ordinal).padStart(3, '0')}`,
      cash_burn_id: dupContrib.cash_burn_id,
    }, { status: 409 });
  }
  const dupSalute = db.prepare('SELECT id, card_name FROM card_salutes WHERE tx_sig = ?').get(tx_sig);
  if (dupSalute) {
    return NextResponse.json({
      error: `this transaction was already recorded as a salute on ${dupSalute.card_name}`,
    }, { status: 409 });
  }
  const dupAdmin = db.prepare('SELECT id, ordinal FROM cash_burns WHERE tx_sig = ?').get(tx_sig);
  if (dupAdmin) {
    return NextResponse.json({
      error: `this transaction is the seed burn for ceremony #${String(dupAdmin.ordinal).padStart(3, '0')}`,
    }, { status: 409 });
  }

  // Verify the burn on-chain.
  let burnInfo;
  try {
    burnInfo = await verifyCashBurn(tx_sig, sol_wallet);
  } catch (err) {
    return NextResponse.json({ error: `on-chain verification failed: ${err.message}` }, { status: 422 });
  }
  if (!burnInfo) {
    return NextResponse.json({
      error: 'transaction is not a confirmed $CASH burn authorized by this wallet',
    }, { status: 422 });
  }

  if (burnInfo.displayAmount < MIN_CONTRIBUTION_DISPLAY) {
    return NextResponse.json({
      error: `minimum contribution is ${MIN_CONTRIBUTION_DISPLAY} $CASH (this tx burned ${burnInfo.displayAmount.toFixed(2)})`,
    }, { status: 422 });
  }

  // Race: if ceremony is already closed, accept only if the on-chain burn
  // landed before the close (with a short grace window for clock skew).
  if (ceremony.status !== 'active') {
    const closedAt = Number(ceremony.closed_at || 0);
    const blockTime = Number(burnInfo.blockTime || 0);
    if (!blockTime || blockTime > closedAt + POST_CLOSE_GRACE_SECONDS) {
      return NextResponse.json({
        error: 'this ceremony has closed — your burn was not counted toward it',
      }, { status: 409 });
    }
  }

  const burnedAt = Number(burnInfo.blockTime || Math.floor(Date.now() / 1000));

  try {
    db.prepare(`
      INSERT INTO cash_burn_contributions
        (cash_burn_id, ordinal, sol_wallet, amount_raw, amount_display, decimals, tx_sig, burned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ceremony.id,
      ceremony.ordinal,
      sol_wallet,
      burnInfo.rawAmount,
      burnInfo.displayAmount,
      burnInfo.decimals,
      tx_sig,
      burnedAt,
    );
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) {
      return NextResponse.json({ error: 'this transaction was already recorded' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({
    ok: true,
    cash_burn_id: ceremony.id,
    ordinal:      ceremony.ordinal,
    amount:       burnInfo.displayAmount,
    tx_sig,
  });
}
