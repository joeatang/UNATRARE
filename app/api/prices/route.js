/**
 * /api/prices — server-side price proxy for the Currencies page.
 *
 * The browser never calls CoinGecko directly (CORS + no key exposure). This
 * route fetches on the server and is cached 60s. Display-only: NOTHING here
 * moves money. Live pay-rails are gated by their on-chain verifier elsewhere.
 */
import { NextResponse } from 'next/server';

export const revalidate = 60;

const CG_IDS = ['bitcoin', 'solana', 'tether', 'dmt-nat', 'trac-network'];

export async function GET() {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${CG_IDS.join(',')}` +
      `&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const r = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: 60 } });
    if (!r.ok) throw new Error('coingecko ' + r.status);
    const prices = await r.json();
    return NextResponse.json({ ok: true, prices, at: Math.floor(Date.now() / 1000) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e && e.message) || e) }, { status: 502 });
  }
}
