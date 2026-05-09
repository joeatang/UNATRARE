import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

// Public self-service artist profile endpoint.
// No admin auth required — but the BTC address must have at least one token
// submission in the DB, so random wallets can't create phantom profiles.

// GET — load existing profile + submissions for a given address
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim();
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  try {
    const db = getDb();

    // Must have at least one submission to claim a profile
    const submissionCount = db.prepare(
      'SELECT COUNT(*) as n FROM tokens WHERE artist_address = ? OR owner_address = ?'
    ).get(address, address)?.n ?? 0;

    if (submissionCount === 0) {
      return NextResponse.json({ error: 'no_submissions' }, { status: 404 });
    }

    const profile = db.prepare('SELECT * FROM artists WHERE btc_address = ?').get(address) || null;

    // Pull handle from tokens as fallback
    const handleRow = db.prepare(
      "SELECT artist_handle FROM tokens WHERE (artist_address = ? OR owner_address = ?) AND artist_handle != '' LIMIT 1"
    ).get(address, address);

    // Return their approved token count so the page can show context
    const approvedCount = db.prepare(
      "SELECT COUNT(*) as n FROM tokens WHERE (artist_address = ? OR owner_address = ?) AND status = 'approved'"
    ).get(address, address)?.n ?? 0;

    return NextResponse.json({
      profile,
      handle_fallback: handleRow?.artist_handle || '',
      submission_count: submissionCount,
      approved_count: approvedCount,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — create or update an artist's own profile
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const {
    btc_address,
    alias       = '',
    anonymous   = 0,
    pfp_url     = '',
    bio         = '',
    website     = '',
    twitter_handle = '',
    past_projects  = '',
    cp_collections = '[]',
  } = body;

  if (!btc_address || typeof btc_address !== 'string') {
    return NextResponse.json({ error: 'btc_address required' }, { status: 400 });
  }

  // Security: address must have actual submissions — prevents arbitrary profile creation
  const db = getDb();
  const submissionCount = db.prepare(
    'SELECT COUNT(*) as n FROM tokens WHERE artist_address = ? OR owner_address = ?'
  ).get(btc_address, btc_address)?.n ?? 0;

  if (submissionCount === 0) {
    return NextResponse.json({ error: 'no_submissions' }, { status: 403 });
  }

  // Sanitise cp_collections
  let cpJson = '[]';
  if (cp_collections && cp_collections.trim()) {
    try {
      const parsed = JSON.parse(cp_collections);
      if (!Array.isArray(parsed)) throw new Error();
      cpJson = JSON.stringify(parsed);
    } catch {
      // Treat as newline-delimited list
      cpJson = JSON.stringify(
        cp_collections.split('\n').map(s => s.trim()).filter(Boolean)
      );
    }
  }

  // Sanitise website/pfp_url — must start with https:// or be empty
  const safeUrl = (u) => {
    if (!u || !u.trim()) return '';
    const trimmed = u.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : '';
  };

  try {
    // Auto-assign archive_index if this is a new artist
    const existing = db.prepare('SELECT archive_index FROM artists WHERE btc_address = ?').get(btc_address);
    let archiveIndex = existing?.archive_index ?? null;
    if (archiveIndex == null) {
      const maxRow = db.prepare('SELECT MAX(archive_index) as m FROM artists').get();
      archiveIndex = (maxRow?.m ?? 0) + 1;
    }

    db.prepare(`
      INSERT INTO artists (btc_address, alias, anonymous, pfp_url, bio, website, twitter_handle, past_projects, cp_collections, archive_index, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(btc_address) DO UPDATE SET
        alias           = excluded.alias,
        anonymous       = excluded.anonymous,
        pfp_url         = excluded.pfp_url,
        bio             = excluded.bio,
        website         = excluded.website,
        twitter_handle  = excluded.twitter_handle,
        past_projects   = excluded.past_projects,
        cp_collections  = excluded.cp_collections,
        archive_index   = COALESCE(artists.archive_index, excluded.archive_index),
        updated_at      = unixepoch()
    `).run(
      btc_address,
      (alias || '').slice(0, 80),
      anonymous ? 1 : 0,
      safeUrl(pfp_url),
      (bio || '').slice(0, 1000),
      safeUrl(website),
      (twitter_handle || '').replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50),
      (past_projects || '').slice(0, 500),
      cpJson,
      archiveIndex,
    );

    return NextResponse.json({ ok: true, archive_index: archiveIndex });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
