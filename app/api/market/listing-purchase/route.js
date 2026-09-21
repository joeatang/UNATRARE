import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as listings from '../../../../lib/market/listings.js';
import { fetchToken } from '../../../../lib/market/catalog.js';
import * as bip137 from '../../../../lib/market/bip137.js';
import { runVerifier } from '../../../../lib/market/verifiers.js';
import { verifyCashBurn } from '../../../../lib/solanaBurnVerify.js';
import { dbQuery, dbExecute } from '../../../../lib/market/store.js';
import { QUOTES, PRICE_TOLERANCE, HEX64, B58SIG, XCP_ADDR, isBitcoinRail, checkRate } from '../../../../lib/market/runtime.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/market/listing-purchase — verify payment landed at the ARTIST's address.
export async function POST(request) {
  if (!checkRate(request)) return NextResponse.json({ ok: false, error: 'too many attempts — wait a minute' }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const currency = String(b.currency || '').trim().toUpperCase();
  const txid = String(b.txid || '').trim();
  const deliveryAddress = String(b.deliveryAddress || '').trim();
  const authAddress = String(b.authAddress || '').trim();
  const signature = String(b.signature || '').trim();
  const buyerPubkey = String(b.buyerPubkey || '').trim();

  const row = await listings.getListingRow(String(b.listing || ''));
  if (!row || row.status !== 'active') return NextResponse.json({ ok: false, error: 'listing not active' }, { status: 404 });
  const rail = listings.listingRail(row, currency);
  if (!rail.exists) return NextResponse.json({ ok: false, error: `"${currency}" is not an approved currency` }, { status: 400 });
  if (!rail.available) return NextResponse.json({ ok: false, error: `${currency} unavailable: ${rail.reason}` }, { status: 409 });

  // Bind to the rate-locked quote so a moving market can't game the amount.
  const quote = QUOTES.get(String(b.quoteId || ''));
  if (!quote || quote.listing !== row.id || quote.currency !== currency) {
    return NextResponse.json({ ok: false, error: 'get a fresh quote before paying' }, { status: 409 });
  }
  if (quote.expiresAt < Date.now()) { QUOTES.delete(b.quoteId); return NextResponse.json({ ok: false, error: 'quote expired — refresh and re-quote' }, { status: 409 }); }
  const lockedAmount = quote.amount;
  const requiredHuman = String(Number(lockedAmount) * (1 - PRICE_TOLERANCE));

  let meta;
  try { meta = await fetchToken(row.asset); } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 502 }); }
  if (!meta || !meta.approved) return NextResponse.json({ ok: false, error: `"${row.asset}" is no longer approved` }, { status: 404 });

  if (!XCP_ADDR.test(deliveryAddress)) return NextResponse.json({ ok: false, error: 'Delivery must be a Counterparty wallet address (starts with 1). Not an exchange or bech32 address — the XCP asset could be lost.' }, { status: 400 });

  const solana = rail.chain === 'solana';
  if (solana ? !B58SIG.test(txid) : !HEX64.test(txid)) return NextResponse.json({ ok: false, error: 'invalid transaction id for this chain' }, { status: 422 });

  if (isBitcoinRail(currency)) {
    const v = bip137.verify(authAddress, txid, signature);
    if (!v.ok) return NextResponse.json({ ok: false, error: `signature check failed: ${v.error}` }, { status: 422 });
  } else if (solana && !buyerPubkey) {
    return NextResponse.json({ ok: false, error: 'buyerPubkey required for Solana payments' }, { status: 422 });
  }

  try {
    const dup = dbQuery('SELECT token_name FROM checkout_orders WHERE txid = ?', [txid]);
    if (dup && dup.length) return NextResponse.json({ ok: false, error: `that txid was already used for ${dup[0].token_name}` }, { status: 409 });
  } catch { /* unique backstop below */ }

  // Verify the payment reached the ARTIST's address for >= the locked amount.
  const chk = await runVerifier(rail, { txid, treasury: rail.treasury, priceHuman: requiredHuman, buyerPubkey });
  if (!chk.ok) return NextResponse.json({ ok: false, error: chk.error }, { status: 422 });
  if (isBitcoinRail(currency) && chk.source && authAddress && chk.source !== authAddress) {
    return NextResponse.json({ ok: false, error: 'the signing wallet is not the wallet that paid' }, { status: 422 });
  }

  // Fee/burn: the same tx must also pay the platform fee (or burn $CASH).
  const fee = quote.fee;
  if (fee) {
    if (fee.kind === 'burn') {
      // $CASH burn = a TRUE SPL burn instruction (supply reduction), authored by
      // the buyer in the same tx. Verified via the repo's verifyCashBurn, the same
      // detector the salute flow uses. fee.to (incinerator) is only the enable flag.
      const feeReq = Number(fee.amount) * (1 - PRICE_TOLERANCE);
      let burn;
      try { burn = await verifyCashBurn(txid, buyerPubkey); }
      catch (e) { return NextResponse.json({ ok: false, error: `$CASH burn check failed: ${e.message}` }, { status: 422 }); }
      if (!burn) return NextResponse.json({ ok: false, error: 'required $CASH burn instruction not found in this tx' }, { status: 422 });
      if (Number(burn.displayAmount) < feeReq) return NextResponse.json({ ok: false, error: `insufficient $CASH burn: ${burn.displayAmount} < ${feeReq}` }, { status: 422 });
    } else {
      const feeReq = String(Number(fee.amount) * (1 - PRICE_TOLERANCE));
      const fchk = await runVerifier(rail, { txid, treasury: fee.to, priceHuman: feeReq, buyerPubkey });
      if (!fchk.ok) return NextResponse.json({ ok: false, error: `platform fee not included in the same tx: ${fchk.error}` }, { status: 422 });
    }
  }

  const orderId = randomUUID();
  try {
    dbExecute(
      `INSERT INTO checkout_orders (id, token_name, currency, amount, txid, buyer_delivery_address, buyer_auth_address, listing_id, artist_address, fee_kind, fee_amount, fee_to, status, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', datetime('now'))`,
      [orderId, row.asset, currency, lockedAmount, txid, deliveryAddress, authAddress || buyerPubkey || null, row.id, row.artist_xcp_address,
        fee ? fee.kind : null, fee ? fee.amount : null, fee ? fee.to : null]
    );
    dbExecute(
      `INSERT INTO release_intents (id, order_id, mechanism, chain, payload, status)
       VALUES (?, ?, ?, ?, ?, 'awaiting_authority')`,
      [randomUUID(), orderId, rail.release, 'bitcoin',
        JSON.stringify({ token: row.asset, deliveryAddress, paidWith: currency, amount: lockedAmount, txid, artist: row.artist_xcp_address })]
    );
  } catch (e) {
    if (/UNIQUE|constraint/i.test(e.message)) return NextResponse.json({ ok: false, error: 'that txid was already used' }, { status: 409 });
    return NextResponse.json({ ok: false, error: `payment verified but recording failed: ${e.message}` }, { status: 500 });
  }

  QUOTES.delete(b.quoteId);
  return NextResponse.json({
    ok: true, orderId, token: row.asset, name: meta.name,
    paid: `${lockedAmount} ${rail.label}`, paidTo: rail.treasury, artist: row.artist_xcp_address,
    fee: fee ? `${fee.amount} ${rail.label} ${fee.kind}` : null,
    delivery: deliveryAddress, release: rail.release, status: 'paid — awaiting artist release',
  });
}
