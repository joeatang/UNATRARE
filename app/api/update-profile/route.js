/**
 * POST /api/update-profile
 *
 * Artist self-service profile update. Upserts the artists table record
 * for the calling address. Auth: BIP-137 over "UNATRARE:PROFILE:<address>".
 * Address must have at least one token submission.
 *
 * Updatable: alias, bio, website, twitter_handle
 * Admin-only: pfp_url, past_projects, cp_collections, anonymous, archive_index
 *
 * Body: { address, signature, alias, bio, website, twitterHandle }
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { verifyBitcoinMessage } from '../../../lib/btcVerify.mjs';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const URL_RE  = /^https?:\/\/.{3,}/;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { address, signature, alias, bio, website, twitterHandle } = body || {};

  if (!address || !signature) {
    return NextResponse.json({ error: 'address and signature required' }, { status: 422 });
  }
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
  }

  const challenge = `UNATRARE:PROFILE:${address}`;
  let valid = false;
  try { valid = verifyBitcoinMessage(address, challenge, signature.trim()); } catch {}
  if (!valid) {
    return NextResponse.json({ error: 'Signature verification failed — sign the exact challenge shown' }, { status: 401 });
  }

  const db = getDb();

  const hasToken = db.prepare('SELECT 1 FROM tokens WHERE artist_address = ? LIMIT 1').get(address);
  if (!hasToken) {
    return NextResponse.json({ error: 'No submissions found for this address' }, { status: 403 });
  }

  // Sanitize
  const cleanAlias   = (alias || '').trim().slice(0, 60);
  const cleanBio     = (bio || '').trim().slice(0, 500);
  const cleanWebsite = (website || '').trim();
  const cleanTwitter = (twitterHandle || '').replace(/^@/, '').trim().slice(0, 50);

  if (cleanWebsite && !URL_RE.test(cleanWebsite)) {
    return NextResponse.json({ error: 'Website must be a valid URL (https://...)' }, { status: 422 });
  }

  db.prepare(`
    INSERT INTO artists (btc_address, alias, bio, website, twitter_handle, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(btc_address) DO UPDATE SET
      alias          = excluded.alias,
      bio            = excluded.bio,
      website        = excluded.website,
      twitter_handle = excluded.twitter_handle,
      updated_at     = unixepoch()
  `).run(address, cleanAlias, cleanBio, cleanWebsite, cleanTwitter);

  return NextResponse.json({ ok: true });
}
