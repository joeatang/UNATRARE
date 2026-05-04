/**
 * db.js — SQLite cache layer
 *
 * Uses Node.js built-in sqlite module (available Node v22.5+, stable in Node v24).
 * No native compilation needed — works on any platform out of the box.
 *
 * This database is a CACHE only. It is NOT the source of truth.
 * Source of truth is the TRAC subnet (Phase 0: flat JSON files on R2).
 *
 * The token record drives what /c/TOKENNAME returns:
 *   status = 'pending'  → {"status":"pending"}  (art hidden)
 *   status = 'approved' → full CIP-25 v2.0.0 JSON
 *   status = 'rejected' → {"status":"rejected"}
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'unatrare.db');

let _db = null;

export function getDb() {
  if (_db) return _db;
  // Ensure data directory exists
  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tokens (
      token_name        TEXT PRIMARY KEY,
      display_title     TEXT NOT NULL DEFAULT '',
      artist_address    TEXT NOT NULL DEFAULT '',
      artist_handle     TEXT NOT NULL DEFAULT '',
      description       TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected')),
      series            INTEGER NOT NULL DEFAULT 1,
      card_number       INTEGER,
      art_url           TEXT NOT NULL DEFAULT '',
      art_mime          TEXT NOT NULL DEFAULT '',
      ord_inscription   TEXT NOT NULL DEFAULT '',
      submitted_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      judged_at         INTEGER,
      rejection_reason  TEXT NOT NULL DEFAULT '',
      payment_txid      TEXT NOT NULL DEFAULT '',
      payment_currency  TEXT NOT NULL DEFAULT '',
      judge_score       REAL,
      owner_address     TEXT NOT NULL DEFAULT ''
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
    CREATE INDEX IF NOT EXISTS idx_tokens_series ON tokens(series, card_number);
    CREATE INDEX IF NOT EXISTS idx_tokens_owner  ON tokens(owner_address);
  `);

  // ── Governance tables ──────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type        TEXT NOT NULL DEFAULT 'general',
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      closes_at   INTEGER,
      result      TEXT NOT NULL DEFAULT '',
      created_by  TEXT NOT NULL DEFAULT 'admin'
    ) STRICT;

    CREATE TABLE IF NOT EXISTS votes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id),
      voter_addr  TEXT NOT NULL,
      choice      TEXT NOT NULL,
      weight      INTEGER NOT NULL DEFAULT 1,
      voted_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(proposal_id, voter_addr)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
    CREATE INDEX IF NOT EXISTS idx_votes_proposal   ON votes(proposal_id);
  `);

  // ── Holders table ──────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS holders (
      btc_address   TEXT PRIMARY KEY,
      xcp_address   TEXT NOT NULL DEFAULT '',
      tap_balance   REAL NOT NULL DEFAULT 0,
      discount      INTEGER NOT NULL DEFAULT 20,
      registered_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_checked  INTEGER NOT NULL DEFAULT (unixepoch()),
      notes         TEXT NOT NULL DEFAULT ''
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_holders_xcp ON holders(xcp_address);
  `);

  // ── Non-destructive migrations for existing DBs ───────────────────────
  const cols = db.prepare("PRAGMA table_info(tokens)").all().map(r => r.name);
  if (!cols.includes('judge_score')) {
    db.exec("ALTER TABLE tokens ADD COLUMN judge_score REAL");
  }
  if (!cols.includes('owner_address')) {
    db.exec("ALTER TABLE tokens ADD COLUMN owner_address TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.includes('supply')) {
    db.exec("ALTER TABLE tokens ADD COLUMN supply INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.includes('cp_version')) {
    db.exec("ALTER TABLE tokens ADD COLUMN cp_version INTEGER NOT NULL DEFAULT 1");
  }
  if (!cols.includes('art_hash')) {
    db.exec("ALTER TABLE tokens ADD COLUMN art_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.includes('judge_notes')) {
    db.exec("ALTER TABLE tokens ADD COLUMN judge_notes TEXT NOT NULL DEFAULT ''");
  }
}
