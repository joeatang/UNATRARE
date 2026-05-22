import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

const BURN_ADDRESS = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';
const XCP_V2 = 'https://api.counterparty.io/v2';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || !ADDR_RE.test(address)) {
    return NextResponse.json({ ok: false, error: 'Valid Bitcoin address required' }, { status: 400 });
  }

  // Fetch sends from Counterparty v2 API — returns sends where address is source or destination
  let sends = [];
  try {
    const res = await fetch(
      `${XCP_V2}/addresses/${encodeURIComponent(address)}/sends?asset=SOFTPWAR&limit=100`,
      { headers: { 'User-Agent': 'UNATRARE/1.0' }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'Counterparty API unavailable — try again shortly' }, { status: 503 });
    }
    const data = await res.json();
    const raw = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
    // Filter: sent FROM this address TO the burn address, any positive quantity
    sends = raw.filter(
      s => s.source === address && s.destination === BURN_ADDRESS && (s.quantity ?? 0) > 0,
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Could not reach Counterparty API: ${err.message}` }, { status: 503 });
  }

  if (sends.length === 0) {
    return NextResponse.json({
      ok: false,
      error: `No SOFTPWAR burn found from ${address.slice(0, 8)}…${address.slice(-6)}. Send 1 SOFTPWAR to ${BURN_ADDRESS} first, then wait for 1 confirmation.`,
    });
  }

  // Check each matching burn against the DB — find first unused TXID
  const db = getDb();
  for (const send of sends) {
    const txid = send.tx_hash || send.event || '';
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) continue;
    const used = db.prepare('SELECT token_name FROM tokens WHERE softpwar_burn_txid = ?').get(txid);
    if (!used) {
      return NextResponse.json({ ok: true, txid });
    }
  }

  return NextResponse.json({
    ok: false,
    error: 'All SOFTPWAR burns from this address have already been used for previous submissions.',
  });
}
