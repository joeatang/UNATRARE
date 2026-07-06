'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const CASH_MINT   = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const TOKEN_PROG  = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROG = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
const SALUTE_BURN_PROGRAM_ID = process.env.NEXT_PUBLIC_SALUTE_BURN_PROGRAM_ID || '';
const RPC_URL_RAW = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '/api/solana/rpc';
const WEB3_CDN    = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.98.0/lib/index.iife.min.js';
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const pendingSigKey = (card) => `unatrare:pendingSalute:${(card || '').toUpperCase()}`;

// Fire Spread: read the stored referral code (set by Nav on first ?ref= visit).
// Returns undefined when absent so it's simply omitted from the request body.
// The server ignores it entirely unless the reward_referral flag is ON.
function readStoredRef() {
  try { return localStorage.getItem('unat_ref') || undefined; } catch { return undefined; }
}

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

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return n.toFixed(0);
}

function truncWallet(addr) {
  if (!addr) return '';
  return addr.slice(0, 5) + '…' + addr.slice(-4);
}

// Parse display string (e.g. "2500000") → BigInt raw amount, safe for large numbers
function parseToRaw(str, decimals) {
  if (!str || !str.trim()) return 0n;
  const clean = str.trim().replace(/,/g, '');
  const [intPart = '0', decPart = ''] = clean.split('.');
  const padded = decPart.padEnd(decimals, '0').slice(0, decimals);
  try {
    return BigInt(intPart) * BigInt(10 ** decimals) + BigInt(padded || '0');
  } catch { return 0n; }
}

// Build SPL Token burn instruction manually (no @solana/spl-token needed)
function buildBurnIx(web3, tokenAcct, mint, owner, rawAmt, tokenProgramId) {
  const data = new Uint8Array(9);
  data[0] = 8; // Burn instruction index
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

// Build SPL Token transfer instruction manually.
function buildTransferIx(web3, sourceAcct, destinationAcct, owner, rawAmt, tokenProgramId) {
  const data = new Uint8Array(9);
  data[0] = 3; // Transfer instruction index
  let n = rawAmt;
  for (let i = 1; i <= 8; i++) { data[i] = Number(n & 0xFFn); n >>= 8n; }
  const programId = tokenProgramId === TOKEN_2022_PROG ? TOKEN_2022_PROG : TOKEN_PROG;
  return new web3.TransactionInstruction({
    programId: new web3.PublicKey(programId),
    keys: [
      { pubkey: new web3.PublicKey(sourceAcct),      isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(destinationAcct), isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(owner),           isSigner: true,  isWritable: false },
    ],
    data,
  });
}

// Derive the canonical Associated Token Account address for (owner, mint, tokenProgram).
// The address is a deterministic PDA — anyone can compute it offline. Cannot be spoofed.
function deriveAta(web3, ownerPubkey, mintPubkey, tokenProgramId) {
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [
      new web3.PublicKey(ownerPubkey).toBuffer(),
      new web3.PublicKey(tokenProgramId).toBuffer(),
      new web3.PublicKey(mintPubkey).toBuffer(),
    ],
    new web3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
  );
  return pda.toString();
}

// Build the canonical "create ATA idempotent" instruction. If the ATA already
// exists this becomes a no-op on-chain (no rent charged twice). The payer pays
// ~0.00203 SOL rent the first time only. The payer gets ZERO authority over
// the new account — ownership is set to `owner` on creation by the ATA program.
function buildCreateAtaIdempotentIx(web3, payer, ataAddress, owner, mint, tokenProgramId) {
  return new web3.TransactionInstruction({
    programId: new web3.PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
    keys: [
      { pubkey: new web3.PublicKey(payer),         isSigner: true,  isWritable: true },
      { pubkey: new web3.PublicKey(ataAddress),    isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(owner),         isSigner: false, isWritable: false },
      { pubkey: new web3.PublicKey(mint),          isSigner: false, isWritable: false },
      { pubkey: new web3.PublicKey(SYSTEM_PROGRAM_ID), isSigner: false, isWritable: false },
      { pubkey: new web3.PublicKey(tokenProgramId), isSigner: false, isWritable: false },
    ],
    data: new Uint8Array([1]), // 1 = CreateIdempotent
  });
}

function toU64Le(n) {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}

function toU32Le(n) {
  return new Uint8Array([
    n & 0xff,
    (n >> 8) & 0xff,
    (n >> 16) & 0xff,
    (n >> 24) & 0xff,
  ]);
}

