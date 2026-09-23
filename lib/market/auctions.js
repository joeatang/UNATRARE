// Timed auctions (Phase I) — NON-CUSTODIAL, like offers. A bid is a *signed
// intent*, not an escrow: the highest bid at close wins and the winner completes
// the normal verified on-chain purchase. No funds are ever held here.
//
// Additive: `auctions` + `auction_bids` tables are created lazily on first use;
// the core token schema is never touched. Gated by `market_auctions` at routes.

import { randomUUID } from 'node:crypto';
import { dbQuery, dbExecute } from './store.js';
import { getListingRow } from './listings.js';

let _ensured = false;
function ensure() {
  if (_ensured) return;
  dbExecute(`
    CREATE TABLE IF NOT EXISTS auctions (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      asset TEXT NOT NULL,
      artist_address TEXT,
      min_bid TEXT NOT NULL,
      bid_currency TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      winner_bid_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  dbExecute(`
    CREATE TABLE IF NOT EXISTS auction_bids (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL,
      bidder_address TEXT,
      bidder_delivery_address TEXT,
      amount TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  dbExecute(`CREATE INDEX IF NOT EXISTS idx_auctions_listing ON auctions(listing_id)`);
  dbExecute(`CREATE INDEX IF NOT EXISTS idx_bids_auction ON auction_bids(auction_id)`);
  _ensured = true;
}

function topBid(auctionId) {
  const rows = dbQuery(
    `SELECT * FROM auction_bids WHERE auction_id = ? ORDER BY CAST(amount AS REAL) DESC, created_at ASC LIMIT 1`,
    [auctionId]
  );
  return rows.length ? rows[0] : null;
}

function shape(a) {
  const top = topBid(a.id);
  const bidCount = dbQuery(`SELECT COUNT(*) AS n FROM auction_bids WHERE auction_id = ?`, [a.id])[0]?.n || 0;
  return {
    id: a.id,
    listingId: a.listing_id,
    asset: a.asset,
    artist: a.artist_address,
    minBid: a.min_bid,
    currency: a.bid_currency,
    endsAt: a.ends_at,
    status: a.status,
    highBid: top ? top.amount : null,
    bidCount,
    winnerBidId: a.winner_bid_id || null,
  };
}

// Active auction for a piece (by listing or asset). Auto-closes if past ends_at.
export async function getForListing({ listing, asset }) {
  ensure();
  let rows = [];
  if (listing) rows = dbQuery(`SELECT * FROM auctions WHERE listing_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`, [String(listing)]);
  else if (asset) rows = dbQuery(`SELECT * FROM auctions WHERE asset = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`, [String(asset).toUpperCase()]);
  if (!rows.length) return null;
  const a = rows[0];
  if (a.ends_at && a.ends_at <= new Date().toISOString()) {
    // lazily settle: mark closed + record the winning bid
    const top = topBid(a.id);
    dbExecute(`UPDATE auctions SET status = 'closed', winner_bid_id = ? WHERE id = ?`, [top ? top.id : null, a.id]);
    a.status = 'closed';
    a.winner_bid_id = top ? top.id : null;
  }
  return shape(a);
}

export async function listActive() {
  ensure();
  return dbQuery(`SELECT * FROM auctions WHERE status = 'active' ORDER BY ends_at ASC LIMIT 100`).map(shape);
}

// Place a bid (buyer). Must beat the current high bid and the minimum.
export async function placeBid(body) {
  ensure();
  const auctionId = String(body.auction || '').trim();
  const amount = String(body.amount || '').trim();
  const delivery = String(body.deliveryAddress || '').trim();
  const bidder = String(body.bidderAddress || delivery || '').trim();
  if (!auctionId || !amount) return { error: 'auction and amount are required', code: 400 };
  if (!(Number(amount) > 0)) return { error: 'amount must be a positive number', code: 400 };
  if (!delivery) return { error: 'a delivery address is required', code: 400 };
  const rows = dbQuery(`SELECT * FROM auctions WHERE id = ?`, [auctionId]);
  if (!rows.length) return { error: 'auction not found', code: 404 };
  const a = rows[0];
  if (a.status !== 'active' || (a.ends_at && a.ends_at <= new Date().toISOString())) {
    return { error: 'this auction has ended', code: 409 };
  }
  const top = topBid(a.id);
  const floor = Math.max(Number(a.min_bid) || 0, top ? Number(top.amount) || 0 : 0);
  if (!(Number(amount) > floor)) {
    return { error: `bid must be higher than ${floor} ${a.bid_currency}`, code: 400 };
  }
  const id = randomUUID();
  dbExecute(
    `INSERT INTO auction_bids (id, auction_id, bidder_address, bidder_delivery_address, amount) VALUES (?, ?, ?, ?, ?)`,
    [id, auctionId, bidder, delivery, amount]
  );
  return { bid: { id, auctionId, amount, currency: a.bid_currency } };
}

// Operator: create or close an auction. No funds involved.
export async function manage(body) {
  ensure();
  const action = String(body.action || '').trim();
  if (action === 'create') {
    const listing = String(body.listing || '').trim();
    const minBid = String(body.minBid || '0').trim();
    const currency = String(body.currency || 'XCP').trim().toUpperCase();
    const endsAt = String(body.endsAt || '').trim(); // ISO string
    if (!listing || !endsAt) return { error: 'listing and endsAt are required', code: 400 };
    const row = await getListingRow(listing);
    if (!row || row.status !== 'active') return { error: 'listing not found or not active', code: 404 };
    const id = randomUUID();
    dbExecute(
      `INSERT INTO auctions (id, listing_id, asset, artist_address, min_bid, bid_currency, ends_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, listing, row.asset, row.artist_xcp_address, minBid, currency, endsAt]
    );
    return { auction: shape(dbQuery(`SELECT * FROM auctions WHERE id = ?`, [id])[0]) };
  }
  if (action === 'close') {
    const id = String(body.id || '').trim();
    const rows = dbQuery(`SELECT * FROM auctions WHERE id = ?`, [id]);
    if (!rows.length) return { error: 'auction not found', code: 404 };
    const top = topBid(id);
    dbExecute(`UPDATE auctions SET status = 'closed', winner_bid_id = ? WHERE id = ?`, [top ? top.id : null, id]);
    return { auction: shape(dbQuery(`SELECT * FROM auctions WHERE id = ?`, [id])[0]) };
  }
  return { error: 'action must be create or close', code: 400 };
}
