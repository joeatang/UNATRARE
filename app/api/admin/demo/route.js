import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import { judgeToken } from '../../../../lib/judge';

// GET: list all demo cards
export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const db = getDb();
    const tokens = db.prepare(
      `SELECT token_name, display_title, artist_handle, art_url, judge_score, status, judged_at
       FROM tokens WHERE is_demo = 1 ORDER BY judged_at DESC`
    ).all();
    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { tokenName, artUrl, artMime, artistHandle, description } = body;

  if (!tokenName || typeof tokenName !== 'string') {
    return NextResponse.json({ error: 'tokenName required' }, { status: 400 });
  }
  if (!artUrl || typeof artUrl !== 'string') {
    return NextResponse.json({ error: 'artUrl required' }, { status: 400 });
  }

  const name = tokenName.toUpperCase().trim();
  const mime = artMime || 'image/png';
  const handle = artistHandle ? String(artistHandle).trim() : 'demo_artist';
  const desc = description ? String(description).trim() : 'Demo sample card for testing.';

  const db = getDb();

  // Check for existing token with this name
  const existing = db.prepare('SELECT token_name FROM tokens WHERE token_name = ?').get(name);
  if (existing) {
    return NextResponse.json({ error: 'token name already exists' }, { status: 409 });
  }

  try {
    // Insert demo card as pre-approved with is_demo=1
    db.prepare(`
      INSERT INTO tokens (
        token_name, display_title, artist_address, artist_handle,
        description, status, series, card_number,
        art_url, art_mime, submitted_at, judged_at, revealed_at,
        supply, is_demo
      ) VALUES (
        ?, ?, '1DEMO000000000000000000000000000000', ?,
        ?, 'approved', 0, 0,
        ?, ?, unixepoch(), unixepoch(), unixepoch(),
        0, 1
      )
    `).run(name, name, handle, desc, artUrl, mime);

    // Run judge pipeline so it gets real AI scores
    let judgeResult = null;
    try {
      judgeResult = await judgeToken(name);
    } catch (err) {
      // Judge failure is non-fatal for demo cards
      judgeResult = { error: err.message };
    }

    return NextResponse.json({ ok: true, tokenName: name, judgeResult });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: purge a demo card
export async function DELETE(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { tokenName } = body;
  if (!tokenName) {
    return NextResponse.json({ error: 'tokenName required' }, { status: 400 });
  }

  const name = tokenName.toUpperCase().trim();
  const db = getDb();

  const token = db.prepare('SELECT is_demo FROM tokens WHERE token_name = ?').get(name);
  if (!token) {
    return NextResponse.json({ error: 'token not found' }, { status: 404 });
  }
  if (!token.is_demo) {
    return NextResponse.json({ error: 'cannot delete non-demo tokens via this endpoint' }, { status: 403 });
  }

  db.prepare('DELETE FROM tokens WHERE token_name = ?').run(name);
  return NextResponse.json({ ok: true, purged: name });
}
