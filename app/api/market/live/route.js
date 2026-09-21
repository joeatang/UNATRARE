import { NextResponse } from 'next/server';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/live — is the marketplace nav link revealed?
// Gated by the `market_public` feature flag (settings table or FEATURE_MARKET_PUBLIC
// env). Dark by default (fail-closed). Flip the flag to launch — no redeploy.
export async function GET() {
  return NextResponse.json({ live: featureEnabled('market_public') }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
