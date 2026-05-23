import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route.js';

/**
 * GET /api/admin/tg-export
 * Downloads all Telegram community registrations as CSV.
 * Requires: Authorization: Bearer <ADMIN_SECRET>
 */

function toISODate(unixSec) {
  if (!unixSec) return '';
  return new Date(unixSec * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request) {
  // ── Auth ──────────────────────────────────────────────────────
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ── Query ─────────────────────────────────────────────────────
  const db   = getDb();
  const rows = db.prepare(`
    SELECT telegram_id, telegram_username, cp_address, registered_at, updated_at
    FROM tg_registrations
    ORDER BY registered_at ASC
  `).all();

  // ── Build CSV ─────────────────────────────────────────────────
  const header = ['telegram_id', 'telegram_username', 'cp_address', 'registered_at', 'updated_at'];
  const lines  = [
    header.join(','),
    ...rows.map(r => [
      csvEscape(r.telegram_id),
      csvEscape(r.telegram_username),
      csvEscape(r.cp_address),
      csvEscape(toISODate(r.registered_at)),
      csvEscape(toISODate(r.updated_at)),
    ].join(',')),
  ];

  const csv = lines.join('\r\n');
  const filename = `tg-registrations-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
