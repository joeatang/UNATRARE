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

  // ── Settings table ─────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    ) STRICT;
    INSERT OR IGNORE INTO settings (key, value) VALUES ('early_access_mode', '0');
  `);

  // ── Non-destructive migrations for existing DBs ───────────────────────
  const cols = db.prepare("PRAGMA table_info(tokens)").all().map(r => r.name);
  if (!cols.includes('judge_score')) {
    db.exec("ALTER TABLE tokens ADD COLUMN judge_score REAL");
  }
  if (!cols.includes('owner_address')) {
    db.exec("ALTER TABLE tokens ADD COLUMN owner_address TEXT NOT NULL DEFAULT ''");
  }
  // Index on owner_address — created after the column migration to handle existing DBs
  db.exec("CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens(owner_address)");
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
  // revealed_at: set by admin "drop" action. NULL = art hidden (mystery pack).
  // approved + revealed_at IS NULL = certified but not yet dropped publicly.
  // approved + revealed_at IS NOT NULL = fully public, art visible.
  if (!cols.includes('revealed_at')) {
    db.exec("ALTER TABLE tokens ADD COLUMN revealed_at INTEGER");
    // Tokens already approved before this migration get revealed immediately
    // (back-fill so nothing breaks for existing live tokens)
    db.exec("UPDATE tokens SET revealed_at = judged_at WHERE status = 'approved' AND judged_at IS NOT NULL");
  }
  // is_demo: 1 = sample/test card — shown in feed with SAMPLE badge, excluded from directory/stats
  if (!cols.includes('is_demo')) {
    db.exec("ALTER TABLE tokens ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0");
  }
  // directory_hidden: 1 = excluded from public directory (still visible in feed/mempool)
  if (!cols.includes('directory_hidden')) {
    db.exec("ALTER TABLE tokens ADD COLUMN directory_hidden INTEGER NOT NULL DEFAULT 0");
  }
  // series0_code_used: invite code used at submission time (empty = none)
  if (!cols.includes('series0_code_used')) {
    db.exec("ALTER TABLE tokens ADD COLUMN series0_code_used TEXT NOT NULL DEFAULT ''");
  }
  // council_certified: 1 = approved by AI Pepe Council (rejudge threshold pass), 0 = admin manual
  if (!cols.includes('council_certified')) {
    db.exec("ALTER TABLE tokens ADD COLUMN council_certified INTEGER NOT NULL DEFAULT 0");
  }
  // Backfill: any token already approved with a judge_score earned the badge
  db.exec(
    "UPDATE tokens SET council_certified=1 WHERE status='approved' AND judge_score IS NOT NULL AND judge_score > 0 AND council_certified=0"
  );

  // audio/video supplemental media (optional — stored alongside primary image art)
  if (!cols.includes('audio_url'))  db.exec("ALTER TABLE tokens ADD COLUMN audio_url  TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('audio_hash')) db.exec("ALTER TABLE tokens ADD COLUMN audio_hash TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('audio_mime')) db.exec("ALTER TABLE tokens ADD COLUMN audio_mime TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('video_url'))  db.exec("ALTER TABLE tokens ADD COLUMN video_url  TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('video_hash')) db.exec("ALTER TABLE tokens ADD COLUMN video_hash TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('video_mime')) db.exec("ALTER TABLE tokens ADD COLUMN video_mime TEXT NOT NULL DEFAULT ''");

  // ── Series 0 invite codes ──────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS series0_codes (
      code       TEXT PRIMARY KEY,
      note       TEXT NOT NULL DEFAULT '',
      used_by    TEXT NOT NULL DEFAULT '',
      used_at    INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    ) STRICT;
  `);

  // ── UNATAMOTO claim eligibility list ──────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      address        TEXT PRIMARY KEY,
      unatpepe_qty   INTEGER NOT NULL DEFAULT 0,
      softpwar_qty   INTEGER NOT NULL DEFAULT 0,
      verified_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      distributed    INTEGER NOT NULL DEFAULT 0,
      distributed_at INTEGER,
      notes          TEXT NOT NULL DEFAULT ''
    ) STRICT;
  `);

  // ── Artist interest / application sign-ups ─────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS artist_applications (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      handle       TEXT NOT NULL,
      platform     TEXT NOT NULL CHECK(platform IN ('x', 'telegram')),
      submitted_at INTEGER NOT NULL DEFAULT (unixepoch()),
      notes        TEXT NOT NULL DEFAULT ''
    ) STRICT;
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_app_handle_platform
           ON artist_applications(handle, platform);`);

  // ── Art Drops (Claim Chamber) ──────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS art_drops (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      token_name        TEXT NOT NULL UNIQUE,
      title             TEXT NOT NULL DEFAULT '',
      artist_handle     TEXT NOT NULL DEFAULT '',
      description       TEXT NOT NULL DEFAULT '',
      claim_type        TEXT NOT NULL DEFAULT 'support'
                        CHECK(claim_type IN ('cultural','support')),
      support_tiers     TEXT NOT NULL DEFAULT '[3,6,9]',
      nat_price_billion REAL NOT NULL DEFAULT 125,
      supply_total      INTEGER NOT NULL DEFAULT 0,
      supply_remaining  INTEGER NOT NULL DEFAULT 0,
      window_opens_at   INTEGER,
      window_closes_at  INTEGER,
      status            TEXT NOT NULL DEFAULT 'upcoming'
                        CHECK(status IN ('upcoming','active','closed','distributed')),
      nat_address       TEXT NOT NULL DEFAULT '',
      series            INTEGER NOT NULL DEFAULT 0,
      card_number       INTEGER,
      created_at        INTEGER NOT NULL DEFAULT (unixepoch())
    ) STRICT;

    CREATE TABLE IF NOT EXISTS drop_claims (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      drop_id        INTEGER NOT NULL REFERENCES art_drops(id),
      tap_address    TEXT NOT NULL,
      cp_address     TEXT NOT NULL DEFAULT '',
      claim_type     TEXT NOT NULL DEFAULT 'support'
                     CHECK(claim_type IN ('cultural','support')),
      support_tier   INTEGER NOT NULL DEFAULT 0,
      nat_amount     INTEGER NOT NULL DEFAULT 0,
      txid           TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'claimed'
                     CHECK(status IN (
                       'eligible','claimed','awaiting_payment',
                       'awaiting_distribution','sent','expired'
                     )),
      unatpepe_qty   INTEGER NOT NULL DEFAULT 0,
      claimed_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      notes          TEXT NOT NULL DEFAULT '',
      UNIQUE(drop_id, tap_address)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_drop_claims_drop ON drop_claims(drop_id);
    CREATE INDEX IF NOT EXISTS idx_drop_claims_addr ON drop_claims(tap_address);
  `);

  // Seed DROP 001 — SOFTPWAR
  const drop001 = db.prepare("SELECT id FROM art_drops WHERE token_name='SOFTPWAR'").get();
  if (!drop001) {
    db.prepare(`
      INSERT INTO art_drops (
        token_name, title, artist_handle, description,
        claim_type, support_tiers, nat_price_billion,
        supply_total, supply_remaining, status, series
      ) VALUES (
        'SOFTPWAR', 'SOFTPWAR', 'JNA',
        'The network stays honest because it pays to, not because it has to. Pepe Projection is the purest form of honesty.',
        'support', '[3,6,9]', 125,
        0, 0, 'upcoming', 0
      )
    `).run();
  }

  // ── Network nodes registry ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      pubkey               TEXT PRIMARY KEY,
      btc_address          TEXT NOT NULL DEFAULT '',
      xcp_address          TEXT NOT NULL DEFAULT '',
      tap_address          TEXT NOT NULL DEFAULT '',
      registered_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_heartbeat       INTEGER,
      total_heartbeats     INTEGER NOT NULL DEFAULT 0,
      is_genesis           INTEGER NOT NULL DEFAULT 0,
      genesis_provisional  INTEGER NOT NULL DEFAULT 0
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_nodes_registered ON nodes(registered_at);
    CREATE INDEX IF NOT EXISTS idx_nodes_xcp ON nodes(xcp_address);
  `);

  // ── Genesis grants — one row per XCP address (the Sybil-resistant identity unit)
  // genesis_provisional=1 means registered but 7-day confirmation window not yet complete.
  // genesis_confirmed_at IS NOT NULL means fully confirmed genesis status.
  // UNIQUE on xcp_address: running 10 nodes under one XCP identity = 1 genesis grant.
  db.exec(`
    CREATE TABLE IF NOT EXISTS genesis_grants (
      xcp_address         TEXT PRIMARY KEY,
      btc_address         TEXT NOT NULL DEFAULT '',
      first_node_pubkey   TEXT NOT NULL DEFAULT '',
      provisional_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      genesis_confirmed_at INTEGER,
      slot_number         INTEGER
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_genesis_slot ON genesis_grants(slot_number);
  `);

  // ── Non-destructive migrations for existing nodes table ──────
  const nodesCols = db.prepare("PRAGMA table_info(nodes)").all().map(c => c.name);
  if (!nodesCols.includes('xcp_address')) {
    db.exec("ALTER TABLE nodes ADD COLUMN xcp_address TEXT NOT NULL DEFAULT ''");
  }
  if (!nodesCols.includes('tap_address')) {
    db.exec("ALTER TABLE nodes ADD COLUMN tap_address TEXT NOT NULL DEFAULT ''");
  }
  if (!nodesCols.includes('genesis_provisional')) {
    db.exec("ALTER TABLE nodes ADD COLUMN genesis_provisional INTEGER NOT NULL DEFAULT 0");
  }

  // ── Backfill: existing is_genesis=1 nodes get a confirmed grant ──
  // This preserves any nodes that were already marked genesis before this migration.
  const existingGenesis = db.prepare(
    "SELECT pubkey, xcp_address, btc_address, registered_at FROM nodes WHERE is_genesis = 1"
  ).all();
  let slotNum = db.prepare("SELECT COUNT(*) as n FROM genesis_grants").get().n;
  for (const node of existingGenesis) {
    const xcpKey = node.xcp_address || node.btc_address || node.pubkey;
    const existing = db.prepare("SELECT xcp_address FROM genesis_grants WHERE xcp_address = ?").get(xcpKey);
    if (!existing) {
      slotNum++;
      db.prepare(`
        INSERT OR IGNORE INTO genesis_grants
          (xcp_address, btc_address, first_node_pubkey, provisional_at, genesis_confirmed_at, slot_number)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(xcpKey, node.btc_address, node.pubkey, node.registered_at, node.registered_at, slotNum);
    }
  }

  // ── PEPE VAULT — hosted art assets ───────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_assets (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      art_hash         TEXT NOT NULL UNIQUE,
      token_name       TEXT NOT NULL DEFAULT '',
      asset_name       TEXT NOT NULL DEFAULT '',
      description      TEXT NOT NULL DEFAULT '',
      owner_xcp        TEXT NOT NULL DEFAULT '',
      owner_btc        TEXT NOT NULL DEFAULT '',
      art_mime         TEXT NOT NULL DEFAULT 'image/png',
      file_size        INTEGER NOT NULL DEFAULT 0,
      json_url         TEXT NOT NULL DEFAULT '',
      art_url          TEXT NOT NULL DEFAULT '',
      fee_paid         INTEGER NOT NULL DEFAULT 0,
      fee_currency     TEXT NOT NULL DEFAULT '',
      fee_tx           TEXT NOT NULL DEFAULT '',
      is_promo         INTEGER NOT NULL DEFAULT 0,
      uploaded_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_vault_uploaded ON vault_assets(uploaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vault_owner ON vault_assets(owner_xcp);
  `);

  // ── Vault social columns (idempotent migration) ───────────────
  for (const col of [
    "twitter  TEXT NOT NULL DEFAULT ''",
    "telegram TEXT NOT NULL DEFAULT ''",
  ]) {
    try { db.exec(`ALTER TABLE vault_assets ADD COLUMN ${col}`); } catch {}
  }

  // ── PEPE VAULT promo period config ───────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    ) STRICT;
  `);
  // Seed promo defaults if not set
  const promoRow = db.prepare("SELECT value FROM vault_config WHERE key = 'promo_active'").get();
  if (!promoRow) {
    db.prepare("INSERT INTO vault_config (key, value) VALUES ('promo_active', '1')").run();
    db.prepare("INSERT OR IGNORE INTO vault_config (key, value) VALUES ('promo_ends_at', '0')").run();
    db.prepare("INSERT OR IGNORE INTO vault_config (key, value) VALUES ('promo_max_uploads', '500')").run();
  }

  // ── Counterparty Archive — historical collection mirror ────────
  // Completely isolated from the UNATRARE directory / vault pipeline.
  // fetch_status lifecycle: pending → fetched | failed | skipped
  db.exec(`
    CREATE TABLE IF NOT EXISTS archived_tokens (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_name          TEXT NOT NULL UNIQUE,
      collection          TEXT NOT NULL DEFAULT '',
      series_number       INTEGER,
      card_number         INTEGER,
      display_title       TEXT NOT NULL DEFAULT '',
      description         TEXT NOT NULL DEFAULT '',
      artist_address      TEXT NOT NULL DEFAULT '',
      image_url_original  TEXT NOT NULL DEFAULT '',
      image_url_type      TEXT NOT NULL DEFAULT '',
      arweave_txid        TEXT NOT NULL DEFAULT '',
      ipfs_cid            TEXT NOT NULL DEFAULT '',
      art_hash            TEXT NOT NULL DEFAULT '',
      art_mime            TEXT NOT NULL DEFAULT '',
      file_size           INTEGER NOT NULL DEFAULT 0,
      metadata_json       TEXT NOT NULL DEFAULT '{}',
      fetch_status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK(fetch_status IN ('pending','fetched','failed','skipped')),
      fetch_error         TEXT NOT NULL DEFAULT '',
      scraped_at          INTEGER,
      source_cp_url       TEXT NOT NULL DEFAULT ''
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_archive_collection ON archived_tokens(collection);
    CREATE INDEX IF NOT EXISTS idx_archive_status     ON archived_tokens(fetch_status);
    CREATE INDEX IF NOT EXISTS idx_archive_scraped    ON archived_tokens(scraped_at DESC);
    CREATE INDEX IF NOT EXISTS idx_archive_series     ON archived_tokens(collection, series_number, card_number);
  `);
  // Idempotent column additions (ALTER TABLE ignores "already exists" errors)
  try { db.exec(`ALTER TABLE archived_tokens ADD COLUMN artist_name TEXT NOT NULL DEFAULT ''`); } catch {}

  // ── Artist archive profiles ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      btc_address    TEXT PRIMARY KEY,
      alias          TEXT NOT NULL DEFAULT '',
      anonymous      INTEGER NOT NULL DEFAULT 0,
      pfp_url        TEXT NOT NULL DEFAULT '',
      bio            TEXT NOT NULL DEFAULT '',
      website        TEXT NOT NULL DEFAULT '',
      twitter_handle TEXT NOT NULL DEFAULT '',
      past_projects  TEXT NOT NULL DEFAULT '',
      cp_collections TEXT NOT NULL DEFAULT '[]',
      archive_index  INTEGER,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
    ) STRICT;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_archive_index ON artists(archive_index);
  `);
}
