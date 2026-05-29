'use client';

import { useState, useEffect, useCallback } from 'react';

const CASH_MINT   = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function truncWallet(addr) {
  if (!addr) return '';
  return addr.slice(0, 5) + '…' + addr.slice(-4);
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
  saluteBtn:   { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', padding: '10px 0', border: '1px solid var(--green)', background: 'transparent', color: 'var(--green)', cursor: 'pointer', width: '100%' },
  label:       { display: 'block', fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 5, marginTop: 10 },
  input:       { width: '100%', padding: '9px 11px', boxSizing: 'border-box', background: '#0a0a0a', border: '1px solid #262626', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12, outline: 'none' },
  instructBox: { fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.7, padding: '10px 12px', background: '#0a0a0a', border: '1px solid #1e1e1e', marginBottom: 4 },
  hint:        { fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4, marginBottom: 14 },
  submitBtn:   { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', padding: '10px 22px', border: 'none', background: 'var(--green)', color: '#080808', cursor: 'pointer' },
  cancelBtn:   { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', padding: '10px 16px', border: '1px solid #262626', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' },
  error:       { fontFamily: 'var(--font-body)', fontSize: '11px', color: '#ff5555', marginTop: 8, lineHeight: 1.5 },
  successBox:  { padding: '10px 12px', border: '1px solid var(--green)', background: 'rgba(180,255,111,0.04)', marginBottom: 12 },
  successTxt:  { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' },
  emptyNote:   { fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 },
  mintAddr:    { fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--amber)', wordBreak: 'break-all', display: 'block', marginTop: 2 },
};

export default function SalutePanel({ cardName }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [txSig,      setTxSig]      = useState('');
  const [solWallet,  setSolWallet]  = useState('');
  const [cpAddr,     setCpAddr]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');
  const [submitOk,   setSubmitOk]   = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/salute?card=${encodeURIComponent(cardName)}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [cardName]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitErr('');

    if (!txSig.trim() || !SOL_SIG_RE.test(txSig.trim())) {
      setSubmitErr('Paste a valid Solana transaction signature (the TxID from your burn).');
      return;
    }
    if (!solWallet.trim() || !SOL_ADDR_RE.test(solWallet.trim())) {
      setSubmitErr('Enter a valid Solana wallet address.');
      return;
    }
    if (cpAddr.trim() && !BTC_ADDR_RE.test(cpAddr.trim())) {
      setSubmitErr('Counterparty address must start with 1 or 3.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/salute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name:  cardName,
          sol_wallet: solWallet.trim(),
          tx_sig:     txSig.trim(),
          cp_address: cpAddr.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitErr(json.error || 'Verification failed. Check your TxID and try again.');
      } else {
        setSubmitOk(json);
        setTxSig('');
        setSolWallet('');
        setCpAddr('');
        setShowForm(false);
        fetchLeaderboard();
      }
    } catch {
      setSubmitErr('Network error — check your connection and try again.');
    }
    setSubmitting(false);
  }

  const isEmpty = !loading && (!data || !data.uniqueSaluters);

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
        {loading && (
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', padding: '4px 0 8px' }}>
            loading...
          </div>
        )}

        {/* ── Stats + leaderboard ── */}
        {!loading && data && data.uniqueSaluters > 0 && (
          <>
            <div style={S.statRow}>
              <div style={S.statBlock}>
                <span style={S.statLabel}>TOTAL BURNED</span>
                <span style={S.statValue}>
                  {fmt(data.totalDisplay)}
                  <span style={S.statUnit}>$CASH</span>
                </span>
              </div>
              <div style={S.statBlock}>
                <span style={S.statLabel}>SALUTERS</span>
                <span style={S.statValue}>{data.uniqueSaluters}</span>
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
                {data.leaderboard.map((row, i) => {
                  const isGenesis = row.sol_wallet === data.firstSaluter;
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
        {!loading && isEmpty && !showForm && (
          <div style={S.emptyNote}>
            No salutes yet. Be the first to burn $CASH and honor this card.
            Your wallet goes in the founding record.
          </div>
        )}

        {/* ── Success confirmation ── */}
        {submitOk && (
          <div style={S.successBox}>
            <div style={S.successTxt}>
              🔥 SALUTE RECORDED — {fmt(submitOk.displayAmount)} $CASH burned · rank #{submitOk.rank}
            </div>
          </div>
        )}

        {/* ── Salute button or form ── */}
        {!showForm ? (
          <button style={S.saluteBtn} onClick={() => { setShowForm(true); setSubmitOk(null); }}>
            {isEmpty ? '🔥 BE THE FIRST TO SALUTE' : '🔥 SALUTE THIS CARD'}
          </button>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
            {/* Instructions */}
            <div style={S.instructBox}>
              <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px' }}>HOW TO BURN $CASH</strong>
              <br />
              In Phantom → Portfolio → find $CASH → tap ··· → <strong style={{ color: 'var(--text)' }}>Burn tokens</strong>.
              Confirm in your wallet. Then copy the transaction signature and paste it below.
              <br /><br />
              <span style={{ color: 'var(--text-dim)' }}>$CASH mint address on Solana:</span>
              <code style={S.mintAddr}>{CASH_MINT}</code>
            </div>

            <label style={S.label}>SOLANA TRANSACTION SIGNATURE *</label>
            <input
              style={S.input}
              value={txSig}
              onChange={e => setTxSig(e.target.value)}
              placeholder="paste your burn TxID here..."
              autoComplete="off"
              spellCheck={false}
            />

            <label style={S.label}>YOUR SOLANA WALLET ADDRESS *</label>
            <input
              style={S.input}
              value={solWallet}
              onChange={e => setSolWallet(e.target.value)}
              placeholder="the wallet that authorized the burn..."
              autoComplete="off"
              spellCheck={false}
            />

            <label style={S.label}>COUNTERPARTY ADDRESS (optional)</label>
            <input
              style={S.input}
              value={cpAddr}
              onChange={e => setCpAddr(e.target.value)}
              placeholder="1YourBitcoinAddress — for art drop eligibility"
              autoComplete="off"
            />
            <div style={S.hint}>
              Provide your Counterparty address if you want to be eligible for art drops rewarded to top saluters.
            </div>

            {submitErr && <div style={S.error}>{submitErr}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" style={S.submitBtn} disabled={submitting}>
                {submitting ? 'VERIFYING ON-CHAIN…' : 'SUBMIT SALUTE'}
              </button>
              <button
                type="button"
                style={S.cancelBtn}
                onClick={() => { setShowForm(false); setSubmitErr(''); }}
              >
                CANCEL
              </button>
            </div>

            <div style={{ ...S.hint, marginTop: 12 }}>
              Burn is verified on Solana mainnet. Your salute is permanent once confirmed.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
