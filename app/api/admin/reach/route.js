// GET /api/admin/reach — verification snapshot for the Heralds & Reach loop.
// Admin-only. Read-only aggregate so the founder can watch clicks / conversions
// / top Heralds accrue in real time right after flipping the reward_reach flag.

import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../auth/route';
import { featureEnabled } from '../../../../lib/features';
import { reachOverview } from '../../../../lib/reach';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    enabled: featureEnabled('reward_reach'),
    referralEnabled: featureEnabled('reward_referral'),
    ...reachOverview(),
  });
}
