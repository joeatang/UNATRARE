import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const NATCASH_ADDR = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const TOTAL_SUPPLY = 10080;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=30, max-age=30',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function shortWallet(w) {
  if (!w) return '';
  return w.length <= 8 ? w : `${w.slice(0, 4)}…${w.slice(-4)}`;
}

async function fetchBondingCurve() {
  const key = process.env.NAT_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.nat.fun/api/v1/tokens/${NATCASH_ADDR}`,
      { headers: { 'X-API-Key': key }, next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const row = Array.isArray(json?.data) ? json.data[0] : json?.data;
    const bc = row?.bondingCurve;
    return typeof bc === 'number' ? bc : null;
  } catch (_) {
    return null;
  }
}

export async function GET() {
  const bondingPct = await fetchBondingCurve();
  const graduation = bondingPct == null ? null : Math.max(0, Math.min(100, bondingPct)) / 100;
  const sealed = graduation == null ? null : Math.floor(graduation * TOTAL_SUPPLY);

  let latestBurner = null;
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT sol_wallet, amount_display, card_name, burned_at
      FROM card_salutes
      ORDER BY burned_at DESC, id DESC
      LIMIT 1
    `).get();
    if (row) {
      latestBurner = {
        handle: shortWallet(row.sol_wallet),
        amount: row.amount_display || 0,
        card: row.card_name || '',
        at: row.burned_at || 0,
      };
    }
  } catch (_) {}

  return NextResponse.json({
    graduation,
    sealed,
    total: TOTAL_SUPPLY,
    latestBurner,
    updatedAt: Math.floor(Date.now() / 1000),
  }, { headers: CORS });
}
