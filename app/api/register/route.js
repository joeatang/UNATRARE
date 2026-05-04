import { NextResponse } from 'next/server';
import { verifyBitcoinMessage } from '../../../lib/btcVerify.mjs';
import { getDb } from '../../../lib/db';

/**
 * POST /api/register
 *
 * Registers a UNATPEPE holder.
 * Body: { btcAddress, xcpAddress, signature }
 *
 * The message that must be signed is:
 *   UNATRARE:REGISTER:<btcAddress>
 *
 * Steps:
 *   1. Validate inputs
 *   2. Verify BIP-137 signature (proves ownership of btcAddress)
 *   3. Check UNATPEPE balance via tap3.link
 *   4. Upsert into holders table
 *
 * Returns: { ok, registered, balance, discount, alreadyRegistered }
 */

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // P2PKH
const XCP_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // same format on Counterparty
const UNAT_TOKEN = (process.env.UNAT_TOKEN_NAME || 'unatpepe').toLowerCase();
const DISCOUNT   = parseInt(process.env.UNAT_DISCOUNT_PERCENT || '20', 10);

function buildChallenge(btcAddress) {
  return `UNATRARE:REGISTER:${btcAddress}`;
}

async function fetchBalance(address) {
  const res = await fetch(`https://api.tap3.link/address/${address}`, {
    headers: { 'User-Agent': 'UNATRARE/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`tap3.link ${res.status}`);
  const json = await res.json();
  const balances = Array.isArray(json.token_balances) ? json.token_balances : [];
  const entry = balances.find(b => (b.tick ?? '').toLowerCase() === UNAT_TOKEN);
  return Number(entry?.available_balance ?? entry?.balance ?? 0);
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { btcAddress, xcpAddress, signature } = body || {};

  // ── Validate inputs ──────────────────────────────────────────────────
  if (!btcAddress || !signature) {
    return NextResponse.json({ ok: false, error: 'btcAddress and signature are required' }, { status: 400 });
  }

  if (!ADDR_RE.test(btcAddress)) {
    return NextResponse.json({ ok: false, error: 'btcAddress must be a legacy Bitcoin P2PKH address (starts with 1)' }, { status: 422 });
  }

  // xcpAddress is optional — defaults to btcAddress if not provided (same address)
  const resolvedXcp = xcpAddress?.trim() || btcAddress;
  if (!XCP_ADDR_RE.test(resolvedXcp)) {
    return NextResponse.json({ ok: false, error: 'xcpAddress must be a valid Bitcoin address' }, { status: 422 });
  }

  // ── Verify signature ─────────────────────────────────────────────────
  const challenge = buildChallenge(btcAddress);
  const candidates = [challenge, challenge + '\r\n', challenge + '\n', challenge + '\r'];
  let sigResult;
  for (const c of candidates) {
    sigResult = verifyBitcoinMessage(btcAddress, c, signature.trim());
    if (sigResult.ok) break;
  }
  if (!sigResult.ok) {
    return NextResponse.json({ ok: false, error: 'Signature verification failed — sign the exact message shown with the BTC address you entered' }, { status: 422 });
  }

  // ── Check UNATPEPE balance ───────────────────────────────────────────
  let balance = 0;
  let balanceWarning = null;
  try {
    balance = await fetchBalance(btcAddress);
  } catch (err) {
    // Don't block registration if TAP API is down — flag it
    balanceWarning = `Could not verify balance: ${err.message}`;
  }

  const holdsUnat = balance > 0;
  const appliedDiscount = holdsUnat ? DISCOUNT : 0;

  // ── Upsert into holders table ────────────────────────────────────────
  const db = getDb();

  const existing = db.prepare('SELECT btc_address, registered_at FROM holders WHERE btc_address = ?').get(btcAddress);
  const alreadyRegistered = !!existing;

  db.prepare(`
    INSERT INTO holders (btc_address, xcp_address, tap_balance, discount, last_checked)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(btc_address) DO UPDATE SET
      xcp_address  = excluded.xcp_address,
      tap_balance  = excluded.tap_balance,
      discount     = excluded.discount,
      last_checked = unixepoch()
  `).run(btcAddress, resolvedXcp, balance, appliedDiscount);

  return NextResponse.json({
    ok: true,
    registered:        true,
    alreadyRegistered,
    btcAddress,
    xcpAddress:        resolvedXcp,
    holdsUnat,
    balance,
    discount:          appliedDiscount,
    token:             UNAT_TOKEN,
    ...(balanceWarning ? { balanceWarning } : {}),
  });
}

/**
 * GET /api/register?address=<btcAddress>
 * Check if an address is already registered and its current status.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();

  if (!address || !ADDR_RE.test(address)) {
    return NextResponse.json({ ok: false, error: 'Valid address required' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM holders WHERE btc_address = ?').get(address);

  if (!row) {
    return NextResponse.json({ ok: true, registered: false, address });
  }

  return NextResponse.json({
    ok:              true,
    registered:      true,
    btcAddress:      row.btc_address,
    xcpAddress:      row.xcp_address,
    tapBalance:      row.tap_balance,
    discount:        row.discount,
    registeredAt:    row.registered_at,
    lastChecked:     row.last_checked,
  });
}
