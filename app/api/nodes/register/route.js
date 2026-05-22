/**
 * POST /api/nodes/register
 *
 * Registers a node on the UNATRARE network.
 *
 * Genesis slot logic (Sybil-resistant design):
 * ─────────────────────────────────────────────
 * - Genesis is granted per XCP *address*, not per node pubkey.
 *   One person running 10 nodes with the same XCP address gets 1 genesis grant.
 * - The first 100 unique XCP addresses to register + complete 7 days of
 *   continuous heartbeats earn confirmed GENESIS status.
 * - Registration puts the XCP address in "provisional" status immediately
 *   (slot reserved, not yet confirmed). If the node goes dark before 7 days,
 *   the slot is freed for others.
 * - IP rate limit: max 3 registrations per IP per 24 hours (soft anti-spam).
 *
 * Required body fields:
 *   pubkey      — Hypercore public key (64-char hex)
 *   xcp_address — Counterparty address (required — the Sybil-resistant identity unit)
 *
 * Optional:
 *   btc_address — Bitcoin address for identity / reward routing
 *   tap_address — TAP/Bitcoin address for NAT rewards
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { refreshUnatpepeNodeTier } from '../../../../lib/tapApi.js';

const GENESIS_CAP     = 100;
const MAX_ADDR_LEN    = 100;
const IP_LIMIT_COUNT  = 3;
const IP_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours ms

// In-memory IP rate limiter — resets on server restart (acceptable for soft limit)
const ipRegistry = new Map();

function checkIpLimit(ip) {
  if (!ip || ip === 'unknown') return { allowed: true };
  const now = Date.now();
  const recent = (ipRegistry.get(ip) || []).filter(t => now - t < IP_LIMIT_WINDOW);
  if (recent.length >= IP_LIMIT_COUNT) {
    return { allowed: false, resetIn: Math.ceil((recent[0] + IP_LIMIT_WINDOW - now) / 60000) };
  }
  recent.push(now);
  ipRegistry.set(ip, recent);
  return { allowed: true };
}

// ── Address + pubkey validators ──────────────────────────────────────────────
const LEGACY_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BECH32_ADDR_RE = /^(bc1|BC1)[a-zA-HJ-NP-Z0-9]{6,87}$/;
const HEX64_RE       = /^[0-9a-f]{64}$/;

function isValidBtcAddress(addr) {
  return LEGACY_ADDR_RE.test(addr) || BECH32_ADDR_RE.test(addr);
}

// ── Genesis state helper ─────────────────────────────────────────────────────
function getGenesisState(db, xcpAddress) {
  const { confirmed } = db.prepare(
    "SELECT COUNT(*) as confirmed FROM genesis_grants WHERE genesis_confirmed_at IS NOT NULL"
  ).get();
  const { provisional } = db.prepare(
    "SELECT COUNT(*) as provisional FROM genesis_grants WHERE genesis_confirmed_at IS NULL"
  ).get();
  const existing = db.prepare("SELECT * FROM genesis_grants WHERE xcp_address = ?").get(xcpAddress);
  return {
    confirmed,
    provisional,
    total: confirmed + provisional,
    existing,
    slotsAvailable: (confirmed + provisional) < GENESIS_CAP,
  };
}

export async function POST(req) {
  // ── IP rate limit ────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           || req.headers.get('x-real-ip')
           || 'unknown';
  const ipCheck = checkIpLimit(ip);
  if (!ipCheck.allowed) {
    return NextResponse.json({
      ok: false,
      error: `Too many registrations from this IP. Try again in ${ipCheck.resetIn} minutes.`,
    }, { status: 429 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const pubkey      = String(body.pubkey      || '').trim().toLowerCase();
  const btc_address = String(body.btc_address || '').trim();
  const xcp_address = String(body.xcp_address || '').trim();
  const tap_address = String(body.tap_address || '').trim();

  // ── Validate pubkey ──────────────────────────────────────────────────────
  if (!HEX64_RE.test(pubkey)) {
    return NextResponse.json({
      ok: false,
      error: 'Invalid pubkey — must be 64-char hex (Hypercore public key)',
    }, { status: 400 });
  }

  // ── xcp_address required ─────────────────────────────────────────────────
  if (!xcp_address) {
    return NextResponse.json({
      ok: false,
      error: 'xcp_address is required. Pass your Counterparty address with --xcp-address when starting the node.',
    }, { status: 400 });
  }
  if (!isValidBtcAddress(xcp_address)) {
    return NextResponse.json({
      ok: false,
      error: 'Invalid xcp_address — must be a Bitcoin/Counterparty address (1... 3... or bc1...)',
    }, { status: 422 });
  }

  // ── Optional address validation ──────────────────────────────────────────
  if (btc_address && !isValidBtcAddress(btc_address)) {
    return NextResponse.json({ ok: false, error: 'Invalid btc_address format' }, { status: 422 });
  }
  if (tap_address.length > MAX_ADDR_LEN) {
    return NextResponse.json({ ok: false, error: 'tap_address too long' }, { status: 400 });
  }

  // ── Database ─────────────────────────────────────────────────────────────
  try {
    const db  = getDb();
    const now = Date.now();

    // ── Re-registration (existing node) ──────────────────────────────────
    const existingNode = db.prepare('SELECT * FROM nodes WHERE pubkey = ?').get(pubkey);
    if (existingNode) {
      db.prepare(
        'UPDATE nodes SET btc_address = ?, xcp_address = ?, tap_address = ? WHERE pubkey = ?'
      ).run(
        btc_address || existingNode.btc_address,
        xcp_address,
        tap_address || existingNode.tap_address,
        pubkey
      );

      // Check if new/same XCP has a grant and if it's confirmed
      const grant = db.prepare('SELECT * FROM genesis_grants WHERE xcp_address = ?').get(xcp_address);
      const genesisState = getGenesisState(db, xcp_address);
      let is_genesis = !!existingNode.is_genesis;
      let genesis_provisional = !!existingNode.genesis_provisional;

      if (grant?.genesis_confirmed_at) {
        // XCP confirmed — ensure this node is marked genesis
        db.prepare('UPDATE nodes SET is_genesis = 1, genesis_provisional = 0 WHERE pubkey = ?').run(pubkey);
        is_genesis = true;
        genesis_provisional = false;
      } else if (!grant && genesisState.slotsAvailable) {
        // New XCP on re-registration, slot available
        db.prepare(`
          INSERT OR IGNORE INTO genesis_grants (xcp_address, btc_address, first_node_pubkey, provisional_at)
          VALUES (?, ?, ?, ?)
        `).run(xcp_address, btc_address || xcp_address, pubkey, now);
        db.prepare('UPDATE nodes SET genesis_provisional = 1 WHERE pubkey = ?').run(pubkey);
        genesis_provisional = true;
      }

      return NextResponse.json({
        ok: true, updated: true, is_genesis, genesis_provisional,
        genesis_confirmed: !!grant?.genesis_confirmed_at,
      });
    }

    // ── New node ──────────────────────────────────────────────────────────
    const genesisState = getGenesisState(db, xcp_address);
    const existingGrant = genesisState.existing;

    let genesis_provisional = 0;
    let is_genesis = 0;

    if (existingGrant?.genesis_confirmed_at) {
      // This XCP already earned genesis — additional nodes under same identity get it immediately
      is_genesis = 1;
    } else if (!existingGrant && genesisState.slotsAvailable) {
      // First node for this XCP address, slots open — reserve provisional slot
      db.prepare(`
        INSERT OR IGNORE INTO genesis_grants
          (xcp_address, btc_address, first_node_pubkey, provisional_at)
        VALUES (?, ?, ?, ?)
      `).run(xcp_address, btc_address || xcp_address, pubkey, now);
      genesis_provisional = 1;
    }
    // If existingGrant exists but unconfirmed: another node under same unconfirmed XCP —
    // no additional provisional. Will inherit is_genesis=1 when XCP confirms.

    db.prepare(`
      INSERT INTO nodes
        (pubkey, btc_address, xcp_address, tap_address, registered_at, is_genesis, genesis_provisional)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(pubkey, btc_address, xcp_address, tap_address, now, is_genesis, genesis_provisional);

    // UNATPEPE tier — check async so registration doesn't stall on tap3.link latency
    if (tap_address) {
      refreshUnatpepeNodeTier(getDb(), pubkey, tap_address).catch(() => {});
    }

    console.log(
      `[nodes/register] ${pubkey.slice(0, 8)}... xcp=${xcp_address.slice(0, 14)}... ` +
      `provisional=${genesis_provisional} confirmed_genesis=${is_genesis} ` +
      `slots: ${genesisState.confirmed}conf/${genesisState.provisional}prov/${GENESIS_CAP - genesisState.total}avail`
    );

    return NextResponse.json({
      ok: true,
      is_genesis: !!is_genesis,
      genesis_provisional: !!genesis_provisional,
      genesis_confirmed: false,
      genesis_slots: {
        confirmed:   genesisState.confirmed,
        provisional: genesisState.provisional,
        available:   GENESIS_CAP - genesisState.total,
      },
    });

  } catch (err) {
    console.error('[api/nodes/register]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Registration failed' }, { status: 500 });
  }
}
