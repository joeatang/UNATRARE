'use client';

import { useState, useEffect, useCallback } from 'react';

const CASH_MINT   = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const TOKEN_PROG  = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RPC_URL     = 'https://api.mainnet-beta.solana.com';
const WEB3_CDN    = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.98.0/lib/index.iife.min.js';
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

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
function buildBurnIx(web3, tokenAcct, mint, owner, rawAmt) {
  const data = new Uint8Array(9);
  data[0] = 8; // Burn instruction index
  let n = rawAmt;
  for (let i = 1; i <= 8; i++) { data[i] = Number(n & 0xFFn); n >>= 8n; }
  return new web3.TransactionInstruction({
    programId: new web3.PublicKey(TOKEN_PROG),
    keys: [
      { pubkey: new web3.PublicKey(tokenAcct), isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(mint),      isSigner: false, isWritable: true },
      { pubkey: new web3.PublicKey(owner),     isSigner: true,  isWritable: false },
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
  // Generic fallback injected by other wallets
  if (!w.length && window.solana?.isConnected !== undefined) {
    w.push({ id: 'generic', name: 'Solana Wallet', provider: window.solana });
  }
  return w;
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const { result, error } = await res.json();
  if (error) throw new Error(error.message);
  return result;
}

async function getCashAccount(walletPubkey) {
  const result = await rpc('getTokenAccountsByOwner', [
    walletPubkey,
    { mint: CASH_MINT },
    { encoding: 'jsonParsed' },
  ]);
  const accounts = result?.value || [];
  if (!accounts.length) return null;
  // Use the account with the highest balance (handles rare edge case of multiple ATAs)
  accounts.sort((a, b) =>
    Number(BigInt(b.account.data.parsed.info.tokenAmount.amount) -
           BigInt(a.account.data.parsed.info.tokenAmount.amount))
  );
  const { tokenAmount } = accounts[0].account.data.parsed.info;
  return {
    address:    accounts[0].pubkey,
    uiBalance:  tokenAmount.uiAmount || 0,
    rawBalance: BigInt(tokenAmount.amount),
    decimals:   tokenAmount.decimals,
  };
}

// Poll for confirmation (more reliable in browser than subscriptions)
async function waitConfirmed(sig, maxTries = 40) {
  for (let i = 0; i < maxTries; i++) {
    const res = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
    const st = res?.value?.[0];
    if (st?.err) throw new Error('Transaction failed on-chain');
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return;
    await new Promise(r => setTimeout(r, 800));
  }
  throw new Error('Confirmation timeout — check Solana Explorer for status');
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
  input:       { width: '100%', padding: '9px 11px', boxSizing: 'border-box', background: '#0a0a0a', border: '1px solid #262626', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12, outline: 'none' },
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
  const [cpAddr,     setCpAddr]     = useState('');
  const [burnErr,    setBurnErr]    = useState('');
  const [burnResult, setBurnResult] = useState(null); // { displayAmount, rank }

  // ── Manual TxID fallback ─────────────────────────────────────────────────
  const [showManual,   setShowManual]   = useState(false);
  const [manualSig,    setManualSig]    = useState('');
  const [manualWallet, setManualWallet] = useState('');
  const [manualCp,     setManualCp]     = useState('');
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

  // ── Connect wallet ───────────────────────────────────────────────────────
  async function connectWallet(w) {
    setPhase('connecting');
    setBurnErr('');
    try {
      await w.provider.connect();
      const pubkey = w.provider.publicKey?.toString();
      if (!pubkey) throw new Error('wallet did not return a public key');
      setConnected({ ...w, pubkey });
      setPhase('fetching');
      const acct = await getCashAccount(pubkey);
      setCashAcct(acct);
      setPhase('ready');
    } catch (e) {
      setBurnErr(e.message || 'connection failed');
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
    setPhase('idle');
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

    const rawAmt = parseToRaw(burnAmount, cashAcct.decimals);
    if (rawAmt <= 0n) { setBurnErr('Enter an amount to burn.'); return; }
    if (rawAmt > cashAcct.rawBalance) { setBurnErr('Amount exceeds your $CASH balance.'); return; }

    setPhase('burning');
    try {
      // Build transaction
      const { blockhash, lastValidBlockHeight } = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])
        .then(r => ({ blockhash: r.value.blockhash, lastValidBlockHeight: r.value.lastValidBlockHeight }));

      const instr = buildBurnIx(web3, cashAcct.address, CASH_MINT, connected.pubkey, rawAmt);
      const tx    = new web3.Transaction({ recentBlockhash: blockhash, feePayer: new web3.PublicKey(connected.pubkey) });
      tx.add(instr);

      // Sign & send via wallet — handle both { signature } and raw string returns
      const sendResult = await connected.provider.signAndSendTransaction(tx);
      const sig = typeof sendResult === 'string' ? sendResult : sendResult?.signature;
      if (!sig) throw new Error('wallet did not return a transaction signature');

      setPhase('confirming');
      await waitConfirmed(sig);

      setPhase('submitting');
      const resp = await fetch('/api/salute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name:  cardName,
          sol_wallet: connected.pubkey,
          tx_sig:     sig,
          cp_address: cpAddr.trim(),
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || 'server error');

      setBurnResult({ displayAmount: json.displayAmount, rank: json.rank });
      setPhase('success');
      // Refresh balance + leaderboard
      getCashAccount(connected.pubkey).then(a => { if (a) setCashAcct(a); });
      fetchLb();
    } catch (e) {
      setBurnErr(e.message || 'burn failed');
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
    if (manualCp.trim() && !BTC_ADDR_RE.test(manualCp.trim())) {
      setManualErr('Counterparty address must start with 1 or 3.'); return;
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
          cp_address: manualCp.trim(),
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
      {/* ── Header ── */}
      <div style={S.header}>
        <span style={S.headerLabel}>
          <span style={{ fontSize: 14 }}>🔥</span>
          SALUTE RECORD
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
                  {fmt(lb.totalDisplay)}
                  <span style={S.statUnit}>$CASH</span>
                </span>
              </div>
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
            No salutes yet. Be the first to burn $CASH and honor this card —
            your wallet enters the founding record.
          </div>
        )}

        {/* ── Success after native burn ── */}
        {phase === 'success' && burnResult && (
          <div style={{ ...S.successBox, marginBottom: 14 }}>
            <div style={S.successTxt}>
              🔥 SALUTE RECORDED — {fmt(burnResult.displayAmount)} $CASH burned · rank #{burnResult.rank}
            </div>
            {cashAcct && (
              <div style={{ ...S.statLabel, marginTop: 6 }}>
                remaining balance: {fmt(cashAcct.uiBalance)} $CASH
              </div>
            )}
          </div>
        )}

        {/* ══ Native burn section ════════════════════════════════════════════ */}
        <div style={S.sectionDivider} />

        {/* Status spinner while busy */}
        {isBusy && (
          <div style={S.statusMsg}>{statusMessages[phase]}</div>
        )}

        {/* Web3 still loading */}
        {!isBusy && !web3 && phase === 'idle' && (
          <div style={{ ...S.statusMsg, paddingTop: 4 }}>loading wallet connectors…</div>
        )}

        {/* Wallet connect — no wallet detected */}
        {!isBusy && web3 && wallets.length === 0 && phase === 'idle' && !connected && (
          <div style={S.noWalletMsg}>
            No Solana wallet extension detected. Install{' '}
            <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>Phantom</a>,{' '}
            <a href="https://solflare.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>Solflare</a>, or{' '}
            <a href="https://backpack.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>Backpack</a> to burn $CASH natively.
            <br />Or use the manual TxID form below if you burned elsewhere.
          </div>
        )}

        {/* Wallet connect buttons */}
        {!isBusy && web3 && wallets.length > 0 && phase === 'idle' && !connected && (
          <div>
            <span style={{ ...S.label, marginTop: 0 }}>CONNECT SOLANA WALLET TO BURN</span>
            <div style={S.walletRow}>
              {wallets.map(w => (
                <button key={w.id} style={S.walletBtn} onClick={() => connectWallet(w)}>
                  <span style={{ fontSize: 16 }}>
                    {w.id === 'phantom' ? '👻' : w.id === 'solflare' ? '🌟' : w.id === 'backpack' ? '🎒' : '💳'}
                  </span>
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connected + ready / success: show burn UI */}
        {!isBusy && connected && (phase === 'ready' || phase === 'success') && (
          <div>
            {/* Connected wallet bar */}
            <div style={S.connBar}>
              <span style={S.connAddr}>
                {connected.id === 'phantom' ? '👻' : connected.id === 'solflare' ? '🌟' : '💳'}
                {' '}{connected.name} · {truncWallet(connected.pubkey)}
              </span>
              <button style={S.disconnBtn} onClick={disconnect}>DISCONNECT</button>
            </div>

            {/* Balance */}
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
                <label style={{ ...S.label, marginTop: 0 }}>AMOUNT TO BURN</label>
                <input
                  style={S.input}
                  type="number"
                  min="1"
                  step="1"
                  value={burnAmount}
                  onChange={e => setBurnAmount(e.target.value)}
                  placeholder="e.g. 500000"
                  disabled={phase === 'success'}
                />
                <div style={S.pctRow}>
                  {[10, 25, 50, 100].map(pct => (
                    <button key={pct} style={S.pctBtn} onClick={() => setPercent(pct)}>
                      {pct === 100 ? 'MAX' : pct + '%'}
                    </button>
                  ))}
                </div>

                <label style={S.label}>COUNTERPARTY ADDRESS (optional)</label>
                <input
                  style={S.input}
                  value={cpAddr}
                  onChange={e => setCpAddr(e.target.value)}
                  placeholder="1YourBitcoinAddress — for art drop eligibility"
                  autoComplete="off"
                />
                <div style={{ ...S.hint, marginBottom: 0 }}>
                  Provide your Counterparty address to be eligible for card drops awarded to top saluters.
                </div>

                {burnErr && <div style={S.error}>{burnErr}</div>}

                <button
                  style={{ ...S.burnBtn, ...((!burnAmount || parseFloat(burnAmount) <= 0 || phase === 'success') ? S.burnBtnOff : {}) }}
                  onClick={executeBurn}
                  disabled={!burnAmount || parseFloat(burnAmount) <= 0 || phase === 'success'}
                >
                  🔥 BURN $CASH
                </button>
              </>
            )}

            {cashAcct && cashAcct.uiBalance === 0 && (
              <div style={S.noWalletMsg}>
                This wallet has no $CASH balance.{' '}
                $CASH mint: <code style={S.mintAddr}>{CASH_MINT}</code>
              </div>
            )}
          </div>
        )}

        {/* Error after burn attempt that left phase as ready already shown inline */}
        {burnErr && phase === 'idle' && (
          <div style={S.error}>{burnErr}</div>
        )}

        {/* ══ Manual TxID fallback ════════════════════════════════════════════ */}
        <div style={S.sectionDivider} />
        <button style={S.manualToggle} onClick={() => { setShowManual(v => !v); setManualErr(''); }}>
          {showManual ? '↑ hide' : 'burned in another wallet or CLI? paste TxID →'}
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
              placeholder="paste your burn TxID here…"
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

            <label style={S.label}>COUNTERPARTY ADDRESS (optional)</label>
            <input
              style={S.input}
              value={manualCp}
              onChange={e => setManualCp(e.target.value)}
              placeholder="1YourBitcoinAddress — for art drop eligibility"
              autoComplete="off"
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
              Burn is verified on Solana mainnet. Any Solana wallet works — Phantom, Solflare, Backpack, CLI, etc.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

