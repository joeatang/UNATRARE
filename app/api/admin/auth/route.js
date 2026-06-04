import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Hard fail-closed: refuse to issue or validate tokens unless both secrets are set.
// Prevents the historical 'changeme' / empty-password fallback from silently allowing
// admin-token forgery if secrets ever go missing on a future deploy.
function getSecrets() {
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SECRET || '';
  if (!password || password.length < 8) {
    throw new Error('ADMIN_PASSWORD missing or too short (min 8 chars). Set it in .env / .env.local and restart.');
  }
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SECRET missing or too short (min 16 chars). Set it in .env / .env.local and restart.');
  }
  return { password, secret };
}

// Simple stateless token: HMAC-SHA256(password + day) — expires at midnight UTC
export function makeToken(password) {
  const { secret } = getSecrets();
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return crypto
    .createHmac('sha256', secret)
    .update(`${password}:${day}`)
    .digest('hex');
}

export function verifyAdminToken(request) {
  let password;
  try {
    ({ password } = getSecrets());
  } catch {
    return false; // secrets missing → reject all tokens
  }
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace('Bearer ', '').trim();
  if (!token) return false;
  try {
    const expected = makeToken(password);
    if (token.length !== expected.length) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request) {
  let password;
  try {
    ({ password } = getSecrets());
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const { password: submitted } = body || {};
  if (!submitted || typeof submitted !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing password' }, { status: 400 });
  }

  // Constant-time compare (pad both to a fixed length to avoid leaking length)
  const correct = submitted.length === password.length && crypto.timingSafeEqual(
    Buffer.from(submitted.padEnd(128, '\0')),
    Buffer.from(password.padEnd(128, '\0'))
  );

  if (!correct) {
    return NextResponse.json({ ok: false, error: 'invalid password' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, token: makeToken(password) });
}
