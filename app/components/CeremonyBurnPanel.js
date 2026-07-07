'use client';

// Community contribution panel for an active Cash Burn Ceremony.
// Same UX shape as SalutePanel but ceremony-scoped — no card_name, no anchor
// program memo, no per-card leaderboard inside the panel itself.
// Posts to /api/cash-burn/contribute when the burn is confirmed on-chain.

import { useState, useEffect, useCallback } from 'react';
import styles from './CeremonyBurnPanel.module.css';
import { fmtCash } from '../../lib/saluteDisplay';

const CASH_MINT       = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const TOKEN_PROG      = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROG = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const RPC_URL_RAW     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '/api/solana/rpc';
const WEB3_CDN        = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.98.0/lib/index.iife.min.js';
const SOL_ADDR_RE     = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_SIG_RE      = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const MIN_CASH        = 69;

function resolveRpcUrl(url) {
  if (!url) return 'https://api.mainnet-beta.solana.com';
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window !== 'undefined') {
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return new URL(url, window.location.origin).toString();
  }
  return url;
}
const RPC_URL = resolveRpcUrl(RPC_URL_RAW);

function truncWallet(addr) {
  if (!addr) return '';
  return addr.slice(0, 5) + '…' + addr.slice(-4);
}

// $CASH amounts use the single shared formatter (consistent across every surface).
const fmt = fmtCash;

function parseToRaw(str, decimals) {
  if (!str || !str.trim()) return 0n;
  const clean = str.trim().replace(/,/g, '');
  const [intPart = '0', decPart = ''] = clean.split('.');
  const padded = decPart.padEnd(decimals, '0').slice(0, decimals);
  try { return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(padded || '0'); }
  catch { return 0n; }
}

function buildBurnIx(web3, tokenAcct, mint, owner, rawAmt, tokenProgramId) {
  const data = new Uint8Array(9);
  data[0] = 8; // SPL Token Burn instruction index
  let n = rawAmt;
  for (let i = 1; i <= 8; i++) { data[i] = Number(n & 0xFFn); n >>= 8n; }
  const programId = tokenProgramId === TOKEN_2022_PROG ? TOKEN_2022_PROG : TOKEN_PROG;
  return new web3.TransactionInstruction({
    programId: new web3.PublicKey(programId),
    keys: [
      { pubkey: new web3.PublicKey(tokenAcct), isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(mint),      isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(owner),     isSigner: true,  isWritable: false },
    ],
    data,
  });
}

