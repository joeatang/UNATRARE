'use client';
// Cash Burn Ceremony — admin control panel.
// Mounted inside <Tools> on /admin. Self-contained: own data fetching, form
// state, sprite picker, live preview, Phantom-style wallet connect, sign and
// burn $CASH on Solana mainnet, then open/close/repost/archive flow.
//
// SECURITY MODEL:
//   1. Admin password auth (HMAC bearer token) gates the API.
//   2. ALSO requires admin_wallet ∈ CBC_ADMIN_WALLETS env whitelist server-side.
//   3. tx_sig is verified on-chain by the server before the row is written
//      (real spl-token Burn ix against $CASH mint, authority = admin_wallet,
//       raw amount matches form amount within 1-unit tolerance).
//   4. tx_sig is UNIQUE in the DB — same tx cannot be replayed for two rows.
//
// Mobile-first: form stacks single column ≤720px, expands to 2-col on tablet+.
// Sprite picker: 4 cols mobile → 10 cols desktop. Preview image is full-width.

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './admin.module.css';

// ── Solana constants (mirror app/components/SalutePanel.js) ───────────────
const CASH_MINT       = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const TOKEN_PROG      = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROG = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const WEB3_CDN        = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.98.0/lib/index.iife.min.js';
const RPC_URL_RAW     = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '/api/solana/rpc';
const SOL_SIG_RE      = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const SOL_ADDR_RE     = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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

const TIERS = [
  { key: 'cataclysm', label: 'CATACLYSM',  min: 1_000_000_000 },
  { key: 'legendary', label: 'LEGENDARY',  min:   100_000_000 },
  { key: 'inferno',   label: 'INFERNO',    min:    10_000_000 },
  { key: 'bonfire',   label: 'BONFIRE',    min:     1_000_000 },
  { key: 'flame',     label: 'FLAME',      min:       100_000 },
  { key: 'torch',     label: 'TORCH',      min:        10_000 },
  { key: 'ember',     label: 'EMBER',      min:             1 },
];

function tierFor(amount) {
  const n = Number(amount || 0);
  return TIERS.find(t => n >= t.min) || TIERS[TIERS.length - 1];
}

