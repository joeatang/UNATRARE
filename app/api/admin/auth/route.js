import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Simple stateless token: HMAC-SHA256(password + day) — expires at midnight UTC
function makeToken(password) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return crypto
    .createHmac('sha256', process.env.ADMIN_SECRET || 'changeme')
    .update(`${password}:${day}`)
    .digest('hex');
}

export function verifyAdminToken(request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace('Bearer ', '').trim();
  if (!token) return false;
  try {
    const expected = makeToken(process.env.ADMIN_PASSWORD || '');
    // timingSafeEqual requires identical buffer lengths
    const a = Buffer.from(token.padEnd(64, '\0').slice(0, 64));
    const b = Buffer.from(expected.padEnd(64, '\0').slice(0, 64));
    return token.length === expected.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'ADMIN_PASSWORD not set' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const { password } = body;
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing password' }, { status: 400 });
  }

  // Constant-time compare
  const correct = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(128, '\0')),
    Buffer.from(ADMIN_PASSWORD.padEnd(128, '\0'))
  );

  if (!correct) {
    return NextResponse.json({ ok: false, error: 'invalid password' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, token: makeToken(password) });
}