async function getAnchorDiscriminator(name) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('web crypto not available in this browser');
  }
  const bytes = new TextEncoder().encode(`global:${name}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest).slice(0, 8);
}

// Build Anchor-style instruction: discriminator + u64 amount + utf8 card name.
async function buildProgramBurnIx(web3, { programId, tokenAcct, mint, owner, rawAmt, tokenProgramId, cardName }) {
  const discr = await getAnchorDiscriminator('burn_salute');
  const nameBytes = new TextEncoder().encode((cardName || '').slice(0, 64));
  const data = new Uint8Array(discr.length + 8 + 4 + nameBytes.length);
  data.set(discr, 0);
  data.set(toU64Le(rawAmt), 8);
  data.set(toU32Le(nameBytes.length), 16);
  data.set(nameBytes, 20);

  const tokenProgram = tokenProgramId === TOKEN_2022_PROG ? TOKEN_2022_PROG : TOKEN_PROG;
  return new web3.TransactionInstruction({
    programId: new web3.PublicKey(programId),
    keys: [
      { pubkey: new web3.PublicKey(owner),     isSigner: true,  isWritable: true },
      { pubkey: new web3.PublicKey(tokenAcct), isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(mint),      isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(tokenProgram), isSigner: false, isWritable: false },
    ],
    data,
  });
}

// Detect installed Solana wallets via window providers
function detectWallets() {
  if (typeof window === 'undefined') return [];
  const w = [];
  if (window.phantom?.solana?.isPhantom)  w.push({ id: 'phantom',  name: 'Phantom',  provider: window.phantom.solana });
  if (window.solflare?.isSolflare)        w.push({ id: 'solflare', name: 'Solflare', provider: window.solflare });
  if (window.backpack?.isBackpack)        w.push({ id: 'backpack', name: 'Backpack', provider: window.backpack });
  if (window.okxwallet?.solana)           w.push({ id: 'okx',      name: 'OKX',      provider: window.okxwallet.solana });
  // Generic fallback injected by other wallets
  if (!w.length && window.solana?.isConnected !== undefined) {
    w.push({ id: 'generic', name: 'Solana Wallet', provider: window.solana });
  }
  // De-duplicate in case multiple window aliases point to the same provider.
  const seen = new Set();
  return w.filter(entry => {
    const key = entry.id + ':' + (entry.provider?.publicKey?.toString?.() || entry.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isProbablyMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`Solana RPC HTTP ${res.status}`);
  }
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
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'failed to load balance');
  }
  if (!json.found || !json.account) return null;
  const tokenAmount = {
    uiAmount: json.account.uiBalance || 0,
    amount: json.account.rawBalance || '0',
    decimals: json.account.decimals ?? 6,
  };
  return {
    address:    json.account.address,
    uiBalance:  tokenAmount.uiAmount || 0,
    rawBalance: BigInt(tokenAmount.amount),
    decimals:   tokenAmount.decimals,
    tokenProgram: json.account.tokenProgram || TOKEN_PROG,
  };
}

// Poll for confirmation, re-broadcasting the signed tx every few seconds so that
// dropped/forgotten transactions still land. Bounded by lastValidBlockHeight if
// available, otherwise a hard maxTries fallback.
async function waitConfirmed(sig, opts = {}) {
  const { rawTx = null, lastValidBlockHeight = 0, maxTries = 60 } = opts;
  let lastBroadcast = Date.now();
  for (let i = 0; i < maxTries; i++) {
    const res = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
    const st = res?.value?.[0];
    if (st?.err) throw new Error('Transaction failed on-chain');
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return;

    // Re-broadcast every ~3s so a dropped tx still has a chance to land.
    if (rawTx && Date.now() - lastBroadcast > 3000) {
      try { await rpc('sendTransaction', [rawTx, { skipPreflight: true, encoding: 'base64', maxRetries: 0 }]); } catch {}
      lastBroadcast = Date.now();
    }

    // Stop early if we already know the blockhash is past its expiry.
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

async function sendBurnTxWithWallet(provider, tx, web3) {
  // Prefer signTransaction → sendRawTransaction. This path only asks the wallet
  // to sign raw bytes, bypassing wallet-level token-risk screening (which both
  // Phantom and Solflare apply to signAndSendTransaction for unverified tokens).
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

  // Fallback: some wallet adapters only expose signAndSendTransaction.
  if (provider?.signAndSendTransaction) {
    const sendResult = await provider.signAndSendTransaction(tx);
    const sig = typeof sendResult === 'string' ? sendResult : sendResult?.signature;
    if (!sig) throw new Error('wallet did not return a transaction signature');
    return { sig, rawB64: null };
  }

  throw new Error('wallet does not support transaction signing for this action');
}

function isWalletDeniedMsg(message) {
  const lower = String(message || '').toLowerCase();
  return (
    lower.includes('access forbidden') ||
    lower.includes('forbidden') ||
    lower.includes('user denied') ||
    lower.includes('rejected') ||
    lower.includes('denied')
  );
}

// ── Styles — inline, matching the UNATRARE design system ─────────────────
const S = {
  wrap:        { margin: '32px 0', border: '1px solid #222', background: 'rgba(180,255,111,0.015)' },
  header:      { padding: '10px 14px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel: { fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 },
  headerChain: { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)' },
  body:        { padding: '14px 16px' },
  statRow:     { display: 'flex', gap: 28, marginBottom: 16, flexWrap: 'wrap' },
  statBlock:   { display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel:   { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)' },
  statValue:   { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: 2, color: 'var(--green)', lineHeight: 1 },
  statUnit:    { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginLeft: 4 },
  table:       { width: '100%', borderCollapse: 'collapse', marginBottom: 14 },
  th:          { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', textAlign: 'left', padding: '0 8px 8px 0', borderBottom: '1px solid #1e1e1e' },
  thRight:     { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', textAlign: 'right', padding: '0 0 8px 0', borderBottom: '1px solid #1e1e1e' },
  tdRank:      { fontFamily: 'var(--font-card)', fontSize: '10px', color: 'var(--text-dim)', padding: '7px 10px 7px 0', borderBottom: '1px solid #141414', width: 28 },
  td:          { fontFamily: 'var(--font-card)', fontSize: '10px', color: 'var(--text)', padding: '7px 8px 7px 0', borderBottom: '1px solid #141414', verticalAlign: 'middle' },
  tdRight:     { fontFamily: 'var(--font-card)', fontSize: '10px', color: 'var(--green)', textAlign: 'right', padding: '7px 0 7px 0', borderBottom: '1px solid #141414' },
  genesisTag:  { fontFamily: 'var(--font-card)', fontSize: '7px', letterSpacing: '2px', color: 'var(--amber)', marginLeft: 7, padding: '1px 5px', border: '1px solid rgba(168,144,96,0.35)', verticalAlign: 'middle' },
  label:       { display: 'block', fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 5, marginTop: 10 },
  input:       { width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: '#0a0a0a', border: '1px solid #262626', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 16, outline: 'none' },
  hint:        { fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4, marginBottom: 14 },
  cancelBtn:   { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', padding: '10px 16px', border: '1px solid #262626', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' },
  error:       { fontFamily: 'var(--font-body)', fontSize: '11px', color: '#ff5555', marginTop: 8, lineHeight: 1.5 },
  successBox:  { padding: '10px 12px', border: '1px solid var(--green)', background: 'rgba(180,255,111,0.04)', marginBottom: 12 },
  successTxt:  { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' },
  emptyNote:   { fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 },
  mintAddr:    { fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--amber)', wordBreak: 'break-all', display: 'block', marginTop: 2 },
  // ── Native burn UI ───────────────────────────────────────────────────────
  sectionDivider: { borderTop: '1px solid #1a1a1a', margin: '16px 0 14px' },
  walletRow:   { display: 'flex', flexDirection: 'column', gap: 7 },
  walletBtn:   { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', padding: '10px 14px', border: '1px solid #2a2a2a', background: '#0c0c0c', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', transition: 'border-color 0.15s' },
  connBar:     { padding: '8px 12px', background: '#0a0a0a', border: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  connAddr:    { fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)' },
  disconnBtn:  { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', padding: '3px 8px', border: '1px solid #333', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' },
  balRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  balLabel:    { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)' },
  balValue:    { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--green)', letterSpacing: 1, lineHeight: 1 },
  pctRow:      { display: 'flex', gap: 6, marginTop: 6, marginBottom: 2 },
  pctBtn:      { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', padding: '4px 10px', border: '1px solid #2a2a2a', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' },
  burnBtn:     { fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '4px', padding: '13px 0', border: '1px solid rgba(255,100,0,0.5)', background: 'rgba(255,80,0,0.07)', color: '#ff8844', cursor: 'pointer', width: '100%', marginTop: 12 },
  burnBtnOff:  { opacity: 0.35, cursor: 'not-allowed' },
  statusMsg:   { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)', padding: '18px 0', textAlign: 'center', letterSpacing: 1 },
  noWalletMsg: { fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, padding: '4px 0 10px' },
  mobileTip:   { fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--amber)', lineHeight: 1.6, marginTop: 8, marginBottom: 10 },
  manualToggle:{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', cursor: 'pointer', padding: '10px 0 0', textDecoration: 'underline', display: 'block' },
  submitBtn:   { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', padding: '10px 22px', border: 'none', background: 'var(--green)', color: '#080808', cursor: 'pointer' },
};

export default function SalutePanel({ cardName }) {
  // ── Leaderboard ──────────────────────────────────────────────────────────
  const [lb,        setLb]        = useState(null);
  const [lbLoading, setLbLoading] = useState(true);

  // ── Web3 + wallet ────────────────────────────────────────────────────────
  const [web3,      setWeb3]      = useState(null);   // window.solanaWeb3 once loaded
  const [wallets,   setWallets]   = useState([]);     // detected wallet providers
  const [connected, setConnected] = useState(null);   // { id, name, provider, pubkey }
  const [cashAcct,  setCashAcct]  = useState(null);   // { address, uiBalance, rawBalance, decimals }

  // ── Burn UI ──────────────────────────────────────────────────────────────
  // phase: idle | connecting | fetching | ready | burning | confirming | submitting | success | error
  const [phase,      setPhase]      = useState('idle');
  const [burnAmount, setBurnAmount] = useState('');
  const [burnErr,    setBurnErr]    = useState('');
  const [burnResult, setBurnResult] = useState(null); // { displayAmount, rank }
  const [burnSig,    setBurnSig]    = useState('');   // tx sig — for explorer link + timeout errors
  const successRef = useRef(null);
  useEffect(() => {
    if (phase === 'success' && successRef.current) {
      // Defer until next paint so layout settles before we scroll.
      requestAnimationFrame(() => {
        successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [phase]);
  const [ceremonySplit, setCeremonySplit] = useState({
    burnPct: 100,
    artistPct: 0,
    requireArtistSplitTx: false,
    artistSolAddress: '',
    status: 'none',
    themeKey: 'ember',
  });

  // Theme palette — server picks one randomly per activation; we just paint with it.
  const THEME_PALETTE = {
    ember:     { color: '#ffb347', label: 'EMBER',     glyph: '🪵' },
    flame:     { color: '#ff7a3d', label: 'FLAME',     glyph: '🔥' },
    inferno:   { color: '#ff3d3d', label: 'INFERNO',   glyph: '🌋' },
    legendary: { color: '#d4af37', label: 'LEGENDARY', glyph: '👑' },
    frost:     { color: '#7adfff', label: 'FROST',     glyph: '❄️' },
    neon:      { color: '#b4ff6f', label: 'NEON',      glyph: '⚡' },
    void:      { color: '#b87aff', label: 'VOID',      glyph: '🌌' },
    gold:      { color: '#ffd24a', label: 'GOLD',      glyph: '✨' },
  };
  const themePalette = THEME_PALETTE[ceremonySplit.themeKey] || THEME_PALETTE.ember;
  const ceremonyLive = ceremonySplit.status === 'active' && ceremonySplit.requireArtistSplitTx && ceremonySplit.artistPct > 0;

  // ── Manual TxID fallback ─────────────────────────────────────────────────
  const [showManual,   setShowManual]   = useState(false);
  const [manualSig,    setManualSig]    = useState('');
  const [manualWallet, setManualWallet] = useState('');
  const [manualPhase,  setManualPhase]  = useState('idle'); // idle | submitting | success
  const [manualErr,    setManualErr]    = useState('');
  const [manualResult, setManualResult] = useState(null);

  // ── Load CDN web3.js + detect wallets ───────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const init = () => {
      setWeb3(window.solanaWeb3 || null);
      setWallets(detectWallets());
    };
    if (window.solanaWeb3) { init(); return; }
    const s = document.createElement('script');
    s.src = WEB3_CDN;
    s.onload = init;
    s.onerror = () => setWallets([]); // CDN failed → manual-only mode
    document.head.appendChild(s);
  }, []);

  // ── Fetch leaderboard ────────────────────────────────────────────────────
  const fetchLb = useCallback(async () => {
    try {
      const res = await fetch(`/api/salute?card=${encodeURIComponent(cardName)}`);
      if (res.ok) setLb(await res.json());
    } catch {}
    setLbLoading(false);
  }, [cardName]);

  useEffect(() => { fetchLb(); }, [fetchLb]);

  // ── Recover any pending tx_sig that never made it to the server ──────────
  // If a previous salute burned on-chain but the POST failed (site down,
  // network blip, tab closed mid-submit), retry it transparently on next
  // visit. The server is idempotent on tx_sig (UNIQUE), so this is safe.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      let pending;
      try {
        const raw = localStorage.getItem(pendingSigKey(cardName));
        if (!raw) return;
        pending = JSON.parse(raw);
      } catch { return; }
      if (!pending?.sig || !SOL_SIG_RE.test(pending.sig)) {
        try { localStorage.removeItem(pendingSigKey(cardName)); } catch {}
        return;
      }
      try {
        const resp = await fetch('/api/salute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_name: cardName, sol_wallet: pending.wallet, tx_sig: pending.sig }),
        });
        const json = await resp.json().catch(() => ({}));
        // Clear on success OR on duplicate (already recorded). Keep on transient errors so we can retry next visit.
        const dup = /already been recorded/i.test(json?.error || '');
        if (resp.ok || dup) {
          try { localStorage.removeItem(pendingSigKey(cardName)); } catch {}
          if (!cancelled) fetchLb();
        }
      } catch {
        // network down — leave the pending entry for next visit
      }
    })();
    return () => { cancelled = true; };
  }, [cardName, fetchLb]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/salute/ceremony?card=${encodeURIComponent(cardName)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.ceremony || !active) return;
        setCeremonySplit({
          burnPct: Number(json?.ceremony?.burnPct ?? 100),
          artistPct: Number(json?.ceremony?.artistPct ?? 0),
          requireArtistSplitTx: !!json?.ceremony?.requireArtistSplitTx,
          status: String(json?.ceremony?.status || 'none'),
          artistSolAddress: String(json?.ceremony?.artistSolAddress || '').trim(),
          themeKey: String(json?.ceremony?.themeKey || 'ember'),
        });
      } catch {
        // Keep burn-only as the safe default when ceremony metadata cannot be fetched.
      }
    })();
    return () => { active = false; };
  }, [cardName]);

  // ── Connect wallet ───────────────────────────────────────────────────────
  async function connectWallet(w) {
    setPhase('connecting');
    setBurnErr('');

    const hydrateConnected = async (pubkey) => {
      setConnected({ ...w, pubkey });
      setPhase('fetching');
      let acct = null;
      try {
        acct = await getCashAccount(pubkey);
      } catch {
        // Keep UI usable even if a balance fetch fails transiently.
        acct = null;
      }
      setCashAcct(acct);
      setBurnErr('');
      setPhase('ready');
    };

    try {
      const alreadyPubkey = w.provider?.publicKey?.toString?.();
      if (alreadyPubkey && SOL_ADDR_RE.test(alreadyPubkey)) {
        await hydrateConnected(alreadyPubkey);
        return;
      }

      await w.provider.connect();
      const pubkey = w.provider.publicKey?.toString();
      if (!pubkey) throw new Error('wallet did not return a public key');
      await hydrateConnected(pubkey);
    } catch (e) {
      const fallbackPubkey = w.provider?.publicKey?.toString?.();
      if (fallbackPubkey && SOL_ADDR_RE.test(fallbackPubkey)) {
        try {
          await hydrateConnected(fallbackPubkey);
          return;
        } catch {}
      }

      const msg = (e.message || '').toLowerCase();
      // Phantom in-app browser throws "forbidden" / "User rejected the request"
      // when the site isn't trusted or the user dismisses the approval dialog.
      const isRejected = msg.includes('forbidden') || msg.includes('rejected') ||
                         msg.includes('user denied') || msg.includes('cancelled') ||
                         msg.includes('canceled');
      if (isRejected) {
        setBurnErr(
          'Wallet connection was denied. ' +
          (mobile
            ? "In Phantom's in-app browser, tap the connect request that appears and approve it, then try again. Or use the manual transaction form below - burn from your wallet first, then paste the transaction ID here."
            : 'Please approve the connection request in your wallet and try again.')
        );
        if (mobile) setShowManual(true);
      } else {
        setBurnErr(e.message || 'connection failed');
      }
      setCashAcct(null);
      setPhase('idle');
    }
  }

  function disconnect() {
    try { connected?.provider?.disconnect?.(); } catch {}
    setConnected(null);
    setCashAcct(null);
    setBurnAmount('');
    setBurnErr('');
    setBurnResult(null);
    setBurnSig('');
    setPhase('idle');
  }

  async function refreshBalance() {
    if (!connected) return;
    setPhase('fetching');
    setBurnErr('');
    try {
      const acct = await getCashAccount(connected.pubkey);
      setCashAcct(acct);
      setPhase('ready');
    } catch {
      setCashAcct(null);
      setBurnErr('Could not load $CASH balance. Click refresh balance to try again.');
      setPhase('ready');
    }
  }

  function burnAgain() {
    setBurnAmount('');
    setBurnErr('');
    setBurnResult(null);
    setBurnSig('');
    setPhase('ready');
  }

  // ── Set % quick-select ───────────────────────────────────────────────────
  function setPercent(pct) {
    if (!cashAcct || !cashAcct.uiBalance) return;
    const val = pct === 100
      ? Math.floor(cashAcct.uiBalance).toString()
      : Math.floor(cashAcct.uiBalance * pct / 100).toString();
    setBurnAmount(val);
  }

  // ── Execute native burn ──────────────────────────────────────────────────
  async function executeBurn() {
    if (!web3 || !connected || !cashAcct) return;
    setBurnErr('');

    const totalRawAmt = parseToRaw(burnAmount, cashAcct.decimals);
    if (totalRawAmt <= 0n) { setBurnErr('Enter a salute amount.'); return; }

    const burnPct = Number(ceremonySplit.burnPct || 100);
    const artistPct = Number(ceremonySplit.artistPct || 0);
    // Always honor the configured split when the card has a payout address.
    // We don't gate on `requireArtistSplitTx` — that flag now only controls
    // whether the *server* rejects salutes missing the artist leg. The
    // frontend should always pay the artist when a split is in effect.
    const requiresArtistSplit = artistPct > 0 && SOL_ADDR_RE.test(ceremonySplit.artistSolAddress || '');

    // Default: no split — the entire amount is burned.
    let burnRawAmt = totalRawAmt;
    let artistRawAmt = 0n;

    if (requiresArtistSplit) {
      if (!SOL_ADDR_RE.test(ceremonySplit.artistSolAddress || '')) {
        setBurnErr('Artist payout address is not configured for this ceremony yet. Try again shortly.');
        return;
      }
      // Split the amount the user entered: artist gets `artistPct` of total,
      // burn gets `burnPct` of total. Any rounding residue (≤ 1 raw unit) goes
      // to burn so the artist never receives a higher percentage than declared
      // and total spend never exceeds the entered amount.
      artistRawAmt = (totalRawAmt * BigInt(artistPct)) / 100n;
      burnRawAmt = totalRawAmt - artistRawAmt;
      if (artistRawAmt <= 0n) {
        setBurnErr('Salute amount is too small to split. Increase the amount.');
        return;
      }
      if (burnRawAmt <= 0n) {
        setBurnErr('Salute amount is too small to burn. Increase the amount.');
        return;
      }
    }

    if (totalRawAmt > cashAcct.rawBalance) {
      setBurnErr('Amount exceeds your $CASH balance.');
      return;
    }

    setPhase('burning');
    let localSig = ''; // preserve for error messages if confirmation times out
    try {
      // Preflight: every Solana tx needs a tiny amount of SOL to pay the network fee,
      // even when burning a non-SOL token. Surface this clearly so users top up.
      try {
        const balRes = await rpc('getBalance', [connected.pubkey, { commitment: 'confirmed' }]);
        const lamports = typeof balRes === 'object' ? (balRes?.value ?? 0) : (balRes ?? 0);
        // 5000 lamports = base fee. Require ~0.001 SOL headroom for safety.
        if (lamports < 1_000_000) {
          setBurnErr(
            'Your wallet needs a little SOL to pay the Solana network fee (~0.001 SOL is plenty). ' +
            'Send some SOL to this wallet and try again. This is a Solana network requirement — the SOL is not paid to UNATRARE.'
          );
          setPhase('ready');
          return;
        }
      } catch { /* if the balance check fails, let the on-chain error path handle it */ }
      // Some wallet adapters drop signing permission while keeping a cached pubkey.
      // Reconnect if the provider reports disconnected before attempting to sign.
      if (connected.provider?.isConnected === false && connected.provider?.connect) {
        await connected.provider.connect();
      }

      // Build transaction
      const { blockhash, lastValidBlockHeight } = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])
        .then(r => ({ blockhash: r.value.blockhash, lastValidBlockHeight: r.value.lastValidBlockHeight }));

      const burnIx = buildBurnIx(
        web3,
        cashAcct.address,
        CASH_MINT,
        connected.pubkey,
        burnRawAmt,
        cashAcct.tokenProgram,
      );

      let artistTransferIx = null;
      let createArtistAtaIx = null;
      if (requiresArtistSplit) {
        // $CASH is Token-2022. Use the saluter's tokenProgram (same mint = same program).
        const artistTokenProgram = cashAcct.tokenProgram || TOKEN_2022_PROG;
        const artistCashAcct = await getCashAccount(ceremonySplit.artistSolAddress);
        let destAta;
        if (artistCashAcct?.address) {
          // Existing ATA found — use it. Server validates by owner+mint, so any
          // owner-controlled ATA is acceptable.
          destAta = artistCashAcct.address;
        } else {
          // No ATA yet — derive the canonical address and add an idempotent
          // create instruction. The saluter pays the one-time ~0.002 SOL rent.
          // The artist pubkey is the only owner; payer has no authority.
          destAta = deriveAta(web3, ceremonySplit.artistSolAddress, CASH_MINT, artistTokenProgram);
          createArtistAtaIx = buildCreateAtaIdempotentIx(
            web3,
            connected.pubkey,           // payer = saluter
            destAta,
            ceremonySplit.artistSolAddress, // owner = artist
            CASH_MINT,
            artistTokenProgram,
          );
        }
        artistTransferIx = buildTransferIx(
          web3,
          cashAcct.address,
          destAta,
          connected.pubkey,
          artistRawAmt,
          cashAcct.tokenProgram,
        );
      }

      const useProgramBurn = !!(SALUTE_BURN_PROGRAM_ID && SOL_ADDR_RE.test(SALUTE_BURN_PROGRAM_ID));
      const finalBurnIx = useProgramBurn
        ? await buildProgramBurnIx(web3, {
            programId: SALUTE_BURN_PROGRAM_ID,
            tokenAcct: cashAcct.address,
            mint: CASH_MINT,
            owner: connected.pubkey,
            rawAmt: burnRawAmt,
            tokenProgramId: cashAcct.tokenProgram,
            cardName: (cardName || '').toUpperCase().trim(),
          })
        : burnIx;
      const tx    = new web3.Transaction({ recentBlockhash: blockhash, feePayer: new web3.PublicKey(connected.pubkey) });
      if (createArtistAtaIx) tx.add(createArtistAtaIx);
      if (artistTransferIx) tx.add(artistTransferIx);
      tx.add(finalBurnIx);

      // Sign + send via wallet using signTransaction (raw bytes path — avoids wallet token-risk screening).
      let sig;
      const sent = await sendBurnTxWithWallet(connected.provider, tx, web3);
      sig = sent.sig;
      if (!sig) throw new Error('wallet did not return a transaction signature');
      localSig = sig;
      setBurnSig(sig);
      // Persist tx_sig immediately so a site outage during POST cannot lose it.
      try { localStorage.setItem(pendingSigKey(cardName), JSON.stringify({ sig, wallet: connected.pubkey, ts: Date.now() })); } catch {}

      setPhase('confirming');
      await waitConfirmed(sig, { rawTx: sent.rawB64, lastValidBlockHeight });

      setPhase('submitting');
      const resp = await fetch('/api/salute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name:  cardName,
          sol_wallet: connected.pubkey,
          tx_sig:     sig,
          ref:        readStoredRef(),
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || 'server error');

      try { localStorage.removeItem(pendingSigKey(cardName)); } catch {}
      setBurnResult({ displayAmount: json.displayAmount, artistDisplay: json.artistDisplay || 0, rank: json.rank });
      setPhase('success');
      // Refresh balance + leaderboard
      getCashAccount(connected.pubkey).then(a => { if (a) setCashAcct(a); });
      fetchLb();
    } catch (e) {
      const isTimeout = e.message?.includes('Confirmation timeout');
      const msg = e?.message || 'burn failed';
      const isRpc403 = /solana rpc http 403/i.test(msg);
      const isForbidden = !isRpc403 && isWalletDeniedMsg(msg);
      const isNoLamports = /attempt to debit an account but found no record of a prior credit/i.test(msg)
                        || /insufficient funds for fee/i.test(msg);

      if (isNoLamports) {
        setBurnErr(
          'Your wallet needs a little SOL to pay the Solana network fee (~0.001 SOL is plenty). ' +
          'Send some SOL to this wallet and try again. This is a Solana network requirement — the SOL is not paid to UNATRARE.'
        );
      } else if (isTimeout && localSig) {
        setBurnErr(`Confirmation timed out - your burn may still confirm. Check: solscan.io/tx/${localSig}`);
      } else if (isRpc403) {
        setBurnErr(
          'Solana RPC rejected this request (HTTP 403). This is a network/provider issue, not a wallet rejection. ' +
          'Set NEXT_PUBLIC_SOLANA_RPC_URL to a dedicated RPC endpoint (Helius/QuickNode/Alchemy) and retry.'
        );
      } else if (isForbidden) {
        const isSolflare = connected?.id === 'solflare';
        setBurnErr(
          isSolflare
            ? `Solflare is blocking this burn because $CASH is flagged as an unverified token in their system — this is a Solflare policy, not a problem with unatrare.wtf. Switch to Phantom (phantom.app) for a seamless one-click burn.`
            : `Your wallet declined the request. Open your wallet extension and approve the signing prompt for unatrare.wtf, then try again. If it keeps blocking, use the transaction ID section below.`
        );
        setShowManual(true);
      } else {
        setBurnErr(msg);
      }
      setPhase('ready');
    }
  }

  // ── Manual TxID submit ───────────────────────────────────────────────────
  async function handleManual(e) {
    e.preventDefault();
    setManualErr('');
    if (!manualSig.trim() || !SOL_SIG_RE.test(manualSig.trim())) {
      setManualErr('Paste a valid Solana transaction signature.'); return;
    }
    if (!manualWallet.trim() || !SOL_ADDR_RE.test(manualWallet.trim())) {
      setManualErr('Enter a valid Solana wallet address.'); return;
    }
    setManualPhase('submitting');
    try {
      const resp = await fetch('/api/salute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name:  cardName,
          sol_wallet: manualWallet.trim(),
          tx_sig:     manualSig.trim(),
          ref:        readStoredRef(),
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || 'verification failed');
      setManualResult({ displayAmount: json.displayAmount, rank: json.rank });
      setManualPhase('success');
      fetchLb();
    } catch (e) {
      setManualErr(e.message);
      setManualPhase('idle');
    }
  }

  const isEmpty = !lbLoading && (!lb || !lb.uniqueSaluters);
  const isBusy  = ['connecting','fetching','burning','confirming','submitting'].includes(phase);
  const mobile = isProbablyMobile();

  // ── Phase status messages ────────────────────────────────────────────────
  const statusMessages = {
    connecting: '↗ opening wallet…',
    fetching:   '↗ loading $CASH balance…',
    burning:    '🔥 approve in your wallet…',
    confirming: '⏳ confirming on Solana…',
    submitting: '📡 recording salute…',
  };

  return (
    <div style={S.wrap}>
      {/* Subtle burn animations — injected once per panel */}
      <style>{`
        @keyframes salute-flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          25%      { opacity: 0.65; transform: scale(1.08) rotate(-3deg); }
          50%      { opacity: 1; transform: scale(0.95); }
          75%      { opacity: 0.8; transform: scale(1.05) rotate(2deg); }
        }
        @keyframes salute-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 rgba(180,255,111,0); border-color: var(--green); }
          50%      { box-shadow: 0 0 18px rgba(180,255,111,0.35); border-color: rgba(180,255,111,0.9); }
        }
        @keyframes salute-ember-rise {
          0%   { opacity: 0; transform: translateY(8px); }
          50%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-12px); }
        }
        .salute-flame-flicker { display: inline-block; animation: salute-flicker 1.4s ease-in-out infinite; transform-origin: 50% 80%; }
        .salute-success-box   { animation: salute-glow-pulse 2.4s ease-in-out infinite; }
        .salute-burn-btn:hover:not(:disabled) {
          background: rgba(255,80,0,0.14) !important;
          border-color: rgba(255,140,40,0.85) !important;
          box-shadow: 0 0 14px rgba(255,100,0,0.25);
        }
      `}</style>
      {/* ── Header ── */}
      <div style={{ ...S.header, ...(ceremonyLive ? { borderTopColor: themePalette.color, boxShadow: `inset 0 1px 0 0 ${themePalette.color}, 0 0 24px ${themePalette.color}22` } : {}) }}>
        <span style={S.headerLabel}>
          <span style={{ fontSize: 14 }}>🔥</span>
          THE SALUTE LEDGER
          {ceremonyLive && (
            <span style={{ marginLeft: 8, padding: '2px 8px', border: `1px solid ${themePalette.color}`, color: themePalette.color, fontSize: 9, letterSpacing: '0.18em', textShadow: `0 0 8px ${themePalette.color}88`, animation: 'salutePulse 2.4s ease-in-out infinite' }}>
              {themePalette.glyph} {themePalette.label} LIVE
            </span>
          )}
        </span>
        <span style={S.headerChain}>$CASH · SOLANA</span>
      </div>

      <div style={S.body}>
        {/* ── Loading ── */}
        {lbLoading && (
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', padding: '4px 0 8px' }}>
            loading…
          </div>
        )}

        {/* ── Stats + leaderboard ── */}
        {!lbLoading && lb && lb.uniqueSaluters > 0 && (
          <>
            <div style={S.statRow}>
              <div style={S.statBlock}>
                <span style={S.statLabel}>TOTAL BURNED</span>
                <span style={S.statValue}>
                  {fmt(lb.totalBurnDisplay || lb.totalDisplay)}
                  <span style={S.statUnit}>$CASH</span>
                </span>
              </div>
              {Number(lb.totalArtistDisplay || 0) > 0 ? (
                <div style={S.statBlock}>
                  <span style={S.statLabel}>TO ARTIST</span>
                  <span style={S.statValue}>
                    {fmt(lb.totalArtistDisplay)}
                    <span style={S.statUnit}>$CASH</span>
                  </span>
                </div>
              ) : (
                <div style={S.statBlock}>
                  <span style={S.statLabel}>TO ARTIST</span>
                  <span style={S.statValue}>
                    0
                    <span style={S.statUnit}>$CASH</span>
                  </span>
                </div>
              )}
              <div style={S.statBlock}>
                <span style={S.statLabel}>SALUTERS</span>
                <span style={S.statValue}>{lb.uniqueSaluters}</span>
              </div>
            </div>

            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>#</th>
                  <th style={S.th}>WALLET</th>
                  <th style={S.thRight}>BURNED</th>
                </tr>
              </thead>
              <tbody>
                {lb.leaderboard.map((row, i) => {
                  const isGenesis = row.sol_wallet === lb.firstSaluter;
                  return (
                    <tr key={row.sol_wallet}>
                      <td style={S.tdRank}>{i + 1}</td>
                      <td style={S.td}>
                        <span title={row.sol_wallet}>{truncWallet(row.sol_wallet)}</span>
                        {isGenesis && <span style={S.genesisTag}>GENESIS</span>}
                      </td>
                      <td style={S.tdRight}>{fmt(row.total_display)} $CASH</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* ── Empty state ── */}
        {!lbLoading && isEmpty && phase !== 'success' && (
          <div style={S.emptyNote}>
            No salutes yet. Be the first to honor this card — your burn enters the founding record, forever attributed to your wallet.
          </div>
        )}

        {/* ══ Native burn section ════════════════════════════════════════════ */}
        <div style={S.sectionDivider} />

        {/* Always-visible newcomer essentials */}
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text)',
          lineHeight: 1.6, marginBottom: 12, padding: '8px 11px',
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'rgba(255,180,0,0.05)',
        }}>
          <strong style={{ color: 'var(--amber)' }}>To salute you need a Solana wallet + $CASH.</strong>{' '}
          Burning is <strong style={{ color: 'var(--text)' }}>permanent</strong> — it can&apos;t be undone.{' '}
          <a href="/start" style={{ color: 'var(--amber)' }}>New here? →</a>
        </div>

        {phase !== 'success' && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 14 }}>
          <strong style={{ color: 'var(--text)' }}>Salute this card</strong> by burning $CASH on Solana. Permanent. Public. Forever attributed to your wallet — your name lives on this card.
          {ceremonyLive ? (
            <>
              <br />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  padding: '6px 12px',
                  border: `1px solid ${themePalette.color}`,
                  background: `linear-gradient(90deg, ${themePalette.color}26 0%, ${themePalette.color}0A 100%)`,
                  color: themePalette.color,
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  textShadow: `0 0 10px ${themePalette.color}77`,
                  boxShadow: `0 0 14px ${themePalette.color}33, inset 0 0 12px ${themePalette.color}1A`,
                  borderRadius: 2,
                  animation: 'salutePulse 2.4s ease-in-out infinite',
                }}
              >
                <span aria-hidden style={{ fontSize: 14 }}>{themePalette.glyph}</span>
                {themePalette.label} CEREMONY · LIVE SPLIT SALUTE
              </span>
              <style jsx>{`
                @keyframes salutePulse {
                  0%, 100% { box-shadow: 0 0 14px ${themePalette.color}33, inset 0 0 12px ${themePalette.color}1A; }
                  50%      { box-shadow: 0 0 22px ${themePalette.color}66, inset 0 0 16px ${themePalette.color}2E; }
                }
              `}</style>
              <br />
              A live ceremony is running for this card. The amount you enter is the total salute: {ceremonySplit.burnPct}% is burned and {ceremonySplit.artistPct}% goes to the artist in the same transaction.
            </>
          ) : ceremonySplit.status === 'scheduled' ? (
            <>
              <br />
              <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', border: '1px solid var(--text-dim)', color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ceremony scheduled
              </span>
              <br />
              A ceremony is scheduled — until it starts, the standing split below applies.
            </>
          ) : ceremonySplit.requireArtistSplitTx && Number(ceremonySplit.artistPct || 0) > 0 ? (
            <>
              <br />
              <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', border: '1px solid rgba(180,255,111,0.4)', color: 'var(--green)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                standing split · {ceremonySplit.burnPct}% burn / {ceremonySplit.artistPct}% artist
              </span>
              <br />
              The artist has set their payout address — every salute splits {ceremonySplit.burnPct}% to the burn and {ceremonySplit.artistPct}% to the artist in the same transaction.
            </>
          ) : (
            <>
              <br />
              <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                100% burn
              </span>
              <br />
              The artist hasn&apos;t set a payout address yet — the full amount you enter is burned.
            </>
          )}
          <br />
          New here? <a href="/about/salutes" style={{ color: 'var(--amber)' }}>What is a salute? →</a>
          <br />
          Need $CASH first? Buy on{' '}
          <a href="https://nat.fun/?refId=c69c9108f52b" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>
            nat.fun
          </a>
          .
        </div>
        )}

        {/* ── Security / wallet-warning education ─────────────────────────── */}
        <details style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: 'var(--text-dim)',
          lineHeight: 1.6,
          marginBottom: 14,
          padding: '10px 12px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'rgba(255,180,0,0.04)',
        }}>
          <summary style={{ cursor: 'pointer', color: 'var(--amber)', fontWeight: 600 }}>
            ⚠ Why does my wallet warn about $CASH? (read before connecting)
          </summary>
          <div style={{ marginTop: 10 }}>
            $CASH is a <strong style={{ color: 'var(--text)' }}>new Solana SPL Token-2022</strong> minted on{' '}
            <a href="https://nat.fun/?refId=c69c9108f52b" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>nat.fun</a>.
            Because it's young and the ticker is generic, Phantom / Solflare / Backpack may show an
            <em> &ldquo;unverified token&rdquo;</em> or <em>&ldquo;low-trust&rdquo;</em> warning. That is normal for any new token —
            it is not evidence of a scam.
            <br /><br />
            <strong style={{ color: 'var(--text)' }}>Triple-check before signing:</strong>
            <ul style={{ margin: '6px 0 6px 18px', padding: 0 }}>
              <li>URL bar reads exactly <code style={{ color: 'var(--green)' }}>https://unatrare.wtf</code> (no lookalikes).</li>
              <li>Mint: <code style={{ wordBreak: 'break-all' }}>oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat</code></li>
              <li>Token program: <code>TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb</code> (Token-2022)</li>
              <li>Burn program: <code style={{ wordBreak: 'break-all' }}>2kociKNJcSLo1TytiyWvT1r8sdFdLMZu9mMYHfogjxZc</code></li>
              <li>Your wallet should ask to <strong>burn</strong> $CASH — never to transfer SOL or approve unlimited spending.</li>
              <li>This panel never asks for your seed phrase. Ever. Close the tab if anything else shows up.</li>
            </ul>
            Verify any signature on{' '}
            <a href="https://solscan.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>solscan.io</a>
            {' '}before and after burning. The transaction must show <code>Burn</code> on the $CASH mint above — nothing else.
          </div>
        </details>

        {/* Connected wallet bar — stays visible through signing + confirmation */}
        {connected && (
          <>
            <div style={S.connBar}>
              <span style={S.connAddr}>
                {connected.id === 'phantom' ? '👻' : connected.id === 'solflare' ? '🌟' : connected.id === 'backpack' ? '🎒' : connected.id === 'okx' ? '🅾️' : '💳'}
                {' '}{connected.name} · {truncWallet(connected.pubkey)}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button style={S.disconnBtn} onClick={refreshBalance}>REFRESH BALANCE</button>
                <button style={S.disconnBtn} onClick={disconnect}>DISCONNECT</button>
              </div>
            </div>
            <div style={{ ...S.hint, marginTop: -4, marginBottom: 10 }}>
              <strong style={{ color: 'var(--text)' }}>Refresh balance</strong> checks this wallet for the $CASH token account.
              When it loads, you can type <strong style={{ color: 'var(--text)' }}>any custom burn amount</strong>.
            </div>
          </>
        )}

        {/* Status spinner while busy */}
        {isBusy && (
          <div style={S.statusMsg}>
            <span className="salute-flame-flicker" style={{ marginRight: 8, fontSize: 16 }}>🔥</span>
            {statusMessages[phase]}
          </div>
        )}

        {/* Web3 still loading */}
        {!isBusy && !web3 && phase === 'idle' && (
          <div style={{ ...S.statusMsg, paddingTop: 4 }}>loading wallet connectors…</div>
        )}

        {/* Wallet connect — no wallet detected */}
        {!isBusy && web3 && wallets.length === 0 && phase === 'idle' && !connected && (
          <div style={S.noWalletMsg}>
            No Solana wallet detected.{' '}
            <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 'bold' }}>Install Phantom</a>{' '}
            for the best $CASH burn experience — one click, no blocks.
            {!mobile && (
              <div style={{ ...S.hint, marginTop: 8 }}>
                Phantom and Backpack both support $CASH seamlessly.
                Solflare may block $CASH burns due to its token-verification policy.
              </div>
            )}
            {mobile && (
              <div style={S.mobileTip}>
                Open this page inside Phantom's built-in browser: tap the browser icon inside the app, navigate to unatrare.wtf, and the connect button will appear automatically.
              </div>
            )}
          </div>
        )}

        {/* Wallet connect buttons */}
        {!isBusy && web3 && wallets.length > 0 && phase === 'idle' && !connected && (
          <div>
            <span style={{ ...S.label, marginTop: 0 }}>CONNECT WALLET TO SALUTE</span>
            <div style={{ ...S.hint, marginBottom: 10 }}>
              <strong style={{ color: 'var(--green)' }}>Recommended: Phantom</strong> — seamless one-click burn for $CASH.
              Solflare may block $CASH transactions due to token verification policies.
            </div>
            {mobile && (
              <div style={S.mobileTip}>
                Tap connect below — your wallet will show an approval prompt. Accept it, then return here to burn.
              </div>
            )}
            <div style={S.walletRow}>
              {wallets.map(w => (
                <button key={w.id} style={{ ...S.walletBtn, ...(w.id === 'phantom' ? { borderColor: 'rgba(180,255,111,0.4)', color: 'var(--green)' } : {}) }} onClick={() => connectWallet(w)}>
                  <span style={{ fontSize: 16 }}>
                    {w.id === 'phantom' ? '👻' : w.id === 'solflare' ? '🌟' : w.id === 'backpack' ? '🎒' : w.id === 'okx' ? '🅾️' : '💳'}
                  </span>
                  {w.name}
                  {w.id === 'phantom' && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-card)', fontSize: '7px', letterSpacing: '2px', color: 'var(--green)', opacity: 0.7 }}>RECOMMENDED</span>}
                  {w.id === 'solflare' && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-card)', fontSize: '7px', letterSpacing: '2px', color: 'var(--amber)', opacity: 0.7 }}>MAY BLOCK $CASH</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connected + ready: burn form */}
        {!isBusy && connected && phase === 'ready' && (
          <div>
            {cashAcct ? (
              <div style={S.balRow}>
                <span style={S.balLabel}>$CASH BALANCE</span>
                <span style={S.balValue}>{fmt(cashAcct.uiBalance)} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>$CASH</span></span>
              </div>
            ) : (
              <div style={{ ...S.balLabel, marginBottom: 10 }}>no $CASH token account found</div>
            )}

            {cashAcct && cashAcct.uiBalance > 0 && (
              <>
                <label style={{ ...S.label, marginTop: 0 }}>SALUTE AMOUNT ($CASH)</label>
                <input
                  style={S.input}
                  type="number"
                  min="1"
                  step="1"
                  value={burnAmount}
                  onChange={e => setBurnAmount(e.target.value)}
                  onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                  placeholder="e.g. 500000"
                />
                <div style={{ ...S.hint, marginTop: 6, marginBottom: 8 }}>
                  Type any custom amount, or use quick buttons below.
                </div>
                {ceremonySplit.requireArtistSplitTx && Number(ceremonySplit.artistPct || 0) > 0 && (
                  <div style={{ ...S.hint, marginTop: 0, marginBottom: 8, color: 'var(--amber)' }}>
                    {ceremonySplit.status === 'active' ? 'Split ceremony is active' : 'Standing split is active'}: the amount you enter is the <strong style={{ color: 'var(--text)' }}>total salute</strong>. {ceremonySplit.burnPct}% is burned and {ceremonySplit.artistPct}% routes to the artist — all in one transaction.
                    <br />
                    <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                      First-time salute for this artist may include a ~0.002 SOL one-time setup fee to create their $CASH payout account. Subsequent salutes by anyone are free of this fee.
                    </span>
                  </div>
                )}
                <div style={S.pctRow}>
                  {[10, 25, 50, 100].map(pct => (
                    <button key={pct} style={S.pctBtn} onClick={() => setPercent(pct)}>
                      {pct === 100 ? 'MAX' : pct + '%'}
                    </button>
                  ))}
                </div>

                {burnErr && <div style={S.error}>{burnErr}</div>}

                <button
                  className="salute-burn-btn"
                  style={{ ...S.burnBtn, ...(!burnAmount || parseFloat(burnAmount) <= 0 ? S.burnBtnOff : {}) }}
                  onClick={executeBurn}
                  disabled={!burnAmount || parseFloat(burnAmount) <= 0}
                >
                  <span className="salute-flame-flicker" style={{ marginRight: 8 }}>🔥</span>
                  SALUTE THIS CARD
                </button>
              </>
            )}

            {cashAcct && cashAcct.uiBalance === 0 && (
              <div style={S.noWalletMsg}>
                This wallet has no $CASH balance.{' '}
                $CASH mint: <code style={S.mintAddr}>{CASH_MINT}</code>
              </div>
            )}

            {!cashAcct && (
              <div style={{ border: '1px solid #2a2a2a', padding: '12px', marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text)' }}>
                  $CASH BALANCE NOT LOADED YET
                </div>
                <div style={{ ...S.hint, marginTop: 6, marginBottom: 10 }}>
                  Click <strong style={{ color: 'var(--text)' }}>REFRESH BALANCE</strong> to load your wallet token account.
                  If this wallet has no $CASH, buy on nat.fun and refresh again.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={{ ...S.pctBtn, padding: '8px 14px', color: 'var(--green)', borderColor: 'var(--green)' }} onClick={refreshBalance}>
                    ↻ REFRESH BALANCE
                  </button>
                  <a href="https://nat.fun/?refId=c69c9108f52b" target="_blank" rel="noopener noreferrer" style={{ ...S.pctBtn, padding: '8px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                    BUY $CASH →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connected but not yet in ready/success state: keep next step obvious */}
        {!isBusy && connected && phase === 'idle' && (
          <div style={{ border: '1px solid #2a2a2a', padding: '12px', marginTop: 8, marginBottom: 6 }}>
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text)' }}>
              CONNECTED. NEXT STEP: LOAD YOUR $CASH BALANCE.
            </div>
            <div style={{ ...S.hint, marginTop: 6, marginBottom: 10 }}>
              Once balance loads, amount input and burn button will appear below.
            </div>
            <button
              style={{ ...S.pctBtn, padding: '8px 14px', color: 'var(--green)', borderColor: 'var(--green)' }}
              onClick={refreshBalance}
            >
              ↻ LOAD BALANCE
            </button>
          </div>
        )}

        {/* Connected + success: confirmed result + explorer link + burn again */}
        {!isBusy && connected && phase === 'success' && burnResult && (
          <div ref={successRef} className="salute-success-box" style={{ padding: '12px 14px', border: '1px solid var(--green)', background: 'rgba(180,255,111,0.05)', marginBottom: 12, scrollMarginTop: '20vh' }}>
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '2px', color: 'var(--green)', marginBottom: 6 }}>
              <span className="salute-flame-flicker" style={{ marginRight: 6 }}>🔥</span>
              {fmt(burnResult.displayAmount)} $CASH BURNED · RANK #{burnResult.rank}
            </div>
            {burnResult.artistDisplay > 0 && (
              <div style={{ ...S.hint, marginTop: 0, marginBottom: 8, color: 'var(--text)' }}>
                + {fmt(burnResult.artistDisplay)} $CASH routed to the artist
              </div>
            )}
            {burnSig && (
              <div style={{ marginBottom: 10 }}>
                <a
                  href={`https://solscan.io/tx/${burnSig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--amber)', textDecoration: 'none' }}
                >
                  view transaction on Solscan ↗
                </a>
              </div>
            )}
            <div style={{ ...S.hint, marginBottom: 12 }}>
              Your position is live on the leaderboard.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={{ ...S.pctBtn, padding: '8px 16px' }} onClick={burnAgain}>
                SALUTE AGAIN
              </button>
              <a
                href={`https://twitter.com/intent/tweet?${new URLSearchParams({
                  text: `Just saluted ${cardName} on UNATRARE 🔥\n\n${fmt(burnResult.displayAmount)} $CASH burned on Solana · rank #${burnResult.rank} · forever on the ledger.\n\nYour name lives on the card.`,
                  url:  `https://unatrare.wtf/card/${cardName}`,
                }).toString()}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...S.pctBtn, padding: '8px 16px', textDecoration: 'none', color: 'var(--amber)', borderColor: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                SHARE ON X ↗
              </a>
            </div>
          </div>
        )}

        {/* Error shown when phase is idle after wallet rejection or connection failure */}
        {burnErr && phase === 'idle' && !connected && (
          <div style={S.error}>{burnErr}</div>
        )}

        {/* ══ Manual TxID fallback ════════════════════════════════════════════ */}
        <div style={S.sectionDivider} />
        <button style={S.manualToggle} onClick={() => { setShowManual(v => !v); setManualErr(''); }}>
          {showManual ? '↑ hide' : 'already burned in another wallet? paste transaction id →'}
        </button>

        {showManual && (
          <form onSubmit={handleManual} style={{ marginTop: 12 }}>
            {manualResult && (
              <div style={{ ...S.successBox, marginBottom: 12 }}>
                <div style={S.successTxt}>
                  🔥 SALUTE RECORDED — {fmt(manualResult.displayAmount)} $CASH burned · rank #{manualResult.rank}
                </div>
              </div>
            )}

            <label style={{ ...S.label, marginTop: 0 }}>SOLANA TRANSACTION SIGNATURE *</label>
            <input
              style={S.input}
              value={manualSig}
              onChange={e => setManualSig(e.target.value)}
              placeholder="paste your burn transaction ID here..."
              autoComplete="off"
              spellCheck={false}
            />

            <label style={S.label}>YOUR SOLANA WALLET ADDRESS *</label>
            <input
              style={S.input}
              value={manualWallet}
              onChange={e => setManualWallet(e.target.value)}
              placeholder="the wallet that authorized the burn…"
              autoComplete="off"
              spellCheck={false}
            />

            {manualErr && <div style={S.error}>{manualErr}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="submit" style={S.submitBtn} disabled={manualPhase === 'submitting'}>
                {manualPhase === 'submitting' ? 'VERIFYING ON-CHAIN…' : 'SUBMIT SALUTE'}
              </button>
              <button type="button" style={S.cancelBtn} onClick={() => { setShowManual(false); setManualErr(''); }}>
                CLOSE
              </button>
            </div>

            <div style={{ ...S.hint, marginTop: 10 }}>
              Burn is verified on Solana mainnet. Any Solana wallet works - Phantom, Solflare, Backpack, and others.
              {' '}To purchase $CASH, use{' '}
              <a href="https://nat.fun/?refId=c69c9108f52b" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>
                nat.fun
              </a>
              .
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

