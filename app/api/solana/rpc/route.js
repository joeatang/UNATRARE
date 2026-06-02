import { NextResponse } from 'next/server';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const ALLOWED_METHODS = new Set([
  'getLatestBlockhash',
  'getSignatureStatuses',
  'sendTransaction',
  'getRecentBlockhash',
  'simulateTransaction',
  'getBlockHeight',
  'getBalance',
]);

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const method = payload?.method;
  if (!method || typeof method !== 'string') {
    return NextResponse.json({ error: 'json-rpc method required' }, { status: 400 });
  }

  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: `rpc method not allowed: ${method}` }, { status: 403 });
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 20_000);

  try {
    const upstream = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: payload?.id ?? 1,
        method,
        params: Array.isArray(payload?.params) ? payload.params : [],
      }),
      signal: abort.signal,
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return NextResponse.json(
      { error: timedOut ? 'solana rpc timeout' : 'solana rpc unavailable' },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
