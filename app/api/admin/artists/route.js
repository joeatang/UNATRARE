import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

// GET — look up a single artist profile by address
export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  try {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM artists WHERE btc_address = ?').get(address) || null;
    // Pull current handle from tokens as fallback
    const handleRow = db.prepare(
      "SELECT artist_handle FROM tokens WHERE artist_address = ? AND artist_handle != '' LIMIT 1"
    ).get(address);
    return NextResponse.json({ profile, handle_fallback: handleRow?.artist_handle || '' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — create or update an artist profile
export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const {
    address,
    alias = '',
    anonymous = 0,
    pfp_url = '',
    bio = '',
    website = '',
    twitter_handle = '',
    past_projects = '',
    cp_collections = '[]',
    archive_index,   // number | null | undefined — if undefined, auto-assign
  } = body;

  if (!address || typeof address !== 'string') {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  // Validate cp_collections is valid JSON array string
  try {
    const parsed = JSON.parse(cp_collections);
    if (!Array.isArray(parsed)) throw new Error('not array');
  } catch {
    return NextResponse.json({ error: 'cp_collections must be a JSON array' }, { status: 400 });
  }

  try {
    const db = getDb();

    // Resolve archive_index
    let resolvedIndex = archive_index !== undefined ? archive_index : null;
    if (resolvedIndex === null || resolvedIndex === undefined) {
      // Auto-assign next available index only if this artist has none
      const existing = db.prepare('SELECT archive_index FROM artists WHERE btc_address = ?').get(address);
      if (existing?.archive_index != null) {
        resolvedIndex = existing.archive_index;
      } else {
        // Get next index
        const maxRow = db.prepare('SELECT MAX(archive_index) as m FROM artists').get();
        resolvedIndex = (maxRow?.m ?? 0) + 1;
      }
    }

    db.prepare(`
      INSERT INTO artists (
        btc_address, alias, anonymous, pfp_url, bio, website,
        twitter_handle, past_projects, cp_collections, archive_index,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
      ON CONFLICT(btc_address) DO UPDATE SET
        alias          = excluded.alias,
        anonymous      = excluded.anonymous,
        pfp_url        = excluded.pfp_url,
        bio            = excluded.bio,
        website        = excluded.website,
        twitter_handle = excluded.twitter_handle,
        past_projects  = excluded.past_projects,
        cp_collections = excluded.cp_collections,
        archive_index  = excluded.archive_index,
        updated_at     = unixepoch()
    `).run(
      address, alias, anonymous ? 1 : 0, pfp_url, bio, website,
      twitter_handle, past_projects, cp_collections, resolvedIndex
    );

    const saved = db.prepare('SELECT * FROM artists WHERE btc_address = ?').get(address);
    return NextResponse.json({ ok: true, profile: saved });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
