import { NextResponse } from 'next/server';
import * as messages from '../../../../lib/market/messages.js';
import { checkRate } from '../../../../lib/market/runtime.js';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/messages?listing=Y — the thread for a piece (flag-gated).
export async function GET(request) {
  if (!featureEnabled('market_messages')) return NextResponse.json({ ok: false, error: 'not available' });
  const { searchParams } = new URL(request.url);
  const listing = String(searchParams.get('listing') || '').trim();
  if (!listing) return NextResponse.json({ ok: false, error: 'listing required' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, messages: await messages.listThread(listing) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/market/messages — post a message. Buyer posts are public (rate-limited);
// artist posts require the operator token (so replies can't be spoofed).
export async function POST(request) {
  if (!featureEnabled('market_messages')) return NextResponse.json({ ok: false, error: 'messaging is not open yet' });
  if (!checkRate(request)) return NextResponse.json({ ok: false, error: 'too many attempts — wait a minute' }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body && body.sender === 'artist') {
      const need = (process.env.OPERATOR_TOKEN || '').trim();
      const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
      if (!need || got !== need) return NextResponse.json({ ok: false, error: 'artist replies require the operator token' }, { status: 401 });
    }
    const out = await messages.postMessage(body || {});
    if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
    return NextResponse.json({ ok: true, message: out.message });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
