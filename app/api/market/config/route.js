import { NextResponse } from 'next/server';
import { listRails } from '../../../../lib/market/currencies.js';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/config — which rails are live vs. awaiting a treasury address.
export async function GET() {
  const rails = listRails();
  return NextResponse.json({
    brand: 'UNATRARE',
    tagline: 'Council-certified Bitcoin art. Pay your way. Delivered native.',
    custody: 'none — the checkout never holds keys',
    rails,
    enabledCount: rails.filter(r => r.enabled).length,
    flags: {
      market_my_orders: featureEnabled('market_my_orders'),
      market_offers: featureEnabled('market_offers'),
      market_auctions: featureEnabled('market_auctions'),
      market_messages: featureEnabled('market_messages'),
    },
  });
}
