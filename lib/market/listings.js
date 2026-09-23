// Listings — the marketplace core. NON-CUSTODIAL: a listing records the artist's
// OWN receive address per currency; payment goes straight to the artist, never
// to UNATRARE. To create a listing the artist must PROVE they hold the asset:
//   1. BIP-137 sign  UNATRARE:LIST:<ASSET>  with the address holding the asset
//   2. that address must currently hold >= the listed quantity on Counterparty
// Nobody can list art they don't control.
// Ported from unatrare-checkout/lib/listings.js (CommonJS) to ESM; DB calls use
// the repo's synchronous getDb() via ./store.js.

import { randomUUID } from 'node:crypto';
import { fetchToken, fetchDirectory } from './catalog.js';
import { CURRENCIES } from './currencies.js';
import * as bip137 from './bip137.js';
import { dbQuery, dbExecute } from './store.js';
import * as pricing from './pricing.js';

const XCP_API = process.env.XCP_API || 'https://api.counterparty.io:4000/v2';

// Per-chain receive-address validators (which address a given currency pays to).
const ADDR_RE = {
  bitcoin:        /^(bc1[a-z0-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  counterparty:   /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  'bitcoin-tap':  /^(bc1p?[a-z0-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  solana:         /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  ethereum:       /^0x[a-fA-F0-9]{40}$/,
  trac:           /^.{6,120}$/,
};

export function validAddressFor(currency, addr) {
  const c = CURRENCIES[currency];
  if (!c) return false;
  const re = ADDR_RE[c.chain];
  return re ? re.test(String(addr || '').trim()) : false;
}

// Does `address` currently hold >= qty of `asset` on Counterparty?
async function holdsAsset(address, asset, qty) {
  const url = `${XCP_API}/addresses/${encodeURIComponent(address)}/balances?verbose=true&limit=500`;
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`counterparty balances ${r.status}`);
  const data = await r.json();
  const rows = (data.result || data || []);
  const bal = rows.find(b => b.asset === asset);
  if (!bal) return { ok: false, held: 0 };
  const held = Number(bal.quantity_normalized != null ? bal.quantity_normalized : bal.quantity);
  return { ok: held >= qty, held };
}

export async function createListing(body) {
  const asset = String(body.asset || '').trim().toUpperCase();
  const artistAddress = String(body.artistAddress || '').trim();
  const signature = String(body.signature || '').trim();
  const quantity = Math.max(1, parseInt(body.quantity || '1', 10) || 1);
  const releaseMethod = ['dispenser', 'sign'].includes(body.releaseMethod) ? body.releaseMethod : 'sign';
  const basePriceUsd = Number(body.basePriceUsd || 0);
  const manualIn = body.manualPrices && typeof body.manualPrices === 'object' ? body.manualPrices : {};
  const payAddresses = body.payAddresses && typeof body.payAddresses === 'object' ? body.payAddresses : {};

  // 1) Asset must be Council-approved AND revealed (catalog gates both).
  const meta = await fetchToken(asset);
  if (!meta || !meta.approved) return { code: 404, error: `"${asset}" is not an approved UNATRARE piece` };

  // 1b) Revealed-only: the piece must appear in the public revealed directory,
  //     else it can't render in the catalog buyers browse.
  let dir;
  try { dir = await fetchDirectory(); }
  catch (e) { return { code: 502, error: `catalog unreachable: ${e.message}` }; }
  if (!dir.some(i => i.token === asset)) {
    return { code: 409, error: `"${asset}" is approved but not yet revealed in the directory — it can be listed once revealed` };
  }

  // 2) Artist address shape.
  if (!ADDR_RE.counterparty.test(artistAddress)) return { code: 400, error: 'artistAddress must be a Counterparty address (starts with 1 or 3)' };

  // 3) Ownership proof — signature over UNATRARE:LIST:<ASSET>.
  const sig = bip137.verifyRaw(artistAddress, bip137.challengeForList(asset), signature);
  if (!sig.ok) return { code: 422, error: `ownership signature failed: ${sig.error}` };

  // 4) Live holding check.
  let holds;
  try { holds = await holdsAsset(artistAddress, asset, quantity); }
  catch (e) { return { code: 502, error: `could not verify holdings: ${e.message}` }; }
  if (!holds.ok) return { code: 422, error: `that address holds ${holds.held} ${asset}, need >= ${quantity}` };

  // 5) Accepted currencies = those the artist gave a receive address for.
  const accepted = Object.keys(payAddresses).map(c => c.toUpperCase());
  if (!accepted.length) return { code: 400, error: 'add a receive address for at least one currency' };
  const cleanAddrs = {}, cleanManual = {};
  for (const code of accepted) {
    if (!CURRENCIES[code] || !CURRENCIES[code].verifier) return { code: 400, error: `"${code}" is not an accept-able currency` };
    const addr = payAddresses[code] || payAddresses[code.toLowerCase()];
    if (!validAddressFor(code, addr)) return { code: 400, error: `invalid ${code} receive address` };
    cleanAddrs[code] = String(addr).trim();
    const manual = Number(manualIn[code] != null ? manualIn[code] : manualIn[code.toLowerCase()]);
    if (manual > 0) cleanManual[code] = String(manual);
    else if (!(basePriceUsd > 0 && pricing.hasOracle(code))) {
      return { code: 400, error: `${code} has no live price — set a base USD price or a manual ${code} amount` };
    }
  }
  if (!(basePriceUsd > 0) && !Object.keys(cleanManual).length) {
    return { code: 400, error: 'set a base USD price (auto-converts) or at least one manual price' };
  }

  const id = randomUUID();
  dbExecute(
    `INSERT INTO listings (id, asset, artist_xcp_address, quantity, pay_addresses, base_price_usd, manual_prices, release_method, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [id, asset, artistAddress, quantity, JSON.stringify(cleanAddrs), basePriceUsd || null, JSON.stringify(cleanManual), releaseMethod]
  );
  return { code: 200, listing: { id, asset, quantity, currencies: accepted, releaseMethod, status: 'active' } };
}

// Resolve the live price of a listing in one currency. Returns { amount, source } or null.
export async function priceForListing(row, currency) {
  const code = String(currency || '').toUpperCase();
  const manual = safeJson(row.manual_prices)[code];
  if (manual != null && Number(manual) > 0) return { amount: String(manual), source: 'manual' };
  if (row.base_price_usd > 0 && pricing.hasOracle(code)) {
    const c = await pricing.convertUsdTo(code, row.base_price_usd);
    if (c) return { amount: String(c.amount), source: 'live', usd: row.base_price_usd, unitUsd: c.unitUsd };
  }
  return null;
}

// Live amounts for every accepted currency of a listing (for display).
export async function allPrices(row) {
  const addrs = safeJson(row.pay_addresses);
  const out = {};
  await Promise.all(Object.keys(addrs).map(async code => {
    const p = await priceForListing(row, code).catch(() => null);
    if (p) out[code] = p.amount;
  }));
  return out;
}

export function shapeListing(row, opts = {}) {
  const addrs = safeJson(row.pay_addresses);
  const out = {
    id: row.id, asset: row.asset, quantity: row.quantity, status: row.status,
    artist: row.artist_xcp_address, releaseMethod: row.release_method,
    currencies: Object.keys(addrs), basePriceUsd: row.base_price_usd || null,
    manualPrices: safeJson(row.manual_prices), created_at: row.created_at,
  };
  if (opts.withAddresses) out.payAddresses = addrs;
  return out;
}

export function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

export async function listActive() {
  const rows = dbQuery("SELECT * FROM listings WHERE status='active' ORDER BY created_at DESC");
  return rows.map(r => shapeListing(r));
}

export async function getListing(id, opts) {
  const rows = dbQuery('SELECT * FROM listings WHERE id = ?', [id]);
  return rows.length ? shapeListing(rows[0], opts) : null;
}

// Internal: full row incl. addresses (for checkout resolution).
export async function getListingRow(id) {
  const rows = dbQuery('SELECT * FROM listings WHERE id = ?', [id]);
  return rows.length ? rows[0] : null;
}

// Phase 0 — oversell lock. Atomically reserve ONE unit of a listing. The single
// UPDATE is the concurrency guard: WHERE status='active' AND quantity>0 means
// only one caller can win the last unit; the loser gets changes===0. When the
// last unit is taken, status flips to 'sold' so it drops out of the market and
// future quotes are refused. Call INSIDE withTx() alongside the order insert so
// the reservation and the order commit (or roll back) together.
export function claimListingUnit(id) {
  const res = dbExecute(
    `UPDATE listings
        SET quantity = quantity - 1,
            status   = CASE WHEN quantity - 1 <= 0 THEN 'sold' ELSE status END
      WHERE id = ? AND status = 'active' AND quantity > 0`,
    [id]
  );
  return { ok: res.changes === 1 };
}

// Cheap read-side stock check for the quote gate.
export function hasStock(row) {
  return !!row && row.status === 'active' && Number(row.quantity) > 0;
}

// Resolve a rail-like object for one currency of one listing. The "treasury"
// here is the ARTIST's own receive address — payment is non-custodial.
export function listingRail(row, currency) {
  const code = String(currency || '').toUpperCase();
  const c = CURRENCIES[code];
  if (!c) return { exists: false };
  const addrs = safeJson(row.pay_addresses);
  if (addrs[code] == null) return { exists: true, available: false, code, reason: 'not offered for this listing' };
  if (!c.verifier) return { exists: true, available: false, code, reason: c.pending || 'no verifier' };
  return {
    exists: true, available: true, code, label: c.label, chain: c.chain, decimals: c.decimals,
    canonicalId: c.mint || c.asset || c.tick || c.chain,
    release: row.release_method, treasury: addrs[code],
  };
}
