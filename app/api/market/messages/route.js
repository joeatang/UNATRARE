import { NextResponse } from 'next/server';
import * as messages from '../../../../lib/market/messages.js';
import { checkRate } from '../../../../lib/market/runtime.js';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function operatorOk(request) {
  const need = (process.env.OPERATOR_TOKEN || '').trim();
  if (!need) return { ok: false, code: 403, error: 'operator API disabled' };
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== need) return { ok: false, code: 401, error: 'unauthorized' };
  return { ok: true };
}

// GET /api/market/messages?listing=Y&buyer=Z  → one buyer's PRIVATE thread.
// GET /api/market/messages?listing=Y  (operator) → every thread on that listing.
export async function GET(request) {
  if (!featureEnabled('market_messages')) return NextResponse.json({ ok: false, error: 'not available' });
  const { searchParams } = new URL(request.url);
  const listing = String(searchParams.get('listing') || '').trim();
  const buyer = String(searchParams.get('buyer') || '').trim();
  if (!listing) return NextResponse.json({ ok: false, error: 'listing required' }, { status: 400 });
  try {
    if (buyer) return NextResponse.json({ ok: true, messages: await messages.listThread(listing, buyer) });
    // No buyer specified → operator-only (the artist's view of all threads).
    const gate = operatorOk(request);
    if (!gate.ok) return NextResponse.json({ ok: false, error: 'a buyer address is required to read a private thread' }, { status: 400 });
    return NextResponse.json({ ok: true, messages: await messages.listThreadsForListing(listing) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/market/messages
//   { report: <messageId> }                          → flag a message (rate-limited)
//   { listing, buyerAddress, body }                  → buyer post (needs standing)
//   { listing, buyerAddress, body, sender:'artist' } → artist reply (operator token)
export async function POST(request) {
  if (!featureEnabled('market_messages')) return NextResponse.json({ ok: false, error: 'messaging is not open yet' });
  if (!checkRate(request)) return NextResponse.json({ ok: false, error: 'too many attempts — wait a minute' }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body && body.report) {
      const out = await messages.reportMessage(body.report);
      if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
      return NextResponse.json({ ok: true, reported: true });
    }
    if (body && body.sender === 'artist') {
      const gate = operatorOk(request);
      if (!gate.ok) return NextResponse.json({ ok: false, error: 'artist replies require the operator token' }, { status: 401 });
      const out = await messages.postArtistMessage(body);
      if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
      return NextResponse.json({ ok: true, message: out.message });
    }
    const out = await messages.postBuyerMessage(body || {});
    if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
    return NextResponse.json({ ok: true, message: out.message });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
