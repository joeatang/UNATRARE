import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const card = (searchParams.get('card') || '').toUpperCase().trim();
  const pageRaw = Number(searchParams.get('page') || 1);
  const limitRaw = Number(searchParams.get('limit') || 50);

  if (!card) {
    return NextResponse.json({ error: 'card required' }, { status: 400 });
  }

  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;
  const offset = (page - 1) * limit;

  const db = getDb();

  const cardExists = db.prepare(
    "SELECT token_name, display_title, artist_handle FROM tokens WHERE token_name = ? AND status = 'approved'"
  ).get(card);
  if (!cardExists) {
    return NextResponse.json({ error: 'card not found or not certified' }, { status: 404 });
  }

  const rows = db.prepare(`
    SELECT
      id,
      sol_wallet,
      amount_display,
      amount_raw,
      decimals,
      tx_sig,
      burned_at
    FROM card_salutes
    WHERE card_name = ?
    ORDER BY burned_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(card, limit, offset);

  const totals = db.prepare(`
    SELECT
      SUM(amount_display) AS total_burned,
      COUNT(*) AS burn_count,
      COUNT(DISTINCT sol_wallet) AS unique_burners
    FROM card_salutes
    WHERE card_name = ?
  `).get(card);

  const countRow = db.prepare('SELECT COUNT(*) AS n FROM card_salutes WHERE card_name = ?').get(card);
  const totalRows = countRow?.n ?? 0;

  return NextResponse.json({
    card,
    displayTitle: cardExists.display_title || card,
    artistHandle: cardExists.artist_handle || '',
    page,
    limit,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / limit)),
    totals: {
      totalBurned: totals?.total_burned ?? 0,
      burnCount: totals?.burn_count ?? 0,
      uniqueBurners: totals?.unique_burners ?? 0,
    },
    history: rows,
  });
}
