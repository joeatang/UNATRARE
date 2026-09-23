import { NextResponse } from 'next/server';
import { reputationFor } from '../../../../../lib/market/reputation.js';
import { featureEnabled } from '../../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/reputation/:address — an artist's trust score, built only on
// delivered on-chain sales. Flag-gated (market_reputation), read-only.
export async function GET(request, { params }) {
  if (!featureEnabled('market_reputation')) return NextResponse.json({ ok: false, error: 'not available' }, { status: 404 });
  const rep = reputationFor(String(params.address || ''));
  if (!rep) return NextResponse.json({ ok: false, error: 'address required' }, { status: 400 });
  return NextResponse.json({ ok: true, reputation: rep });
}
