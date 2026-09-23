import { NextResponse } from 'next/server';
import * as listings from '../../../../lib/market/listings.js';
import { openDispenserFor } from '../../../../lib/market/dispensers.js';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/dispenser?listing=<id> — surface an open Counterparty dispenser
// for the listing's piece (trustless BTC delivery). Flag-gated, read-only.
export async function GET(request) {
  if (!featureEnabled('market_dispenser_release')) {
    return NextResponse.json({ ok: false, error: 'not available' }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const row = await listings.getListingRow(String(searchParams.get('listing') || ''));
  if (!row) return NextResponse.json({ ok: false, error: 'listing not found' }, { status: 404 });

  let dispenser = null;
  try { dispenser = await openDispenserFor(row.asset, row.artist_xcp_address); } catch { /* soft-fail */ }

  return NextResponse.json({
    ok: true, asset: row.asset, dispenser,
    note: dispenser
      ? `Trustless option: send ${dispenser.btc} BTC (${dispenser.satoshirate} sats) to ${dispenser.payTo} FROM your delivery address — Counterparty auto-sends ${row.asset} to you. No custodian, artist keeps their keys.`
      : 'No open dispenser for this piece — use the standard checkout (authority-gated delivery).',
  });
}
