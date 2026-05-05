import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const GATE_TOKENS = ['UNATPEPE', 'SOFTPWAR'];

async function getHoldings(address) {
  // Primary: xchain.io per-address balance API
  try {
    const res = await fetch(`https://xchain.io/api/balances/${encodeURIComponent(address)}`, {
      headers: { 'User-Agent': 'UNATRARE/1.0' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const balances = json.data || [];
      const result = {};
      for (const token of GATE_TOKENS) {
        const bal = balances.find(b => b.asset === token);
        result[token] = bal ? Number(bal.quantity) : 0;
      }
      return result;
    }
  } catch { /* fall through */ }

  // Fallback: tokenscan.io holders list for each token
  const result = {};
  for (const token of GATE_TOKENS) {
    try {
      const res = await fetch(
        `https://tokenscan.io/api/holders/${encodeURIComponent(token)}`,
        { headers: { 'User-Agent': 'UNATRARE/1.0' }, cache: 'no-store' }
      );
      if (!res.ok) { result[token] = -1; continue; }
      const data = await res.json();
      const holders = data.holders || data || [];
      if (!Array.isArray(holders)) { result[token] = -1; continue; }
      const holder = holders.find(h => h.address === address);
      result[token] = holder ? Number(holder.quantity || holder.amount || 1) : 0;
    } catch {
      result[token] = -1; // service unavailable
    }
  }
  return result;
}

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { address } = body || {};
  if (!address || !ADDR_RE.test(address)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid Bitcoin address format' },
      { status: 422 }
    );
  }

  const holdings = await getHoldings(address);

  if (holdings.UNATPEPE === -1 || holdings.SOFTPWAR === -1) {
    return NextResponse.json(
      { ok: false, error: 'Could not verify holdings — Counterparty API unavailable. Try again in a moment.' },
      { status: 503 }
    );
  }

  const db = getDb();

  db.prepare(`
    INSERT INTO claims (address, unatpepe_qty, softpwar_qty, verified_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(address) DO UPDATE SET
      unatpepe_qty = excluded.unatpepe_qty,
      softpwar_qty = excluded.softpwar_qty,
      verified_at  = unixepoch()
  `).run(address, holdings.UNATPEPE, holdings.SOFTPWAR);

  const eligible = holdings.UNATPEPE > 0 && holdings.SOFTPWAR > 0;
  let message;
  if (eligible) {
    message = 'Verified. You are eligible for the UNATAMOTO distribution.';
  } else {
    const missing = [];
    if (holdings.UNATPEPE === 0) missing.push('UNATPEPE');
    if (holdings.SOFTPWAR === 0) missing.push('SOFTPWAR');
    message = `Not eligible. No ${missing.join(' or ')} found at this address.`;
  }

  return NextResponse.json({ ok: true, address, eligible, holdings, message });
}
