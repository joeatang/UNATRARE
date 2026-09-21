import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as listings from '../../../../lib/market/listings.js';
import { fetchToken } from '../../../../lib/market/catalog.js';
import * as fees from '../../../../lib/market/fees.js';
import { QUOTES, QUOTE_TTL } from '../../../../lib/market/runtime.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/listing-quote?listing=&currency= — live price + fee, pay the ARTIST.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const currency = String(searchParams.get('currency') || '').trim().toUpperCase();
  const row = await listings.getListingRow(String(searchParams.get('listing') || ''));
  if (!row || row.status !== 'active') return NextResponse.json({ ok: false, error: 'listing not active' }, { status: 404 });

  const rail = listings.listingRail(row, currency);
  if (!rail.exists) return NextResponse.json({ ok: false, error: `"${currency}" is not an approved currency` }, { status: 400 });
  if (!rail.available) return NextResponse.json({ ok: false, error: `${currency} unavailable: ${rail.reason}` }, { status: 409 });

  let meta;
  try { meta = await fetchToken(row.asset); } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 502 }); }
  if (!meta || !meta.approved) return NextResponse.json({ ok: false, error: `"${row.asset}" is no longer approved` }, { status: 404 });

  let price;
  try { price = await listings.priceForListing(row, currency); } catch (e) { return NextResponse.json({ ok: false, error: `price feed error: ${e.message}` }, { status: 502 }); }
  if (!price) return NextResponse.json({ ok: false, error: `no live price available for ${currency}` }, { status: 409 });

  const fee = fees.feeFor(rail.code, rail.chain, price.amount, rail.decimals);
  const total = fee ? String(Number(price.amount) + Number(fee.amount)) : price.amount;

  const quoteId = randomUUID();
  const expiresAt = Date.now() + QUOTE_TTL;
  QUOTES.set(quoteId, { listing: row.id, currency, amount: price.amount, fee, expiresAt });
  if (QUOTES.size > 5000) for (const [k, v] of QUOTES) if (v.expiresAt < Date.now()) QUOTES.delete(k);

  const allPrices = await listings.allPrices(row).catch(() => ({}));
  return NextResponse.json({
    ok: true, quoteId, expiresAt, ttlMs: QUOTE_TTL,
    listing: row.id, token: row.asset, name: meta.name, image: meta.image,
    currency: rail.code, label: rail.label, chain: rail.chain, amount: price.amount, priceSource: price.source,
    baseUsd: row.base_price_usd || null, decimals: rail.decimals,
    payTo: rail.treasury, artist: row.artist_xcp_address, canonicalId: rail.canonicalId, release: rail.release,
    fee, total, allPrices,
  });
}