function fmtCompact(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  if (x >= 1e9) return (x / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (x >= 1e6) return (x / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K';
  return Math.round(x).toLocaleString('en-US');
}

function fmtFull(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  return Math.round(x).toLocaleString('en-US');
}

function truncWallet(addr) {
  if (!addr) return '';
  return addr.slice(0, 5) + '…' + addr.slice(-4);
}

// ── Solana helpers (mirror SalutePanel.js) ────────────────────────────────
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

// Parse "1000000.5" → BigInt raw units, safe for huge numbers.
function parseToRaw(str, decimals) {
  if (!str || !str.trim()) return 0n;
  const clean = String(str).trim().replace(/,/g, '').replace(/_/g, '');
  const [intPart = '0', decPart = ''] = clean.split('.');
  const padded = decPart.padEnd(decimals, '0').slice(0, decimals);
  try {
    return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(padded || '0');
  } catch { return 0n; }
}

// Build raw SPL Token Burn instruction (ix index 8) — works for classic + 2022.
function buildBurnIx(web3, tokenAcct, mint, owner, rawAmt, tokenProgramId) {
  const data = new Uint8Array(9);
  data[0] = 8;
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

// Fetch the admin wallet's $CASH token account + balance via the existing
// server-side balance endpoint (handles classic + Token-2022 + RPC fallback).
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

// Send a built tx via the connected wallet — prefer signTransaction so we can
// re-broadcast a dropped tx if needed.
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
  throw new Error('wallet does not support transaction signing');
}

// Poll for confirmation, re-broadcasting periodically. Same logic as SalutePanel.
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

// ── Inline style helpers — match patterns used elsewhere in admin/page.js ─
const label = {
  fontFamily:    'var(--font-card)',
  fontSize:      10,
  letterSpacing: '2px',
  color:         'var(--text-dim)',
  textTransform: 'uppercase',
  display:       'block',
  marginBottom:  4,
};
const input = {
  fontFamily:    'var(--font-card)',
  fontSize:      14,
  letterSpacing: '1px',
  background:    'var(--bg)',
  border:        '1px solid var(--border)',
  borderRadius:  4,
  color:         'var(--text)',
  padding:       '10px 12px',
  width:         '100%',
  boxSizing:     'border-box',
  outline:       'none',
};
function btn(color = 'var(--green)', { disabled } = {}) {
  return {
    fontFamily:    'var(--font-card)',
    fontSize:      11,
    letterSpacing: '2px',
    background:    'var(--bg)',
    color:         disabled ? 'var(--text-dim)' : color,
    border:        `1px solid ${disabled ? 'var(--border-dim)' : color}`,
    padding:       '9px 14px',
    cursor:        disabled ? 'default' : 'pointer',
    textTransform: 'uppercase',
  };
}

export default function CashBurnPanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [active, setActive] = useState(null);
  const [list, setList] = useState([]);
  const [characters, setCharacters] = useState([]);

  const [form, setForm] = useState({
    character_key: '',
    amount:        '',
    card_name:     '',
    headline:      '',
    quote:         '',
  });
  const [previewUrl, setPreviewUrl] = useState('');
  const previewBlobRef = useRef(null);

  // ── Wallet state ────────────────────────────────────────────────────────
  const [web3,      setWeb3]      = useState(null);
  const [wallets,   setWallets]   = useState([]);
  const [connected, setConnected] = useState(null); // { id, name, provider, pubkey }
  const [cashAcct,  setCashAcct]  = useState(null);
  const [walletErr, setWalletErr] = useState('');
  // burn phase: idle | burning | confirming | submitting
  const [burnPhase, setBurnPhase] = useState('idle');
  const [burnSig,   setBurnSig]   = useState('');

  // ── Manual override fallback (if wallet auto-broadcast fails but tx landed)
  const [showManual, setShowManual] = useState(false);
  const [manualSig,  setManualSig]  = useState('');
  const [manualWal,  setManualWal]  = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cash-burn?limit=20', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json.error || 'failed to load');
        return;
      }
      setList(json.burns || []);
      setActive(json.active || null);
      setCharacters(json.characters || []);
      setForm(f => ({
        ...f,
        character_key: f.character_key || (json.characters?.[0]?.key || 'classic'),
      }));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (open && characters.length === 0) refresh();
  }, [open, characters.length, refresh]);

  // Load CDN web3.js + detect wallets when panel opens
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    const init = () => {
      setWeb3(window.solanaWeb3 || null);
      setWallets(detectWallets());
    };
    if (window.solanaWeb3) { init(); return; }
    const s = document.createElement('script');
    s.src = WEB3_CDN;
    s.onload = init;
    s.onerror = () => setWallets([]);
    document.head.appendChild(s);
  }, [open]);

  // Free old blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  const tier = tierFor(form.amount);
  const suggestedSet = new Set(
    characters.filter(c => Array.isArray(c.suggested_tiers) && c.suggested_tiers.includes(tier.key)).map(c => c.key)
  );

  async function connectWallet(entry) {
    setWalletErr('');
    try {
      const resp = await entry.provider.connect();
      const pubkey = resp?.publicKey?.toString?.() || entry.provider.publicKey?.toString?.();
      if (!pubkey) throw new Error('wallet did not return a public key');
      setConnected({ ...entry, pubkey });
      const acct = await getCashAccount(pubkey);
      setCashAcct(acct);
    } catch (e) {
      setWalletErr(e.message || 'wallet connect failed');
    }
  }

  function disconnectWallet() {
    try { connected?.provider?.disconnect?.(); } catch {}
    setConnected(null);
    setCashAcct(null);
    setBurnPhase('idle');
    setBurnSig('');
  }

  async function refreshBalance() {
    if (!connected?.pubkey) return;
    try {
      const acct = await getCashAccount(connected.pubkey);
      setCashAcct(acct);
    } catch (e) { setWalletErr(e.message); }
  }

  async function doPreview() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/cash-burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          action:        'preview',
          character_key: form.character_key,
          amount:        form.amount,
          card_name:     form.card_name,
          headline:      form.headline,
          quote:         form.quote,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 200));
      }
      const blob = await res.blob();
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      const url = URL.createObjectURL(blob);
      previewBlobRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      setMsg('preview failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Sign & burn + record ceremony (the main action) ──────────────────────
  async function signAndOpen() {
    setMsg('');
    setBurnSig('');
    if (!form.character_key) { setMsg('pick a character'); return; }
    const amt = Number(String(form.amount).replace(/,/g, ''));
    if (!amt || amt <= 0) { setMsg('enter an amount'); return; }
    if (active) { setMsg('close the active ceremony before opening a new one'); return; }
    if (!web3) { setMsg('solana web3 still loading — try again in a moment'); return; }
    if (!connected) { setMsg('connect your admin wallet first'); return; }
    if (!cashAcct) { setMsg('no $CASH account found in this wallet'); return; }

    const rawAmt = parseToRaw(amt.toString(), cashAcct.decimals);
    if (rawAmt > cashAcct.rawBalance) {
      const have = Number(cashAcct.rawBalance) / Math.pow(10, cashAcct.decimals);
      setMsg(`insufficient balance: have ${fmtFull(have)} $CASH, need ${fmtFull(amt)}`);
      return;
    }

    setBusy(true);
    setBurnPhase('burning');
    try {
      // Build the burn tx
      const owner = new web3.PublicKey(connected.pubkey);
      const burnIx = buildBurnIx(web3, cashAcct.address, CASH_MINT, connected.pubkey, rawAmt, cashAcct.tokenProgram);
      const { blockhash, lastValidBlockHeight } = await rpc('getLatestBlockhash', [{ commitment: 'finalized' }]);
      const tx = new web3.Transaction({ recentBlockhash: blockhash, feePayer: owner }).add(burnIx);

      // Sign + send via wallet
      const { sig, rawB64 } = await sendBurnTxWithWallet(connected.provider, tx);
      setBurnSig(sig);

      // Wait for confirmation
      setBurnPhase('confirming');
      await waitConfirmed(sig, { rawTx: rawB64, lastValidBlockHeight, maxTries: 90 });

      // Notarize with the server (on-chain verification + DB write)
      setBurnPhase('submitting');
      const res = await fetch('/api/admin/cash-burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          action:        'open',
          character_key: form.character_key,
          amount:        amt,
          card_name:     form.card_name,
          headline:      form.headline,
          quote:         form.quote,
          tx_sig:        sig,
          admin_wallet:  connected.pubkey,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'server rejected the ceremony');

      // Success
      setMsg(`🔥 ceremony #${String(json.burn?.ordinal || '').padStart(3, '0')} opened — tx ${sig.slice(0, 8)}… — Telegram fired`);
      setForm({ character_key: form.character_key, amount: '', card_name: '', headline: '', quote: '' });
      setPreviewUrl('');
      await refresh();
      await refreshBalance();
    } catch (e) {
      const m = e.message || String(e);
      if (burnSig && burnPhase === 'submitting') {
        setMsg(
          `⚠️ burn succeeded on Solana (tx ${burnSig.slice(0, 12)}…) but the server rejected it: ${m}. ` +
          `You can retry via "manual notarize" below (paste the tx sig).`,
        );
        setShowManual(true);
        setManualSig(burnSig);
        setManualWal(connected?.pubkey || '');
      } else {
        setMsg(`${burnPhase} failed: ${m}`);
      }
    } finally {
      setBurnPhase('idle');
      setBusy(false);
    }
  }

  // Manual notarize: server verifies on-chain again, then writes. Useful if
  // the wallet's auto-broadcast worked but the post-success POST failed.
  async function manualNotarize() {
    if (!SOL_SIG_RE.test(manualSig)) { setMsg('invalid tx signature'); return; }
    if (!SOL_ADDR_RE.test(manualWal)) { setMsg('invalid admin wallet'); return; }
    const amt = Number(String(form.amount).replace(/,/g, ''));
    if (!amt || amt <= 0) { setMsg('amount required — must match the on-chain burn'); return; }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/cash-burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          action:        'open',
          character_key: form.character_key,
          amount:        amt,
          card_name:     form.card_name,
          headline:      form.headline,
          quote:         form.quote,
          tx_sig:        manualSig,
          admin_wallet:  manualWal,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json.error || 'manual notarize failed');
        return;
      }
      setMsg(`🔥 ceremony #${String(json.burn?.ordinal || '').padStart(3, '0')} notarized from manual tx`);
      setShowManual(false); setManualSig(''); setManualWal('');
      setForm({ character_key: form.character_key, amount: '', card_name: '', headline: '', quote: '' });
      setPreviewUrl('');
      await refresh();
      await refreshBalance();
    } catch (e) {
      setMsg('manual notarize error: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function postAction(action, extra = {}) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/cash-burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json.error || `${action} failed`);
        return null;
      }
      setMsg(action === 'close'   ? '🏁 ceremony closed — Telegram fired'
            : action === 'repost'  ? '↻ reposted to Telegram'
            : action === 'archive' ? '📦 archived'
            : 'ok');
      await refresh();
      return json.burn;
    } catch (e) {
      setMsg(`${action} error: ${e.message}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function doClose(id) {
    if (!confirm('Close this ceremony? It will post a closing announcement to Telegram.')) return;
    await postAction('close', { id });
  }
  async function doRepost(id) {
    if (!confirm('Re-post to Telegram?')) return;
    await postAction('repost', { id });
  }
  async function doArchive(id) {
    if (!confirm('Archive this ceremony? (hides from public list)')) return;
    await postAction('archive', { id });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
           onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-card)', fontSize: 13, letterSpacing: '3px', color: 'var(--amber-hot)', textTransform: 'uppercase' }}>
            🔥 Cash Burn Ceremony
          </span>
          <span style={{ fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: '2px', color: 'var(--text-dim)' }}>
            {active ? `LIVE · #${String(active.ordinal).padStart(3, '0')}` : 'idle ▾'}
          </span>
        </div>
      </div>
    );
  }

  const canSign = !busy && form.character_key && form.amount && !active && connected && cashAcct;
  const burnLabel =
    burnPhase === 'burning'    ? 'awaiting wallet signature…' :
    burnPhase === 'confirming' ? 'confirming on solana…' :
    burnPhase === 'submitting' ? 'notarizing on server…' :
    '🔥 SIGN & BURN $CASH — OPEN CEREMONY';

  return (
    <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-card)', fontSize: 14, letterSpacing: '4px', color: 'var(--amber-hot)', textTransform: 'uppercase' }}>
            🔥 Cash Burn Ceremony
          </span>
          {active && (
            <span style={{ fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '2px', color: 'var(--green)', border: '1px solid var(--green)', padding: '2px 8px' }}>
              LIVE · #{String(active.ordinal).padStart(3, '0')}
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)} style={{ ...btn('var(--text-dim)'), fontSize: 10 }}>close ▴</button>
      </div>

      {msg && (
        <div style={{ marginBottom: 12, padding: '8px 12px', border: '1px dashed var(--border)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
          {msg}
        </div>
      )}

      {/* Active ceremony preview + close/repost actions */}
      {active && (
        <div style={{ marginBottom: 18, padding: 12, border: '1px solid var(--green)', background: 'rgba(180, 255, 111, 0.04)' }}>
          <div style={{ fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: '3px', color: 'var(--green)', marginBottom: 8 }}>
            ACTIVE · #{String(active.ordinal).padStart(3, '0')} · {fmtFull(active.amount)} $CASH
            {active.tx_sig && (
              <a href={`https://solscan.io/tx/${active.tx_sig}`} target="_blank" rel="noopener noreferrer"
                 style={{ marginLeft: 10, fontSize: 9, color: 'var(--text-dim)', textDecoration: 'underline' }}>
                tx {active.tx_sig.slice(0, 6)}…{active.tx_sig.slice(-4)} ↗
              </a>
            )}
          </div>
          {active.image_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.image_path} alt={`ceremony #${active.ordinal}`} className={styles.previewFrame} />
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => doClose(active.id)}   disabled={busy} style={btn('var(--red)', { disabled: busy })}>🏁 close ceremony</button>
            <button onClick={() => doRepost(active.id)}  disabled={busy} style={btn('var(--amber-hot)', { disabled: busy })}>↻ repost telegram</button>
            <a href={`/burns/${active.id}`} target="_blank" rel="noopener noreferrer" style={{ ...btn('var(--text-dim)'), textDecoration: 'none', display: 'inline-block' }}>open public page ↗</a>
          </div>
        </div>
      )}

      {/* New-ceremony form (only shown when no active ceremony) */}
      {!active && (
        <>
          {/* Wallet connection bar */}
          <div style={{ marginBottom: 14, padding: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            {!connected ? (
              <>
                <div style={{ marginBottom: 8, fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '2px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  step 1 · connect admin wallet (signs the on-chain $CASH burn)
                </div>
                {wallets.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    No Solana wallet detected. Install Phantom or Solflare and reload, or use manual notarize below.
                  </div>
                )}
                {wallets.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {wallets.map(w => (
                      <button key={w.id} onClick={() => connectWallet(w)} disabled={busy} style={btn('var(--green)', { disabled: busy })}>
                        connect {w.name}
                      </button>
                    ))}
                  </div>
                )}
                {walletErr && (
                  <div style={{ marginTop: 6, fontFamily: 'var(--font-body)', fontSize: 11, color: '#ff5555' }}>{walletErr}</div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-card)', fontSize: 9, letterSpacing: '2px', color: 'var(--text-dim)' }}>
                    {connected.name} · <span style={{ color: 'var(--green)' }}>{truncWallet(connected.pubkey)}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--green)' }}>
                    {cashAcct ? `${fmtFull(cashAcct.uiBalance)} $CASH` : 'no $CASH'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={refreshBalance} disabled={busy} style={{ ...btn('var(--text-dim)', { disabled: busy }), fontSize: 9 }}>↻ refresh</button>
                  <button onClick={disconnectWallet} disabled={busy} style={{ ...btn('var(--text-dim)', { disabled: busy }), fontSize: 9 }}>disconnect</button>
                </div>
              </div>
            )}
          </div>

          {/* Amount + tier indicator */}
          <div className={styles.ceremonyGrid2}>
            <div>
              <span style={label}>AMOUNT ($CASH)</span>
              <input
                style={input}
                inputMode="decimal"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.,_]/g, '') }))}
                placeholder="69420 / 1000000 / 6900000000"
              />
              <div style={{ marginTop: 6, fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '2px', color: 'var(--text-dim)' }}>
                {form.amount ? `${fmtFull(form.amount)} → ${fmtCompact(form.amount)}` : '—'}
              </div>
            </div>
            <div>
              <span style={label}>TIER (AUTO)</span>
              <div style={{ ...input, color: tier.key === 'cataclysm' || tier.key === 'legendary' ? 'var(--amber-hot)' : 'var(--green)', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{tier.label}</span>
                <span style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-dim)' }}>≥ {fmtCompact(tier.min)}</span>
              </div>
              <div style={{ marginTop: 6, fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '2px', color: 'var(--text-dim)' }}>
                ★ = suggested character for this tier
              </div>
            </div>
          </div>

          {/* Sprite picker */}
          <div style={{ marginBottom: 4 }}>
            <span style={label}>CHARACTER {form.character_key && <span style={{ color: 'var(--green)' }}>· {(characters.find(c => c.key === form.character_key)?.title) || form.character_key}</span>}</span>
            <div className={styles.spriteGrid}>
              {characters.map(c => {
                const isActive = form.character_key === c.key;
                const isSuggested = suggestedSet.has(c.key);
                const cls = [styles.spriteTile, isActive && styles.active, isSuggested && styles.suggested].filter(Boolean).join(' ');
                return (
                  <button
                    type="button"
                    key={c.key}
                    className={cls}
                    onClick={() => setForm(f => ({ ...f, character_key: c.key }))}
                    title={`${c.title} — ${c.bureau}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.sprite} alt={c.title} loading="lazy" />
                    <span className="label">{c.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional fields */}
          <div className={styles.ceremonyGrid2}>
            <div>
              <span style={label}>CARD NAME (OPTIONAL)</span>
              <input
                style={input}
                value={form.card_name}
                onChange={e => setForm(f => ({ ...f, card_name: e.target.value.toUpperCase() }))}
                placeholder="PEPECLASSIC / NAKAMOTOPEPE / —"
              />
            </div>
            <div>
              <span style={label}>HEADLINE OVERRIDE (OPTIONAL)</span>
              <input
                style={input}
                value={form.headline}
                onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                placeholder="CASH BURN CEREMONY (default)"
                maxLength={60}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={label}>QUOTE OVERRIDE (OPTIONAL)</span>
            <input
              style={input}
              value={form.quote}
              onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
              placeholder="leave blank to use the character's default quote"
              maxLength={120}
            />
          </div>

          {/* Preview + Sign-and-burn buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button onClick={doPreview} disabled={busy || !form.character_key || !form.amount} style={btn('var(--amber-hot)', { disabled: busy || !form.character_key || !form.amount })}>
              {busy && burnPhase === 'idle' ? 'rendering…' : '👁 preview'}
            </button>
            <button onClick={signAndOpen} disabled={!canSign} style={btn('var(--green)', { disabled: !canSign })}>
              {burnLabel}
            </button>
          </div>

          {burnSig && (
            <div style={{ marginBottom: 8, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)' }}>
              tx · <a href={`https://solscan.io/tx/${burnSig}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>{burnSig.slice(0, 14)}… ↗</a>
            </div>
          )}

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className={styles.previewFrame} />
          )}

          {/* Manual notarize fallback */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border-dim)' }}>
            <button onClick={() => setShowManual(s => !s)} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-dim)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              {showManual ? '× hide manual notarize' : 'manual notarize (paste an already-confirmed tx) ▾'}
            </button>
            {showManual && (
              <div style={{ marginTop: 8 }}>
                <span style={label}>TX SIGNATURE</span>
                <input style={input} value={manualSig} onChange={e => setManualSig(e.target.value.trim())} placeholder="paste a confirmed Solana tx signature" />
                <div style={{ height: 8 }} />
                <span style={label}>ADMIN WALLET (THAT SIGNED IT)</span>
                <input style={input} value={manualWal} onChange={e => setManualWal(e.target.value.trim())} placeholder="paste the signing wallet pubkey" />
                <div style={{ marginTop: 8, fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-dim)' }}>
                  Use this only if the wallet step succeeded but the server submit failed. The server will re-verify on-chain — same checks as the live flow.
                </div>
                <button onClick={manualNotarize} disabled={busy || !manualSig || !manualWal || !form.character_key || !form.amount}
                        style={{ ...btn('var(--green)', { disabled: busy || !manualSig || !manualWal || !form.character_key || !form.amount }), marginTop: 8 }}>
                  {busy ? 'notarizing…' : '✓ notarize this tx as ceremony'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Recent ceremonies */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-dim)' }}>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '3px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
          recent ceremonies {loading && '…'}
        </div>
        {list.length === 0 && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
            no ceremonies yet
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map(b => (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: 8, border: '1px solid var(--border-dim)' }}>
              <span style={{ fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: '2px', color: b.status === 'active' ? 'var(--green)' : 'var(--text-dim)' }}>
                #{String(b.ordinal).padStart(3, '0')}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fmtFull(b.amount)} $CASH · <span style={{ color: 'var(--text-dim)' }}>{b.character_key}</span>
                {b.card_name && <span style={{ color: 'var(--amber)' }}> · {b.card_name}</span>}
                {b.tx_sig && (
                  <a href={`https://solscan.io/tx/${b.tx_sig}`} target="_blank" rel="noopener noreferrer"
                     style={{ marginLeft: 6, fontSize: 9, color: 'var(--green)', textDecoration: 'underline' }}>
                    tx↗
                  </a>
                )}
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-dim)' }}>[{b.status}]</span>
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <a href={`/burns/${b.id}`} target="_blank" rel="noopener noreferrer" style={{ ...btn('var(--text-dim)'), fontSize: 10, padding: '6px 10px', textDecoration: 'none' }}>view</a>
                {b.status === 'active' && (
                  <button onClick={() => doClose(b.id)} disabled={busy} style={{ ...btn('var(--red)', { disabled: busy }), fontSize: 10, padding: '6px 10px' }}>close</button>
                )}
                {b.status === 'closed' && (
                  <button onClick={() => doArchive(b.id)} disabled={busy} style={{ ...btn('var(--text-dim)', { disabled: busy }), fontSize: 10, padding: '6px 10px' }}>archive</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

