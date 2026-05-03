import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { validateTokenName } from '../../../../lib/tokenValidator';

export async function GET(request, { params }) {
  const { name } = await params;
  const { valid, normalized } = validateTokenName(name ?? '');
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid token name' }, { status: 400 });
  }

  try {
    const db = getDb();
    const token = db.prepare(
      `SELECT status, rejection_reason, judge_score, series, card_number,
              artist_address, payment_txid, payment_currency
       FROM tokens WHERE token_name = ?`
    ).get(normalized);

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      tokenName: normalized,
      status: token.status,
      rejectionReason: token.rejection_reason || null,
      judgeScore: token.judge_score,
      series: token.series,
      cardNumber: token.card_number,
      artistAddress: token.artist_address,
      paymentTxid: token.payment_txid || null,
      paymentCurrency: token.payment_currency || null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
