import { NextResponse } from 'next/server';

/**
 * GET /api/check-unat?address=<bitcoin_address>
 *
 * Checks whether a Bitcoin address holds any UNATPEPE tokens (TAP protocol on Bitcoin).
 * Returns: { ok: true, holdsUnat: boolean, balance: number, discount: number }
 *
 * UNATPEPE is a TAP protocol token (not Counterparty).
 * Data source: api.tap3.link — the Tapalytics backend API.
 */

const UNAT_TOKEN_NAME  = (process.env.UNAT_TOKEN_NAME || 'unatpepe').toLowerCase();
const DISCOUNT_PERCENT = 20;

function isValidBitcoinAddress(addr) {
  return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(addr);
}

async function checkTap3Balance(address) {
  const res = await fetch(`https://api.tap3.link/address/${address}`, {
    headers: { 'User-Agent': 'UNATRARE/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`tap3.link returned ${res.status}`);
  const json = await res.json();
  const balances = Array.isArray(json.token_balances) ? json.token_balances : [];
  const entry = balances.find(b => (b.tick ?? '').toLowerCase() === UNAT_TOKEN_NAME);
  if (!entry) return 0;
  // available_balance is the human-readable pre-normalized value
  return Number(entry.available_balance ?? entry.balance ?? 0);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();

  if (!address) {
    return NextResponse.json({ ok: false, error: 'address required' }, { status: 400 });
  }

  if (!isValidBitcoinAddress(address)) {
    return NextResponse.json({ ok: false, error: 'invalid Bitcoin address' }, { status: 400 });
  }

  let balance = 0;
  let errorMsg = null;

  try {
    balance = await checkTap3Balance(address);
  } catch (err) {
    errorMsg = err.message;
  }

  const holdsUnat = balance > 0;
  const discount  = holdsUnat ? DISCOUNT_PERCENT : 0;

  return NextResponse.json({
    ok:        true,
    holdsUnat,
    balance,
    discount,
    token:     UNAT_TOKEN_NAME,
    source:    'tap3.link',
    ...(errorMsg ? { warning: errorMsg } : {}),
  });
}
