// Buyer↔artist messages (Phase K, v1) — a per-listing thread so buyers can ask
// about a piece and artists can answer, tied to the non-custodial marketplace.
//
// This is the SERVER-BACKED v1 (testable today). The roadmap upgrade is a pure
// Holepunch P2P transport (no server) once it can be tested on the live node
// mesh. Additive: the `messages` table is created lazily; gated by market_messages.

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
      asset TEXT,
      sender TEXT NOT NULL,
      sender_address TEXT,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  dbExecute(`CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages(listing_id)`);
  _ensured = true;
}

function shape(m) {
  return {
    id: m.id,
    listingId: m.listing_id,
    asset: m.asset,
    sender: m.sender, // 'buyer' | 'artist'
    address: m.sender_address || null,
    body: m.body,
    createdAt: m.created_at,
  };
}

export async function listThread(listingId) {
  ensure();
  const id = String(listingId || '').trim();
  if (!id) return [];
  return dbQuery(`SELECT * FROM messages WHERE listing_id = ? ORDER BY created_at ASC LIMIT 200`, [id]).map(shape);
}

// Post a message. `sender` is 'buyer' (public, flag-gated) or 'artist' (operator).
export async function postMessage(body) {
  ensure();
  const listingId = String(body.listing || '').trim();
  const text = String(body.body || '').trim().slice(0, 1000);
  const sender = body.sender === 'artist' ? 'artist' : 'buyer';
  const address = String(body.address || '').trim();
  if (!listingId || !text) return { error: 'listing and a message are required', code: 400 };
  const row = await getListingRow(listingId);
  if (!row) return { error: 'listing not found', code: 404 };
  const id = randomUUID();
  dbExecute(
    `INSERT INTO messages (id, listing_id, asset, sender, sender_address, body) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, listingId, row.asset, sender, address, text]
  );
  return { message: shape({ id, listing_id: listingId, asset: row.asset, sender, sender_address: address, body: text, created_at: new Date().toISOString() }) };
}
