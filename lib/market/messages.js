// Buyer↔artist PRIVATE messaging (Phase K, v2 — anti-spam redesign).
//
// A message belongs to a PRIVATE 1:1 thread keyed by (listing_id, buyer_address) —
// NOT a public board. A buyer can only post if they have standing on the piece
// (an existing offer or order), so anonymous spam is impossible: you can't message
// without a real, signed action first. Bodies are link-sanitized (phishing/drainer
// URLs stripped; off-platform lures flagged). Artist replies go through the operator
// token. Every message is reportable → operator can ban an address.
//
// Additive + flag-gated (market_messages). The Holepunch P2P transport remains the
// eventual upgrade; this server-backed model is what's testable + shippable now.

import { randomUUID } from 'node:crypto';
import { dbQuery, dbExecute } from './store.js';
import { getListingRow } from './listings.js';

let _ensured = false;
function ensure() {
  if (_ensured) return;
  dbExecute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      buyer_address TEXT,
      asset TEXT,
      artist_address TEXT,
      sender TEXT NOT NULL,
      sender_address TEXT,
      body TEXT NOT NULL,
      reported INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  // Additive migration for the already-deployed v1 table (dark + empty).
  for (const col of ['buyer_address TEXT', 'artist_address TEXT', "reported INTEGER NOT NULL DEFAULT 0"]) {
    try { dbExecute(`ALTER TABLE messages ADD COLUMN ${col}`); } catch { /* column already exists */ }
  }
  dbExecute(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(listing_id, buyer_address)`);
  _ensured = true;
}

function shape(m) {
  return {
    id: m.id,
    listingId: m.listing_id,
    buyer: m.buyer_address || null,
    asset: m.asset || null,
    sender: m.sender, // 'buyer' | 'artist'
    body: m.body,
    reported: !!m.reported,
    createdAt: m.created_at,
  };
}

// Strip links (phishing/drainer vector) and flag off-platform contact lures.
function sanitize(body) {
  let clean = String(body || '').slice(0, 1000);
  let flagged = false;
  clean = clean.replace(/\b(?:https?:\/\/|www\.)\S+/gi, () => { flagged = true; return '[link removed]'; });
  clean = clean.replace(/\b[a-z0-9][a-z0-9.-]*\.(?:com|net|io|xyz|org|app|co|me|gg|tg|link|click|shop|fun|site)(?:\/\S*)?/gi, () => { flagged = true; return '[link removed]'; });
  if (/\b(t\.me|telegram|whatsapp|discord|signal|instagram|dm me|off[- ]?platform)\b/i.test(clean)) flagged = true;
  return { clean: clean.trim(), flagged };
}

// Standing = the buyer has a real action on this piece (offer or order). This is
// the anti-spam gate: no anonymous posting, no messaging without skin in the game.
function hasStanding(listingId, buyerAddress) {
  const a = String(buyerAddress || '').trim();
  if (!a || !listingId) return false;
  try {
    if (dbQuery(`SELECT 1 FROM offers WHERE listing_id = ? AND (buyer_delivery_address = ? OR buyer_address = ?) LIMIT 1`, [listingId, a, a]).length) return true;
  } catch { /* offers table may not exist yet */ }
  try {
    if (dbQuery(`SELECT 1 FROM checkout_orders WHERE listing_id = ? AND buyer_delivery_address = ? LIMIT 1`, [listingId, a]).length) return true;
  } catch { /* */ }
  return false;
}

// The private thread for one buyer on one piece.
export async function listThread(listingId, buyerAddress) {
  ensure();
  const id = String(listingId || '').trim();
  const a = String(buyerAddress || '').trim();
  if (!id || !a) return [];
  return dbQuery(`SELECT * FROM messages WHERE listing_id = ? AND buyer_address = ? ORDER BY created_at ASC LIMIT 200`, [id, a]).map(shape);
}

// Operator view: every thread on a listing (so the artist can see/answer them).
export async function listThreadsForListing(listingId) {
  ensure();
  const id = String(listingId || '').trim();
  if (!id) return [];
  return dbQuery(`SELECT * FROM messages WHERE listing_id = ? ORDER BY created_at ASC LIMIT 500`, [id]).map(shape);
}

// Buyer post — gated on standing (offer/order). Sanitizes the body.
export async function postBuyerMessage(body) {
  ensure();
  const listingId = String(body.listing || '').trim();
  const buyer = String(body.buyerAddress || '').trim();
  const { clean } = sanitize(body.body);
  if (!listingId || !buyer || !clean) return { error: 'listing, your address, and a message are required', code: 400 };
  const row = await getListingRow(listingId);
  if (!row) return { error: 'listing not found', code: 404 };
  if (!hasStanding(listingId, buyer)) {
    return { error: 'make an offer on this piece to start a conversation with the artist', code: 403 };
  }
  const id = randomUUID();
  dbExecute(
    `INSERT INTO messages (id, listing_id, buyer_address, asset, artist_address, sender, sender_address, body, reported) VALUES (?, ?, ?, ?, ?, 'buyer', ?, ?, 0)`,
    [id, listingId, buyer, row.asset, row.artist_xcp_address, buyer, clean]
  );
  return { message: shape({ id, listing_id: listingId, buyer_address: buyer, asset: row.asset, sender: 'buyer', body: clean, created_at: new Date().toISOString() }) };
}

// Artist reply (operator-gated) — posts into a specific buyer's private thread.
export async function postArtistMessage(body) {
  ensure();
  const listingId = String(body.listing || '').trim();
  const buyer = String(body.buyerAddress || '').trim();
  const { clean } = sanitize(body.body);
  if (!listingId || !buyer || !clean) return { error: 'listing, buyer address, and a message are required', code: 400 };
  const row = await getListingRow(listingId);
  const id = randomUUID();
  dbExecute(
    `INSERT INTO messages (id, listing_id, buyer_address, asset, artist_address, sender, sender_address, body, reported) VALUES (?, ?, ?, ?, ?, 'artist', ?, ?, 0)`,
    [id, listingId, buyer, row ? row.asset : null, row ? row.artist_xcp_address : null, row ? row.artist_xcp_address : null, clean]
  );
  return { message: shape({ id, listing_id: listingId, buyer_address: buyer, asset: row ? row.asset : null, sender: 'artist', body: clean, created_at: new Date().toISOString() }) };
}

// Anyone can report a message; operator reviews reported=1 and can ban the address.
export async function reportMessage(id) {
  ensure();
  const mid = String(id || '').trim();
  if (!mid) return { error: 'message id required', code: 400 };
  dbExecute(`UPDATE messages SET reported = 1 WHERE id = ?`, [mid]);
  return { ok: true };
}
