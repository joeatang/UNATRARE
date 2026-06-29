/**
 * POST /api/admin/salute-announce
 *
 * Manually re-fire a Telegram salute announcement for an already-recorded burn.
 * Useful for historical salutes that landed before auto-notify was wired,
 * or to re-broadcast a signature moment.
 *
 * Body: { card_name, tx_sig? }
 *   - tx_sig optional. Without it, the most recent salute on the card is used.
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import { notifySalute } from '../../../../lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const cardName = String(body?.card_name || '').toUpperCase().trim();
  const txSig = String(body?.tx_sig || '').trim();
  if (!cardName) return NextResponse.json({ error: 'card_name required' }, { status: 422 });

  const db = getDb();
  const tokenRow = db.prepare(
    'SELECT token_name, display_title, art_url, art_mime, art_cover_url, artist_handle, artist_address, council_certified, revealed_at FROM tokens WHERE token_name = ?'
  ).get(cardName);
  if (!tokenRow) return NextResponse.json({ error: 'card not found' }, { status: 404 });

  const salute = txSig
    ? db.prepare(
        'SELECT sol_wallet, amount_display, tx_sig FROM card_salutes WHERE card_name = ? AND tx_sig = ?'
      ).get(cardName, txSig)
    : db.prepare(
        'SELECT sol_wallet, amount_display, tx_sig FROM card_salutes WHERE card_name = ? ORDER BY burned_at DESC LIMIT 1'
      ).get(cardName);

  if (!salute) return NextResponse.json({ error: 'no salute found for this card' }, { status: 404 });

  const totals = db.prepare(
    'SELECT COUNT(*) AS n, COALESCE(SUM(amount_display),0) AS total FROM card_salutes WHERE card_name = ?'
  ).get(cardName);

  try {
    await notifySalute(tokenRow, salute, {
      isFirst: (totals?.n ?? 1) === 1,
      cardTotal: totals?.total ?? salute.amount_display,
    });
  } catch (err) {
    return NextResponse.json({ error: `telegram failed: ${err.message}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    card_name: cardName,
    tx_sig: salute.tx_sig,
    amount_display: salute.amount_display,
  });
}
