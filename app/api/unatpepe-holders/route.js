import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

/**
 * GET /api/unatpepe-holders
 *
 * Returns the count of UNATPEPE holders registered on UNATRARE
 * plus a note about total supply. Cached in-memory for 4 hours.
 *
 * Note: "registered" holders = those who verified UNATPEPE on UNATRARE.
 * Total UNATPEPE supply is fixed at 420.
 */

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function GET() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) {
    return NextResponse.json(cache);
  }

  try {
    const db = getDb();
    // Count holders with a positive tap_balance in our DB (registered UNATPEPE holders)
    const { registered } = db.prepare(
      "SELECT COUNT(*) as registered FROM holders WHERE tap_balance > 0"
    ).get();

    const result = {
      ok: true,
      registered_holders: registered,
      total_supply: 420,
      note: 'registered = verified on UNATRARE; total_supply = fixed UNATPEPE issuance',
      cached_at: now,
    };
    cache = result;
    cacheTime = now;
    return NextResponse.json(result);
  } catch (err) {
    console.error('[unatpepe-holders]', err?.message);
    return NextResponse.json({
      ok: true,
      registered_holders: null,
      total_supply: 420,
      note: 'count unavailable',
    });
  }
}
