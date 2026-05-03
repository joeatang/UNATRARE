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


// Validate address format (P2PKH / P2SH / bech32)
function isValidBitcoinAddress(addr) {
  return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(addr);
}

async function checkTokenscan(address) {
  const url = `https://tokenscan.io/api/balances/${address}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`tokenscan ${res.status}`);
  const json = await res.json();
  // tokenscan returns { data: [ { asset, quantity, ... }, ... ] }
  const balances = json.data ?? json;
  if (!Array.isArray(balances)) throw new Error('unexpected tokenscan response');
  const entry = balances.find(b => b.asset === UNAT_TOKEN_NAME);
  return entry ? Number(entry.quantity ?? entry.amount ?? 0) : 0;
}

async function checkCounterpartyRpc(address) {
  const body = {
    method: 'get_balances',
    params: {
      filters: [
        { field: 'address', op: '==', value: address },
        { field: 'asset',   op: '==', value: UNAT_TOKEN_NAME },
      ],
    },
    jsonrpc: '2.0',
    id: 1,
  };
  const res = await fetch('https://api.counterparty.io:4000/api/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`counterparty.io ${res.status}`);
  const json = await res.json();
  const results = json.result ?? [];
  const entry = results[0];
  return entry ? Number(entry.quantity ?? 0) : 0;
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
  let source = 'unknown';
  let errorMsg = null;

  // Try tokenscan first, fall back to counterparty.io
  try {
    balance = await checkTokenscan(address);
    source = 'tokenscan';
  } catch (e1) {
    try {
      balance = await checkCounterpartyRpc(address);
      source = 'counterparty.io';
    } catch (e2) {
      errorMsg = `tokenscan: ${e1.message} / counterparty.io: ${e2.message}`;
    }
  }

  const holdsUnat = balance > 0;
  const discount  = holdsUnat ? DISCOUNT_PERCENT : 0;

  return NextResponse.json({
    ok:        true,
    holdsUnat,
    balance,
    discount,
    token:     UNAT_TOKEN_NAME,
    source,
    ...(errorMsg ? { warning: errorMsg } : {}),
  });
}
