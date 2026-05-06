import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { handle, platform } = body ?? {};

  if (!handle || typeof handle !== 'string') {
    return NextResponse.json({ error: 'Handle is required.' }, { status: 400 });
  }
  if (!['x', 'telegram'].includes(platform)) {
    return NextResponse.json({ error: 'Platform must be x or telegram.' }, { status: 400 });
  }

  // Sanitize: strip leading @, trim, enforce safe handle characters
  const clean = handle.trim().replace(/^@+/, '').slice(0, 50);
  if (!clean || !/^[a-zA-Z0-9_\.]{1,50}$/.test(clean)) {
    return NextResponse.json({ error: 'Invalid handle format.' }, { status: 400 });
  }

  const db = getDb();

  // Duplicate check (unique index on handle+platform also enforces this at DB level)
  const existing = db.prepare(
    'SELECT id FROM artist_applications WHERE handle = ? AND platform = ?'
  ).get(clean, platform);
  if (existing) {
    return NextResponse.json({ error: 'This handle is already in the queue.' }, { status: 409 });
  }

  db.prepare(
    'INSERT INTO artist_applications (handle, platform) VALUES (?, ?)'
  ).run(clean, platform);

  return NextResponse.json({ ok: true });
}
