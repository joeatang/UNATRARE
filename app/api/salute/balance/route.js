import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CASH_MINT = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL || '',
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
].filter(Boolean);

async function rpcRequest(rpcUrl, method, params, timeoutMs = 10_000) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const payload = await res.json();
    if (payload?.error) throw new Error(payload.error?.message || 'RPC error');
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

async function getCashAccountViaRpc(wallet) {
  let lastErr = null;
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const result = await rpcRequest(
        rpcUrl,
        'getTokenAccountsByOwner',
        [wallet, { mint: CASH_MINT }, { encoding: 'jsonParsed' }],
      );

      const accounts = result?.value || [];
      if (!accounts.length) {
        return { found: false };
      }

      accounts.sort((a, b) => {
        const aAmt = BigInt(a?.account?.data?.parsed?.info?.tokenAmount?.amount || '0');
        const bAmt = BigInt(b?.account?.data?.parsed?.info?.tokenAmount?.amount || '0');
        if (aAmt === bAmt) return 0;
        return aAmt < bAmt ? 1 : -1;
      });

      const top = accounts[0];
      const tokenAmount = top?.account?.data?.parsed?.info?.tokenAmount;
      const tokenProgram = top?.account?.owner || '';
      return {
        found: true,
        account: {
          address: top?.pubkey || '',
          uiBalance: tokenAmount?.uiAmount || 0,
          rawBalance: tokenAmount?.amount || '0',
          decimals: tokenAmount?.decimals ?? 6,
          tokenProgram,
        },
      };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('failed to load balance from all RPC endpoints');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = (searchParams.get('wallet') || '').trim();

  if (!wallet || !SOL_ADDR_RE.test(wallet)) {
    return NextResponse.json({ error: 'valid wallet required' }, { status: 400 });
  }

  try {
    const result = await getCashAccountViaRpc(wallet);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err?.message || 'failed to load balance',
    }, { status: 502 });
  }
}
