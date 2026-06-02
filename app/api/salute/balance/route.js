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
  // $CASH is Token-2022 — query both programs and merge, prefer highest balance.
  const TOKEN_PROG      = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const TOKEN_2022_PROG = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

  let lastErr = null;
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      // Query both token programs in parallel.
      // Query both token programs in parallel.
      // Classic SPL: filter by mint directly.
      // Token-2022: filter by programId (mint filter not supported with programId together),
      //             then narrow to CASH_MINT client-side.
      const [res1, res2] = await Promise.allSettled([
        rpcRequest(rpcUrl, 'getTokenAccountsByOwner',
          [wallet, { mint: CASH_MINT }, { encoding: 'jsonParsed' }]),
        rpcRequest(rpcUrl, 'getTokenAccountsByOwner',
          [wallet, { programId: TOKEN_2022_PROG }, { encoding: 'jsonParsed' }]),
      ]);

      const t22Accounts = (res2.status === 'fulfilled' ? res2.value?.value || [] : [])
        .filter(a => a?.account?.data?.parsed?.info?.mint === CASH_MINT);

      const accounts = [
        ...(res1.status === 'fulfilled' ? res1.value?.value || [] : []),
        ...t22Accounts,
      ];

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
      const tokenProgram = top?.account?.owner || TOKEN_PROG;
      const accountAddress = top?.pubkey || '';

      // Public RPCs (mainnet-beta) cache parsed token-account data and can lag
      // by minutes after a burn. getTokenAccountBalance reads live state.
      let liveAmount = tokenAmount;
      if (accountAddress) {
        try {
          const fresh = await rpcRequest(rpcUrl, 'getTokenAccountBalance',
            [accountAddress, { commitment: 'confirmed' }]);
          if (fresh?.value) liveAmount = fresh.value;
        } catch { /* fall back to parsed amount */ }
      }

      return {
        found: true,
        account: {
          address: accountAddress,
          uiBalance: liveAmount?.uiAmount || 0,
          rawBalance: liveAmount?.amount || '0',
          decimals: liveAmount?.decimals ?? 6,
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
