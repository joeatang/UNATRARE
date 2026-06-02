import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import { notifyCeremonyOpen, notifyCeremonyClose } from '../../../../lib/telegram';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['draft', 'scheduled', 'active', 'closed', 'archived']);
const POLICY = {
  enforceWindow: process.env.SALUTE_ENFORCE_CEREMONY_WINDOW === '1',
  strictConfiguredOnly: process.env.SALUTE_ENFORCE_CEREMONY_STRICT === '1',
};

function normalizeCardName(v) {
  return (v || '').toUpperCase().trim();
}

function isValidCardName(v) {
  return /^[A-Z][A-Z0-9.]{0,49}$/.test(v || '');
}

function parseUnix(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || '').toLowerCase().trim();
  const card = normalizeCardName(searchParams.get('card') || '');
  const db = getDb();

  if (card) {
    const row = db.prepare(`
      SELECT c.*, t.display_title, t.artist_handle
      FROM salute_ceremonies c
      LEFT JOIN tokens t ON t.token_name = c.card_name
      WHERE c.card_name = ?
      LIMIT 1
    `).get(card);
    return NextResponse.json({ ok: true, ceremony: row || null, policy: POLICY });
  }

  const where = status && VALID_STATUSES.has(status) ? 'WHERE c.status = ?' : '';
  const rows = db.prepare(`
    SELECT c.*, t.display_title, t.artist_handle
    FROM salute_ceremonies c
    LEFT JOIN tokens t ON t.token_name = c.card_name
    ${where}
    ORDER BY c.updated_at DESC, c.id DESC
    LIMIT 500
  `).all(...(where ? [status] : []));

  return NextResponse.json({ ok: true, ceremonies: rows, policy: POLICY });
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const action = (body?.action || '').toLowerCase().trim();
  const cardName = normalizeCardName(body?.card_name || '');
  if (!action) {
    return NextResponse.json({ error: 'action required' }, { status: 422 });
  }
  if (!cardName || !isValidCardName(cardName)) {
    return NextResponse.json({ error: 'valid card_name required' }, { status: 422 });
  }

  const db = getDb();
  const token = db.prepare("SELECT token_name FROM tokens WHERE token_name = ? AND status = 'approved'").get(cardName);
  if (!token) {
    return NextResponse.json({ error: 'card not found or not certified' }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);
  const headline = String(body?.headline || '').trim();
  const subtitle = String(body?.subtitle || '').trim();
  const themeKey = String(body?.theme_key || 'ember').trim() || 'ember';
  const startsAt = parseUnix(body?.starts_at);
  const endsAt = parseUnix(body?.ends_at);

  const existing = db.prepare('SELECT id FROM salute_ceremonies WHERE card_name = ?').get(cardName);

  if (action === 'upsert') {
    const nextStatus = VALID_STATUSES.has((body?.status || '').toLowerCase())
      ? String(body.status).toLowerCase()
      : (existing ? 'draft' : 'draft');

    if (startsAt != null && endsAt != null && endsAt <= startsAt) {
      return NextResponse.json({ error: 'ends_at must be greater than starts_at' }, { status: 422 });
    }

    if (existing) {
      db.prepare(`
        UPDATE salute_ceremonies
        SET headline = ?, subtitle = ?, theme_key = ?, status = ?, starts_at = ?, ends_at = ?, updated_at = ?
        WHERE card_name = ?
      `).run(headline, subtitle, themeKey, nextStatus, startsAt, endsAt, now, cardName);
    } else {
      db.prepare(`
        INSERT INTO salute_ceremonies (
          card_name, headline, subtitle, theme_key, status, starts_at, ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cardName, headline, subtitle, themeKey, nextStatus, startsAt, endsAt, now, now);
    }

    const ceremony = db.prepare('SELECT * FROM salute_ceremonies WHERE card_name = ?').get(cardName);
    return NextResponse.json({ ok: true, ceremony });
  }

  if (action === 'activate') {
    if (POLICY.strictConfiguredOnly && !existing) {
      return NextResponse.json(
        { error: 'strict mode requires an existing ceremony row before activation' },
        { status: 422 },
      );
    }

    const effectiveStart = startsAt ?? now;
    const effectiveEnd = endsAt ?? (effectiveStart + 48 * 60 * 60);
    if (effectiveEnd <= effectiveStart) {
      return NextResponse.json({ error: 'ends_at must be greater than starts_at' }, { status: 422 });
    }

    if (existing) {
      db.prepare(`
        UPDATE salute_ceremonies
        SET status = 'active',
            starts_at = ?,
            ends_at = ?,
            headline = COALESCE(NULLIF(?, ''), headline),
            subtitle = COALESCE(NULLIF(?, ''), subtitle),
            theme_key = COALESCE(NULLIF(?, ''), theme_key),
            updated_at = ?
        WHERE card_name = ?
      `).run(effectiveStart, effectiveEnd, headline, subtitle, themeKey, now, cardName);
    } else {
      db.prepare(`
        INSERT INTO salute_ceremonies (
          card_name, headline, subtitle, theme_key, status, starts_at, ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(
        cardName,
        headline || 'Burn to Salute',
        subtitle || 'Voluntary community ritual · proof of appreciation',
        themeKey,
        effectiveStart,
        effectiveEnd,
        now,
        now,
      );
    }

    const ceremony = db.prepare('SELECT * FROM salute_ceremonies WHERE card_name = ?').get(cardName);
    try {
      const tokenRow = db.prepare(
        'SELECT token_name, display_title, art_url, artist_handle, artist_address FROM tokens WHERE token_name = ?'
      ).get(cardName);
      if (tokenRow) notifyCeremonyOpen(tokenRow, ceremony);
    } catch {}
    return NextResponse.json({ ok: true, ceremony });
  }

  if (action === 'close' || action === 'archive' || action === 'draft') {
    const targetStatus = action === 'archive' ? 'archived' : action;
    db.prepare(`
      UPDATE salute_ceremonies
      SET status = ?, updated_at = ?
      WHERE card_name = ?
    `).run(targetStatus, now, cardName);

    const ceremony = db.prepare('SELECT * FROM salute_ceremonies WHERE card_name = ?').get(cardName);
    if (action === 'close') {
      try {
        const tokenRow = db.prepare(
          'SELECT token_name, display_title, art_url, artist_handle, artist_address FROM tokens WHERE token_name = ?'
        ).get(cardName);
        const summary = db.prepare(`
          SELECT COALESCE(SUM(amount_display),0) AS total,
                 COUNT(DISTINCT sol_wallet)      AS burners
          FROM card_salutes WHERE card_name = ?
        `).get(cardName);
        const topRow = db.prepare(`
          SELECT sol_wallet FROM card_salutes WHERE card_name = ?
          GROUP BY sol_wallet ORDER BY SUM(amount_display) DESC LIMIT 1
        `).get(cardName);
        if (tokenRow) notifyCeremonyClose(tokenRow, {
          totalBurned: summary?.total ?? 0,
          uniqueBurners: summary?.burners ?? 0,
          topWallet: topRow?.sol_wallet || null,
        });
      } catch {}
    }
    return NextResponse.json({ ok: true, ceremony });
  }

  return NextResponse.json({ error: `unknown action: ${action}` }, { status: 422 });
}
