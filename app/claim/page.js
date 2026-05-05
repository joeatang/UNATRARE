'use client';
import { useState } from 'react';
import Nav from '../components/Nav';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export default function ClaimPage() {
  const [address, setAddress] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | ok | error
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const valid = ADDR_RE.test(address.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    setState('loading');
    setErrMsg('');
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json);
        setState('ok');
      } else {
        setErrMsg(json.error || 'Verification failed');
        setState('error');
      }
    } catch {
      setErrMsg('Network error — please try again');
      setState('error');
    }
  }

  const s = {
    page: {
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      padding: '100px 24px 80px',
      maxWidth: 560,
      margin: '0 auto',
    },
    eyebrow: {
      fontFamily: 'var(--font-card)',
      fontSize: '10px',
      letterSpacing: '4px',
      color: 'var(--text-dim)',
      marginBottom: 12,
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(28px, 6vw, 44px)',
      letterSpacing: 6,
      color: 'var(--text)',
      margin: '0 0 8px',
      lineHeight: 1,
    },
    sub: {
      fontFamily: 'var(--font-card)',
      fontSize: '11px',
      letterSpacing: '3px',
      color: 'var(--amber)',
      marginBottom: 32,
    },
    desc: {
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      lineHeight: 1.8,
      color: 'var(--text-dim)',
      marginBottom: 32,
    },
    label: {
      display: 'block',
      fontFamily: 'var(--font-card)',
      fontSize: '9px',
      letterSpacing: '3px',
      color: 'var(--text-dim)',
      marginBottom: 8,
    },
    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      color: 'var(--text)',
      fontFamily: 'var(--font-card)',
      fontSize: '11px',
      letterSpacing: '1px',
      outline: 'none',
      marginBottom: 16,
    },
    btn: {
      padding: '12px 28px',
      border: '1px solid var(--amber)',
      background: 'transparent',
      color: 'var(--amber)',
      fontFamily: 'var(--font-card)',
      fontSize: '10px',
      letterSpacing: '3px',
      cursor: 'pointer',
    },
    btnDisabled: {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    box: (color) => ({
      marginTop: 24,
      padding: '20px',
      border: `1px solid ${color}`,
      background: `${color}08`,
    }),
    boxTitle: (color) => ({
      fontFamily: 'var(--font-card)',
      fontSize: '10px',
      letterSpacing: '3px',
      color,
      marginBottom: 12,
    }),
    row: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-card)',
      fontSize: '10px',
      letterSpacing: '1px',
      color: 'var(--text-dim)',
      padding: '4px 0',
      borderBottom: '1px solid var(--border-dim)',
    },
    rowVal: (ok) => ({
      color: ok ? 'var(--green)' : 'var(--red)',
      fontWeight: 700,
    }),
    msg: {
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      lineHeight: 1.7,
      marginTop: 12,
    },
  };

  return (
    <>
      <Nav />
      <main style={s.page}>
        <div style={s.eyebrow}>· series i distribution ·</div>
        <h1 style={s.title}>CLAIM UNA<span style={{color:'var(--amber)'}}>T</span>AMOTO</h1>
        <div style={s.sub}>FREE CARD · HOLDERS ONLY</div>

        <p style={s.desc}>
          UNATAMOTO is a Series I Counterparty card issued to wallets that hold both{' '}
          <strong style={{color:'var(--text)'}}>UNATPEPE</strong> and{' '}
          <strong style={{color:'var(--text)'}}>SOFTPWAR</strong> (Series 0, honorary) in the same wallet.
          <br /><br />
          Enter your Bitcoin/Counterparty address below. The system will verify your holdings on-chain
          and add you to the distribution list. UNATAMOTO will be sent directly to your address.
        </p>

        {state !== 'ok' && (
          <form onSubmit={handleSubmit}>
            <label style={s.label} htmlFor="addr">Your Bitcoin / Counterparty Address</label>
            <input
              id="addr"
              style={s.input}
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value.trim())}
              placeholder="1YourBitcoinAddressHere..."
              autoComplete="off"
              spellCheck={false}
              disabled={state === 'loading'}
            />
            {state === 'error' && (
              <div style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'2px',
                color:'var(--red)', marginBottom:12}}>
                ✗ {errMsg}
              </div>
            )}
            <button
              type="submit"
              style={{...s.btn, ...((!valid || state === 'loading') ? s.btnDisabled : {})}}
              disabled={!valid || state === 'loading'}
            >
              {state === 'loading' ? 'verifying...' : '⬡ verify holdings →'}
            </button>
          </form>
        )}

        {state === 'ok' && result && (
          <div style={s.box(result.eligible ? 'var(--green)' : 'var(--red)')}>
            <div style={s.boxTitle(result.eligible ? 'var(--green)' : 'var(--red)')}>
              {result.eligible ? '✓ ELIGIBLE' : '✗ NOT ELIGIBLE'}
            </div>

            <div style={s.row}>
              <span>ADDRESS</span>
              <span style={{color:'var(--text)', fontFamily:'var(--font-card)', fontSize:'10px'}}>
                {result.address.slice(0, 8)}…{result.address.slice(-6)}
              </span>
            </div>
            <div style={s.row}>
              <span>UNATPEPE</span>
              <span style={s.rowVal(result.holdings?.UNATPEPE > 0)}>
                {result.holdings?.UNATPEPE > 0 ? `✓ ${result.holdings.UNATPEPE}` : '✗ 0'}
              </span>
            </div>
            <div style={{...s.row, borderBottom:'none'}}>
              <span>SOFTPWAR</span>
              <span style={s.rowVal(result.holdings?.SOFTPWAR > 0)}>
                {result.holdings?.SOFTPWAR > 0 ? `✓ ${result.holdings.SOFTPWAR}` : '✗ 0'}
              </span>
            </div>

            <p style={s.msg}>{result.message}</p>

            {result.eligible && (
              <p style={{...s.msg, color:'var(--text-dim)', fontSize:'12px'}}>
                Your address is on the distribution list. UNATAMOTO will be sent when the
                artist initiates the drop. No further action required.
              </p>
            )}

            {!result.eligible && (
              <button
                style={{...s.btn, marginTop:16, borderColor:'var(--border)', color:'var(--text-dim)'}}
                onClick={() => { setState('idle'); setResult(null); setAddress(''); }}
              >
                try another address →
              </button>
            )}
          </div>
        )}
      </main>
    </>
  );
}
