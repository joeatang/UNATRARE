// Solana $CASH burn verification — extracted so multiple routes can reuse it
// without duplicating the RPC + jsonParsed instruction inspection logic.
//
// Used by:
//   - app/api/salute/route.js (per-card salute burns)            ← inline copy preserved
//   - app/api/cash-burn/contribute/route.js (ceremony contributions)
//
// The salute route still has its own inline copy for backward-compat; this
// module is the canonical version going forward.

const CASH_MINT  = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function verifyCashBurn(txSig, expectedWallet) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15_000);
  let res;
  try {
    res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id:      1,
        method:  'getTransaction',
        params:  [txSig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
      }),
      signal: abort.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Solana RPC timed out — try again in a moment');
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Solana RPC error');

  const tx = data.result;
  if (!tx) throw new Error('transaction not found — wait for confirmation and try again');
  if (!tx.meta) throw new Error('transaction metadata unavailable — wait a moment and try again');
  if (tx.meta.err !== null) throw new Error('transaction failed on-chain');

  const signers = (tx.transaction?.message?.accountKeys || [])
    .filter(k => k?.signer)
    .map(k => k.pubkey);
  if (!signers.includes(expectedWallet)) {
    throw new Error('wallet did not sign this transaction');
  }

  const outerIx = tx.transaction?.message?.instructions || [];
  const innerIx = (tx.meta?.innerInstructions || []).flatMap(ii => ii.instructions);
  for (const ix of [...outerIx, ...innerIx]) {
    if (
      ix.program === 'spl-token' &&
      (ix.parsed?.type === 'burn' || ix.parsed?.type === 'burnChecked') &&
      ix.parsed?.info?.mint === CASH_MINT &&
      ix.parsed?.info?.authority === expectedWallet
    ) {
      const rawAmount = ix.parsed.info.amount;
      const allBals   = [...(tx.meta?.preTokenBalances || []), ...(tx.meta?.postTokenBalances || [])];
      const cashBal   = allBals.find(b => b.mint === CASH_MINT);
      const decimals  = cashBal?.uiTokenAmount?.decimals ?? 6;
      const displayAmount = Number(BigInt(rawAmount)) / Math.pow(10, decimals);
      const blockTime = typeof tx.blockTime === 'number' ? tx.blockTime : null;
      return { rawAmount, displayAmount, decimals, blockTime };
    }
  }

  return null;
}

export const CASH_MINT_ADDRESS = CASH_MINT;
