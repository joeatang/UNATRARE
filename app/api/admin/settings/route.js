import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

const ALLOWED_KEYS = ['early_access_mode'];

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return NextResponse.json({ ok: true, settings });
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { key, value } = body || {};
  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 });
  }
  if (value === undefined || value === null) {
    return NextResponse.json({ error: 'value required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  return NextResponse.json({ ok: true, key, value: String(value) });
}
