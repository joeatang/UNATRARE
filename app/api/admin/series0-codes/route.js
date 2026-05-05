import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous O/0, I/1

function generateCode() {
  let code = 'S0-';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const codes = db.prepare('SELECT * FROM series0_codes ORDER BY created_at DESC').all();
  return NextResponse.json({ ok: true, codes });
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const note = String(body.note || '').slice(0, 200);

  const db = getDb();
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
  } while (attempts < 20 && db.prepare('SELECT 1 FROM series0_codes WHERE code=?').get(code));

  db.prepare('INSERT INTO series0_codes (code, note) VALUES (?, ?)').run(code, note);
  return NextResponse.json({ ok: true, code });
}

export async function DELETE(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { code } = body || {};
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const db = getDb();
  const existing = db.prepare('SELECT * FROM series0_codes WHERE code=?').get(code);
  if (!existing) return NextResponse.json({ error: 'code not found' }, { status: 404 });
  if (existing.used_by) {
    return NextResponse.json({ error: 'code already used — cannot revoke' }, { status: 409 });
  }

  db.prepare('DELETE FROM series0_codes WHERE code=?').run(code);
  return NextResponse.json({ ok: true });
}
