import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

export const dynamic = 'force-dynamic';

const WINDOW_SECONDS = {
  all: null,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
  '48h': 48 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
};

function parseWindow(raw) {
  const key = String(raw || '24h').toLowerCase();
  if (!(key in WINDOW_SECONDS)) return '24h';
  return key;
}

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

function eventSeverity(event) {
  switch (event) {
    case 'split_ratio_mismatch':
      return 'high';
    case 'split_missing_artist_leg':
    case 'split_missing_artist_address':
      return 'medium';
    default:
      return 'low';
  }
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
  const windowKey = parseWindow(searchParams.get('window'));
  const now = Math.floor(Date.now() / 1000);
  const since = WINDOW_SECONDS[windowKey] == null ? null : now - WINDOW_SECONDS[windowKey];

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
  if (since != null) {
    whereParts.push('created_at >= ?');
    whereParams.push(since);
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

  const rowsWithSeverity = rows.map(r => ({ ...r, severity: eventSeverity(r.event) }));
  const severityCounts = rowsWithSeverity.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });

  return NextResponse.json({
    ok: true,
    filters: {
      splitOnly,
      event,
      card,
      wallet,
      txSig,
      limit,
      window: windowKey,
      since,
      now,
    },
    severityCounts,
    counts,
    rows: rowsWithSeverity,
  });
}
