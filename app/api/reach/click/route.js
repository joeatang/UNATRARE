// POST /api/reach/click — log a real click on a Herald's tracked share link.
//
// Called once (client-side, by Nav) the first time a visitor lands with a
// ?ref=<code> param. Fully non-fatal and gated behind the `reward_reach` flag:
// when the flag is OFF this is a silent no-op, so it ships completely dark.
// Records nothing that identifies a person — only a salted hash of IP+UA for
// dedup. Never moves money; only builds the public Reach score.

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { featureEnabled } from '../../../../lib/features';
import { recordClick, computeReach } from '../../../../lib/reach';

export const dynamic = 'force-dynamic';

function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for') || '';
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '';
}

export async function POST(request) {
  // Dark by default — flip `reward_reach` in /admin to activate.
  if (!featureEnabled('reward_reach')) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const code = String(body?.code || '').trim();
  const card = String(body?.card || '').trim();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  try {
    const db = getDb();
    const ip = getClientIp(request);
    const ua = request.headers.get('user-agent') || '';
    let refHost = '';
    try { refHost = new URL(request.headers.get('referer') || '').host; } catch { /* none */ }

    const referrer = recordClick(db, { code, card, ip, ua, refHost });
    if (!referrer) {
      // Unresolvable code (not a claimed Herald) — spread the word, earn nothing.
      return NextResponse.json({ ok: true, credited: false });
    }

    // Keep the Herald's Reach + card leaderboard fresh. Non-fatal.
    try { computeReach(db, { wallet: referrer }); } catch { /* lazy recompute later */ }

    return NextResponse.json({ ok: true, credited: true });
  } catch {
    return NextResponse.json({ ok: true, credited: false });
  }
}
