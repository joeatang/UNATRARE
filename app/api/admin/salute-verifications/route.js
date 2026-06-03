import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

export const dynamic = 'force-dynamic';

function parseLimit(raw) {
  const n = Number(raw || 100);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

function cleanUpper(raw) {
  return String(raw || '').trim().toUpperCase();
}

function clean(raw) {
  return String(raw || '').trim();
}

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get('limit'));
  const splitOnly = searchParams.get('split_only') !== '0';
  const event = clean(searchParams.get('event'));
  const card = cleanUpper(searchParams.get('card'));
  const wallet = clean(searchParams.get('wallet'));
  const txSig = clean(searchParams.get('tx_sig'));

  const whereParts = [];
  const whereParams = [];

  if (splitOnly) {
    whereParts.push("event LIKE 'split_%'");
  }
  if (event) {
    whereParts.push('event = ?');
    whereParams.push(event);
  }
  if (card) {
    whereParts.push('card_name = ?');
    whereParams.push(card);
  }
  if (wallet) {
    whereParts.push('sol_wallet = ?');
    whereParams.push(wallet);
  }
  if (txSig) {
    whereParts.push('tx_sig = ?');
    whereParams.push(txSig);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      id,
      event,
      card_name,
      sol_wallet,
      tx_sig,
      amount_display,
      message,
      created_at
    FROM salute_verifications
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(...whereParams, limit);

  const counts = db.prepare(`
    SELECT event, COUNT(*) AS n
    FROM salute_verifications
    ${whereSql}
    GROUP BY event
    ORDER BY n DESC, event ASC
    LIMIT 50
  `).all(...whereParams);

  return NextResponse.json({
    ok: true,
    filters: {
      splitOnly,
      event,
      card,
      wallet,
      txSig,
      limit,
    },
    counts,
    rows,
  });
}
