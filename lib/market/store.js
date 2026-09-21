// Marketplace DB access — replaces the artifact's Dashboard-API lib/db.js with
// the repo's own SQLite (node:sqlite via getDb()). Synchronous under the hood;
// exposed as the same dbQuery/dbExecute(sql, params) surface the ported code
// expects (callers may `await` — awaiting a plain value is a no-op).
//
// The 3 marketplace tables are created lazily on first use (idempotent), so the
// port is fully additive and never touches the core token schema.

import { getDb } from '../db.js';

let _ensured = false;
function ensure(db) {
  if (_ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      asset TEXT NOT NULL,
      artist_xcp_address TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      prices TEXT,
      pay_addresses TEXT NOT NULL,
      base_price_usd REAL,
      manual_prices TEXT,
      release_method TEXT NOT NULL DEFAULT 'sign',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkout_orders (
      id TEXT PRIMARY KEY,
      token_name TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount TEXT,
      txid TEXT UNIQUE,
      buyer_delivery_address TEXT,
      buyer_auth_address TEXT,
      listing_id TEXT,
      artist_address TEXT,
      fee_kind TEXT,
      fee_amount TEXT,
      fee_to TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS release_intents (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      mechanism TEXT NOT NULL,
      chain TEXT,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_authority',
      delivery_txid TEXT,
      fulfilled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(order_id) REFERENCES checkout_orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_txid ON checkout_orders(txid);
    CREATE INDEX IF NOT EXISTS idx_orders_artist ON checkout_orders(artist_address);
    CREATE INDEX IF NOT EXISTS idx_intents_order ON release_intents(order_id);
  `);
  _ensured = true;
}

export function dbQuery(sql, params = []) {
  const db = getDb();
  ensure(db);
  return db.prepare(sql).all(...params);
}

export function dbExecute(sql, params = []) {
  const db = getDb();
  ensure(db);
  return db.prepare(sql).run(...params);
}