function detectWallets() {
  if (typeof window === 'undefined') return [];
  const w = [];
  if (window.phantom?.solana?.isPhantom)  w.push({ id: 'phantom',  name: 'Phantom',  provider: window.phantom.solana });
  if (window.solflare?.isSolflare)        w.push({ id: 'solflare', name: 'Solflare', provider: window.solflare });
  if (window.backpack?.isBackpack)        w.push({ id: 'backpack', name: 'Backpack', provider: window.backpack });
  if (window.okxwallet?.solana)           w.push({ id: 'okx',      name: 'OKX',      provider: window.okxwallet.solana });
  if (!w.length && window.solana?.isConnected !== undefined) {
    w.push({ id: 'generic', name: 'Solana Wallet', provider: window.solana });
  }
  const seen = new Set();
  return w.filter(entry => {
    const key = entry.id + ':' + (entry.provider?.publicKey?.toString?.() || entry.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const { result, error } = await res.json();
  if (error) throw new Error(error.message);
  return result;
}

async function getCashAccount(walletPubkey) {
  const res = await fetch(
    `/api/salute/balance?wallet=${encodeURIComponent(walletPubkey)}&t=${Date.now()}`,
    { cache: 'no-store' },
  );
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'failed to load balance');
  if (!json.found || !json.account) return null;
  return {
    address:      json.account.address,
    uiBalance:    json.account.uiBalance || 0,
    rawBalance:   BigInt(json.account.rawBalance || '0'),
    decimals:     json.account.decimals ?? 6,
    tokenProgram: json.account.tokenProgram || TOKEN_PROG,
  };
}

async function waitConfirmed(sig, opts = {}) {
  const { rawTx = null, lastValidBlockHeight = 0, maxTries = 60 } = opts;
  let lastBroadcast = Date.now();
  for (let i = 0; i < maxTries; i++) {
    const res = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
    const st = res?.value?.[0];
    if (st?.err) throw new Error('Transaction failed on-chain');
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return;
    if (rawTx && Date.now() - lastBroadcast > 3000) {
      try { await rpc('sendTransaction', [rawTx, { skipPreflight: true, encoding: 'base64', maxRetries: 0 }]); } catch {}
      lastBroadcast = Date.now();
    }
    if (lastValidBlockHeight) {
      try {
        const h = await rpc('getBlockHeight', [{ commitment: 'confirmed' }]);
        if (typeof h === 'number' && h > lastValidBlockHeight) {
          throw new Error('Blockhash expired before the transaction was confirmed. Please try again.');
        }
      } catch (e) {
        if (String(e.message || '').includes('Blockhash expired')) throw e;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('Confirmation timeout — check Solana Explorer for status');
}

async function sendBurnTxWithWallet(provider, tx) {
  if (provider?.signTransaction) {
    const signed = await provider.signTransaction(tx);
    const raw = signed.serialize();
    const rawB64 = (typeof Buffer !== 'undefined')
      ? Buffer.from(raw).toString('base64')
      : btoa(String.fromCharCode(...new Uint8Array(raw)));
    const sig = await rpc('sendTransaction',
      [rawB64, { skipPreflight: false, encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 5 }]);
    return { sig, rawB64 };
  }
  if (provider?.signAndSendTransaction) {
    const sendResult = await provider.signAndSendTransaction(tx);
    const sig = typeof sendResult === 'string' ? sendResult : sendResult?.signature;
    if (!sig) throw new Error('wallet did not return a transaction signature');
    return { sig, rawB64: null };
  }
  throw new Error('wallet does not support transaction signing for this action');
}

export default function CeremonyBurnPanel({ ceremonyId, ordinal, onContribution }) {
  const [web3,      setWeb3]      = useState(null);
  const [wallets,   setWallets]   = useState([]);
  const [connected, setConnected] = useState(null);
  const [cashAcct,  setCashAcct]  = useState(null);
  const [phase,     setPhase]     = useState('idle');
  const [amount,    setAmount]    = useState('');
  const [err,       setErr]       = useState('');
  const [result,    setResult]    = useState(null);
  const [sig,       setSig]       = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const init = () => { setWeb3(window.solanaWeb3 || null); setWallets(detectWallets()); };
    if (window.solanaWeb3) { init(); return; }
    const s = document.createElement('script');
    s.src = WEB3_CDN;
    s.onload = init;
    s.onerror = () => setWallets([]);
    document.head.appendChild(s);
  }, []);

  const connect = useCallback(async (w) => {
    setPhase('connecting');
    setErr('');
    const hydrate = async (pubkey) => {
      setConnected({ ...w, pubkey });
      setPhase('fetching');
      try { setCashAcct(await getCashAccount(pubkey)); }
      catch { setCashAcct(null); }
      setPhase('ready');
    };
    try {
      const already = w.provider?.publicKey?.toString?.();
      if (already && SOL_ADDR_RE.test(already)) { await hydrate(already); return; }
      await w.provider.connect();
      const pubkey = w.provider.publicKey?.toString();
      if (!pubkey) throw new Error('wallet did not return a public key');
      await hydrate(pubkey);
    } catch (e) {
      const msg = String(e.message || '').toLowerCase();
      if (msg.includes('forbidden') || msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel')) {
        setErr('Wallet connection was denied. Approve the request in your wallet and try again.');
      } else {
        setErr(e.message || 'connection failed');
      }
      setPhase('idle');
    }
  }, []);

  function disconnect() {
    try { connected?.provider?.disconnect?.(); } catch {}
    setConnected(null);
    setCashAcct(null);
    setAmount('');
    setErr('');
    setResult(null);
    setSig('');
    setPhase('idle');
  }

  async function refresh() {
    if (!connected) return;
    setPhase('fetching');
    setErr('');
    try { setCashAcct(await getCashAccount(connected.pubkey)); setPhase('ready'); }
    catch { setErr('Could not load $CASH balance.'); setPhase('ready'); }
  }

  function setPercent(pct) {
    if (!cashAcct?.uiBalance) return;
    const val = pct === 100
      ? Math.floor(cashAcct.uiBalance).toString()
      : Math.floor(cashAcct.uiBalance * pct / 100).toString();
    setAmount(val);
  }

  function burnAgain() {
    setAmount('');
    setErr('');
    setResult(null);
    setSig('');
    setPhase('ready');
  }

  async function executeBurn() {
    if (!web3 || !connected || !cashAcct) return;
    setErr('');
    const displayAmt = Number(amount);
    if (!Number.isFinite(displayAmt) || displayAmt < MIN_CASH) {
      setErr(`Minimum contribution is ${MIN_CASH} $CASH.`); return;
    }
    const rawAmt = parseToRaw(amount, cashAcct.decimals);
    if (rawAmt <= 0n) { setErr('Enter an amount to burn.'); return; }
    if (rawAmt > cashAcct.rawBalance) { setErr('Amount exceeds your $CASH balance.'); return; }

    setPhase('burning');
    try {
      // Preflight: ensure wallet has SOL for network fee
      try {
        const balRes = await rpc('getBalance', [connected.pubkey, { commitment: 'confirmed' }]);
        const lamports = typeof balRes === 'object' ? (balRes?.value ?? 0) : (balRes ?? 0);
        if (lamports < 1_000_000) {
          setErr('Your wallet needs a tiny amount of SOL (~0.001) to pay the Solana network fee. Top up and try again.');
          setPhase('ready');
          return;
        }
      } catch { /* let on-chain path surface the error */ }

      if (connected.provider?.isConnected === false && connected.provider?.connect) {
        await connected.provider.connect();
      }

      const { blockhash, lastValidBlockHeight } = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])
        .then(r => ({ blockhash: r.value.blockhash, lastValidBlockHeight: r.value.lastValidBlockHeight }));

      const tx = new web3.Transaction({ recentBlockhash: blockhash, feePayer: new web3.PublicKey(connected.pubkey) });
      tx.add(buildBurnIx(web3, cashAcct.address, CASH_MINT, connected.pubkey, rawAmt, cashAcct.tokenProgram));

      const sent = await sendBurnTxWithWallet(connected.provider, tx);
      if (!sent.sig) throw new Error('wallet did not return a transaction signature');
      setSig(sent.sig);

      setPhase('confirming');
      await waitConfirmed(sent.sig, { rawTx: sent.rawB64, lastValidBlockHeight });

      setPhase('submitting');
      const resp = await fetch('/api/cash-burn/contribute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cash_burn_id: ceremonyId,
          sol_wallet:   connected.pubkey,
          tx_sig:       sent.sig,
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || 'submit failed');
      }
      setResult({ amount: json.amount, tx: sent.sig });
      setPhase('success');
      onContribution?.(json);
      // Refresh wallet balance after a successful burn
      try { setCashAcct(await getCashAccount(connected.pubkey)); } catch {}
    } catch (e) {
      setErr(e.message || 'burn failed');
      setPhase('ready');
    }
  }

  const balanceOK = cashAcct && cashAcct.uiBalance > 0;
  const isBusy    = phase === 'connecting' || phase === 'fetching' || phase === 'burning' || phase === 'confirming' || phase === 'submitting';

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>● LIVE · BURN $CASH INTO THIS CEREMONY</span>
        <span className={styles.headerChain}>SOLANA · MIN {MIN_CASH}</span>
      </div>

      <div className={styles.body}>

        {phase === 'success' && result && (
          <div className={styles.successBox}>
            <div className={styles.successTitle}>YOUR BURN IS RECORDED · CEREMONY #{String(ordinal).padStart(3, '0')}</div>
            <div className={styles.successAmt}>{fmt(result.amount)} <span>$CASH</span></div>
            <div className={styles.successRow}>
              <a
                href={`https://solscan.io/tx/${result.tx}`}
                target="_blank" rel="noopener noreferrer"
                className={styles.successLink}
              >view on solscan ↗</a>
              <button className={styles.linkBtn} onClick={burnAgain}>burn again ↻</button>
            </div>
          </div>
        )}

        {!connected && phase !== 'success' && (
          <div className={styles.intro}>
            Connect your Solana wallet, burn any amount of <strong>$CASH</strong> (min {MIN_CASH}),
            and your wallet appears permanently on this ceremony&apos;s leaderboard.
            <br /><br />
            <span className={styles.introDim}>The burn happens directly from your wallet on Solana. We never hold your funds.</span>
          </div>
        )}

        {!connected && wallets.length > 0 && phase !== 'success' && (
          <div className={styles.walletGrid}>
            {wallets.map(w => (
              <button key={w.id} className={styles.walletBtn} onClick={() => connect(w)} disabled={isBusy}>
                connect {w.name} →
              </button>
            ))}
          </div>
        )}

        {!connected && wallets.length === 0 && phase !== 'success' && (
          <div className={styles.noWallet}>
            No Solana wallet detected. Install Phantom, Solflare, Backpack, or OKX and reload.
          </div>
        )}

        {connected && phase !== 'success' && (
          <>
            <div className={styles.connBar}>
              <span className={styles.connAddr}>{connected.name} · {truncWallet(connected.pubkey)}</span>
              <button className={styles.disconnBtn} onClick={disconnect}>disconnect</button>
            </div>

            {cashAcct && (
              <div className={styles.balRow}>
                <span className={styles.balLabel}>YOUR $CASH BALANCE</span>
                <span className={styles.balValue}>{fmt(cashAcct.uiBalance)}</span>
              </div>
            )}

            {!cashAcct && phase !== 'fetching' && (
              <div className={styles.noBal}>
                No $CASH balance loaded.{' '}
                <button className={styles.linkBtn} onClick={refresh}>↻ refresh</button>
              </div>
            )}

            {balanceOK && (
              <>
                <label className={styles.label}>AMOUNT TO BURN</label>
                <input
                  className={styles.input}
                  type="text" inputMode="decimal"
                  placeholder={`min ${MIN_CASH}`}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  disabled={isBusy}
                />
                <div className={styles.pctRow}>
                  {[25, 50, 100].map(p => (
                    <button key={p} className={styles.pctBtn} onClick={() => setPercent(p)} disabled={isBusy}>
                      {p === 100 ? 'MAX' : `${p}%`}
                    </button>
                  ))}
                  <button className={styles.pctBtn} onClick={() => setAmount(String(MIN_CASH))} disabled={isBusy}>{MIN_CASH}</button>
                  <button className={styles.pctBtn} onClick={refresh} disabled={isBusy}>↻</button>
                </div>

                <button
                  className={`${styles.burnBtn} ${isBusy ? styles.burnBtnOff : ''}`}
                  onClick={executeBurn}
                  disabled={isBusy}
                >
                  {phase === 'burning'    ? 'sign in your wallet…' :
                   phase === 'confirming' ? 'confirming on solana…' :
                   phase === 'submitting' ? 'recording on ledger…' :
                                            `🔥  BURN ${amount || '—'} $CASH INTO CEREMONY  🔥`}
                </button>
              </>
            )}

            {!balanceOK && cashAcct && phase !== 'fetching' && (
              <div className={styles.noBal}>
                Your wallet holds 0 $CASH.{' '}
                <a href="https://nat.fun/?refId=c69c9108f52b" target="_blank" rel="noopener noreferrer" className={styles.buyLink}>
                  Get some on nat.fun ↗
                </a>
              </div>
            )}
          </>
        )}

        {err && <div className={styles.err}>{err}</div>}
        {sig && phase !== 'success' && phase !== 'idle' && (
          <div className={styles.sigLine}>
            tx: <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noopener noreferrer">{sig.slice(0, 12)}…{sig.slice(-8)} ↗</a>
          </div>
        )}
      </div>
    </div>
  );
}
