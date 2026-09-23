// Make-an-Offer (Phase E) — NON-CUSTODIAL by design. An offer is a *signed
// intent*: the buyer proposes a price + their delivery address; the artist can
// accept, which simply converts it into the normal verified on-chain purchase
// flow. No funds are ever held or escrowed here — this table only stores intents.
//
// Fully additive: the `offers` table is created lazily on first use and never
// touches the core token schema. Gated by the `market_offers` flag at the route.

import { randomUUID } from 'node:crypto';
import { dbQuery, dbExecute } from './store.js';
import { getListingRow } from './listings.js';

let _ensured = false;
function ensure() {
  if (_ensured) return;
  dbExecute(`
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      asset TEXT NOT NULL,
      artist_address TEXT,
      buyer_address TEXT,
      buyer_delivery_address TEXT,
      offer_amount TEXT NOT NULL,
      offer_currency TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    )`);
  dbExecute(`CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers(listing_id)`);
  dbExecute(`CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers(buyer_delivery_address)`);
  dbExecute(`CREATE INDEX IF NOT EXISTS idx_offers_artist ON offers(artist_address)`);
  _ensured = true;
}

function shape(r) {
  return {
    id: r.id,
    listingId: r.listing_id,
    asset: r.asset,
    artist: r.artist_address,
    buyer: r.buyer_address,
    deliveryAddress: r.buyer_delivery_address,
    amount: r.offer_amount,
    currency: r.offer_currency,
    message: r.message || '',
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at || null,
  };
}

// Create a pending offer (buyer). Validates the listing is real + active.
export async function createOffer(body) {
  ensure();
  const listingId = String(body.listing || '').trim();
  const amount = String(body.amount || '').trim();
  const currency = String(body.currency || '').trim().toUpperCase();
  const delivery = String(body.deliveryAddress || '').trim();
  const buyer = String(body.buyerAddress || delivery || '').trim();
  const message = String(body.message || '').slice(0, 280);
  if (!listingId || !amount || !currency) return { error: 'listing, amount and currency are required', code: 400 };
  if (!(Number(amount) > 0)) return { error: 'amount must be a positive number', code: 400 };
  if (!delivery) return { error: 'a delivery address is required', code: 400 };
  const row = await getListingRow(listingId);
  if (!row || row.status !== 'active') return { error: 'listing not found or not active', code: 404 };
  const id = randomUUID();
  dbExecute(
    `INSERT INTO offers (id, listing_id, asset, artist_address, buyer_address, buyer_delivery_address, offer_amount, offer_currency, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, listingId, row.asset, row.artist_xcp_address, buyer, delivery, amount, currency, message]
  );
  return { offer: { id, listingId, asset: row.asset, amount, currency, status: 'pending' } };
}

export async function listForBuyer(addr) {
  ensure();
  const a = String(addr || '').trim();
  if (!a) return [];
  return dbQuery(
    `SELECT * FROM offers WHERE buyer_delivery_address = ? OR buyer_address = ? ORDER BY created_at DESC LIMIT 100`,
    [a, a]
  ).map(shape);
}

export async function listForArtist(addr) {
  ensure();
  const a = String(addr || '').trim();
  if (!a) return [];
  return dbQuery(
    `SELECT * FROM offers WHERE artist_address = ? ORDER BY created_at DESC LIMIT 100`,
    [a]
  ).map(shape);
}

// Accept / decline (operator-gated at the route). No funds move — accepting just
// signals the buyer to complete the normal purchase at the agreed price.
export async function setStatus(id, status) {
  ensure();
  const allowed = ['accepted', 'declined', 'pending'];
  if (!allowed.includes(status)) return { error: 'invalid status', code: 400 };
  const rows = dbQuery(`SELECT * FROM offers WHERE id = ?`, [String(id || '')]);
  if (!rows.length) return { error: 'offer not found', code: 404 };
  dbExecute(`UPDATE offers SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
  return { offer: shape({ ...rows[0], status }) };
}
