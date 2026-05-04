'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from '../submit/submit.module.css'; // reuse submit styles
import pageStyles from './register.module.css';

// ──────────────────────────────────────────────────────────────────
//  Step 0 — Enter BTC address
// ──────────────────────────────────────────────────────────────────
function Step0({ onNext }) {
  const [addr, setAddr]       = useState('');
  const [xcpAddr, setXcpAddr] = useState('');
  const [checking, setChecking] = useState(false);
  const [unatInfo, setUnatInfo] = useState(null); // { holdsUnat, balance, discount }
  const [errMsg, setErrMsg]   = useState('');
  const [sameAddr, setSameAddr] = useState(true);

  const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const validBtc = ADDR_RE.test(addr.trim());
  const validXcp = sameAddr ? validBtc : ADDR_RE.test(xcpAddr.trim());

  async function checkBalance() {
    if (!validBtc) { setErrMsg('Enter a valid Bitcoin address (starts with 1 or 3)'); return; }
    setChecking(true);
    setErrMsg('');
    setUnatInfo(null);
    try {
      const res = await fetch(`/api/check-unat?address=${encodeURIComponent(addr.trim())}`);
      const json = await res.json();
      if (json.ok) {
        setUnatInfo(json);
      } else {
        setErrMsg(json.error || 'Could not check balance');
      }
    } catch {
      setErrMsg('Network error — please try again');
    } finally {
      setChecking(false);
    }
  }

  function handleNext() {
    if (!validBtc || !validXcp) return;
    onNext({
      btcAddress: addr.trim(),
      xcpAddress: sameAddr ? addr.trim() : xcpAddr.trim(),
      unatInfo,
    });
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 1 of 3</div>
      <h2 className={styles.stepTitle}>UNATP<span>E</span>PE</h2>
      <p className={styles.stepDesc}>
        Register your Bitcoin address to unlock the <strong>UNATPEPE holder perks</strong>:<br />
        early access windows + {parseInt(process.env.NEXT_PUBLIC_UNAT_DISCOUNT || '20')}% discount on every drop.
      </p>

      {/* What is UNATPEPE callout */}
      <div className={pageStyles.infoBox}>
        <div className={pageStyles.infoTitle}>✦ what is unatpepe?</div>
        <div className={pageStyles.infoText}>
          UNATPEPE is the TAP protocol utility token for UNATRARE.<br />
          Hold it at your Bitcoin address to qualify for collector perks.<br />
          Get it on: <a href="https://tap3.link" target="_blank" rel="noopener noreferrer">tap3.link</a>
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="btcaddr">Your Bitcoin Address</label>
        <input
          id="btcaddr"
          className={styles.tokenInput}
          style={{ fontSize: 12, letterSpacing: 1, textTransform: 'none' }}
          type="text"
          value={addr}
          onChange={e => { setAddr(e.target.value.trim()); setUnatInfo(null); setErrMsg(''); }}
          placeholder="1YourBitcoinAddressHere"
          autoComplete="off"
          spellCheck={false}
        />
        <div className={styles.inputHint}>
          P2PKH legacy address — the address you hold UNATPEPE at
        </div>
      </div>

      {/* XCP address toggle */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sameAddr}
            onChange={e => setSameAddr(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: 'var(--amber)' }}
          />
          <span style={{ fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: 2, color: 'var(--text-dim)' }}>
            my Counterparty (XCP) address is the same
          </span>
        </label>
      </div>

      {!sameAddr && (
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="xcpaddr">Counterparty Address</label>
          <input
            id="xcpaddr"
            className={styles.tokenInput}
            style={{ fontSize: 12, letterSpacing: 1, textTransform: 'none' }}
            type="text"
            value={xcpAddr}
            onChange={e => { setXcpAddr(e.target.value.trim()); setErrMsg(''); }}
            placeholder="1YourCounterpartyAddress"
            autoComplete="off"
            spellCheck={false}
          />
          <div className={styles.inputHint}>
            The address where you hold/will hold Counterparty tokens
          </div>
        </div>
      )}

      {/* Balance check */}
      {!unatInfo && validBtc && (
        <button
          className={styles.nextBtn}
          style={{ marginBottom: 12, background: 'var(--surface)', color: 'var(--amber)', border: '1px solid var(--amber)' }}
          disabled={checking}
          onClick={checkBalance}
        >
          {checking ? 'checking balance...' : 'check unatpepe balance →'}
        </button>
      )}

      {errMsg && <div className={styles.inputError} style={{ marginBottom: 12 }}>{errMsg}</div>}

      {/* Balance result */}
      {unatInfo && (
        <div className={styles.urlBox} style={{ borderColor: unatInfo.holdsUnat ? 'var(--green)' : 'var(--border)', marginBottom: 20 }}>
          {unatInfo.holdsUnat ? (
            <>
              <div className={styles.urlBoxLabel} style={{ color: 'var(--green)' }}>✓ unatpepe detected</div>
              <div className={styles.urlBoxValue}>{unatInfo.balance} {unatInfo.token?.toUpperCase()}</div>
              <div className={styles.urlBoxMeta} style={{ color: 'var(--green)' }}>
                {unatInfo.discount}% discount unlocked · early access enabled
              </div>
            </>
          ) : (
            <>
              <div className={styles.urlBoxLabel} style={{ color: 'var(--text-dim)' }}>no unatpepe found</div>
              <div className={styles.urlBoxMeta}>
                You can still register — perks activate when you acquire UNATPEPE.<br />
                Balance is re-checked at each drop.
              </div>
            </>
          )}
        </div>
      )}

      {validBtc && validXcp && (
        <button className={styles.nextBtn} onClick={handleNext}>
          continue → sign to verify →
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Step 1 — Sign to prove ownership
// ──────────────────────────────────────────────────────────────────
function Step1({ data, onNext }) {
  const [sig, setSig]         = useState('');
  const [errMsg, setErrMsg]   = useState('');
  const [verifying, setVerifying] = useState(false);

  const challenge = `UNATRARE:REGISTER:${data.btcAddress}`;

  async function handleRegister() {
    if (!sig.trim()) { setErrMsg('Paste your signature'); return; }
    setVerifying(true);
    setErrMsg('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          btcAddress: data.btcAddress,
          xcpAddress: data.xcpAddress,
          signature:  sig.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onNext({ ...data, result: json });
      } else {
        setErrMsg(json.error || 'Registration failed');
        setVerifying(false);
      }
    } catch {
      setErrMsg('Network error — please try again');
      setVerifying(false);
    }
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 2 of 3</div>
      <h2 className={styles.stepTitle}>PR<span>O</span>VE IT</h2>
      <p className={styles.stepDesc}>
        Sign the message below with <strong>{data.btcAddress.slice(0, 14)}…</strong><br />
        using your Bitcoin wallet (Freewallet, Electrum, etc.).<br />
        This proves you control this address.
      </p>

      <div className={styles.urlBox} style={{ marginBottom: 24 }}>
        <div className={styles.urlBoxLabel}>message to sign</div>
        <div className={styles.urlBoxValue} style={{ fontSize: 12, letterSpacing: 1 }}>{challenge}</div>
        <div className={styles.urlBoxMeta}>copy this exactly · paste into your wallet&rsquo;s sign message field</div>
      </div>

      <div className={pageStyles.infoBox} style={{ marginBottom: 20 }}>
        <div className={pageStyles.infoTitle}>⚡ how to sign in Freewallet</div>
        <div className={pageStyles.infoText}>
          Menu → Advanced → Sign Message<br />
          Paste the message above → Sign → Copy the result
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="regsig">Your Signature</label>
        <textarea
          id="regsig"
          value={sig}
          onChange={e => { setSig(e.target.value); setErrMsg(''); }}
          placeholder="paste base64 signature here"
          rows={4}
          style={{
            fontFamily: 'var(--font-card)', fontSize: 11, padding: 12, letterSpacing: 1,
            border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
            resize: 'vertical', width: '100%', boxSizing: 'border-box',
          }}
        />
        {errMsg && <div className={styles.inputError}>{errMsg}</div>}
      </div>

      <button className={styles.nextBtn} disabled={verifying} onClick={handleRegister}>
        {verifying ? 'registering...' : 'register →'}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Step 2 — Confirmed
// ──────────────────────────────────────────────────────────────────
function Step2({ data }) {
  const { result } = data;
  const hasPerks = result?.holdsUnat;
  const balance  = result?.balance ?? 0;
  const discount = result?.discount ?? 0;

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>
        {result?.alreadyRegistered ? 'Updated' : 'Registered'}
      </div>
      <h2 className={styles.stepTitle}>
        {hasPerks ? 'PERK<span>S</span> ON' : 'REGIST<span>E</span>RED'}
      </h2>

      {/* Status card */}
      <div className={pageStyles.confirmCard}>
        <div className={pageStyles.confirmRow}>
          <span className={pageStyles.confirmKey}>btc address</span>
          <span className={pageStyles.confirmVal} style={{ fontSize: 10, wordBreak: 'break-all' }}>
            {data.btcAddress}
          </span>
        </div>
        {data.xcpAddress !== data.btcAddress && (
          <div className={pageStyles.confirmRow}>
            <span className={pageStyles.confirmKey}>xcp address</span>
            <span className={pageStyles.confirmVal} style={{ fontSize: 10, wordBreak: 'break-all' }}>
              {data.xcpAddress}
            </span>
          </div>
        )}
        <div className={pageStyles.confirmRow}>
          <span className={pageStyles.confirmKey}>unatpepe balance</span>
          <span className={pageStyles.confirmVal} style={{ color: hasPerks ? 'var(--green)' : 'var(--text-dim)' }}>
            {balance > 0 ? `${balance} UNATPEPE` : 'none detected'}
          </span>
        </div>
        <div className={pageStyles.confirmRow}>
          <span className={pageStyles.confirmKey}>discount</span>
          <span className={pageStyles.confirmVal} style={{ color: discount > 0 ? 'var(--green)' : 'var(--text-dim)' }}>
            {discount > 0 ? `${discount}% off submission fee` : 'standard rate'}
          </span>
        </div>
        <div className={pageStyles.confirmRow}>
          <span className={pageStyles.confirmKey}>early access</span>
          <span className={pageStyles.confirmVal} style={{ color: hasPerks ? 'var(--green)' : 'var(--text-dim)' }}>
            {hasPerks ? '✓ enabled' : 'acquire UNATPEPE to unlock'}
          </span>
        </div>
      </div>

      {result?.balanceWarning && (
        <div className={styles.urlBox} style={{ borderColor: 'var(--amber)', marginTop: 16, marginBottom: 0 }}>
          <div className={styles.urlBoxLabel} style={{ color: 'var(--amber)' }}>⚠ balance check warning</div>
          <div className={styles.urlBoxMeta}>{result.balanceWarning}</div>
          <div className={styles.urlBoxMeta}>Your registration was saved — balance will be re-checked at the next drop.</div>
        </div>
      )}

      {!hasPerks && (
        <div className={pageStyles.infoBox} style={{ marginTop: 20 }}>
          <div className={pageStyles.infoTitle}>get unatpepe to unlock perks</div>
          <div className={pageStyles.infoText}>
            Your address is registered. Once you acquire UNATPEPE, your discount and early access
            activate automatically at the next drop check.<br /><br />
            Get UNATPEPE at: <a href="https://tap3.link" target="_blank" rel="noopener noreferrer">tap3.link</a>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        <Link href="/submit" style={{
          fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: 3,
          color: 'var(--bg)', background: 'var(--amber)',
          border: 'none', padding: '12px 24px', textDecoration: 'none',
        }}>
          open pepe wizard →
        </Link>
        <Link href="/" style={{
          fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: 3,
          color: 'var(--text-dim)', border: '1px solid var(--border)',
          padding: '12px 20px', textDecoration: 'none',
        }}>
          ← mempool
        </Link>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Main page
// ──────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [step, setStep]         = useState(0);
  const [formData, setFormData] = useState({});

  function handleNext(data) {
    setFormData(prev => ({ ...prev, ...data }));
    setStep(s => s + 1);
  }

  const STEPS = [
    { label: 'Address' },
    { label: 'Sign'    },
    { label: 'Done'    },
  ];

  return (
    <>
      <Nav />
      <main className={styles.page} style={{ paddingTop: 80 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 4 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 6, color: 'var(--amber)' }}>
            HOLDER REGISTRATION
          </div>
        </div>

        {/* Progress bar */}
        <nav className={styles.progress} aria-label="registration steps">
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div className={styles.step}>
                <div className={`${styles.stepNum} ${step === i ? styles.active : step > i ? styles.done : ''}`}>
                  {step > i ? '✓' : i}
                </div>
                <div className={`${styles.stepLabel} ${step === i ? styles.active : step > i ? styles.done : ''}`}>
                  {s.label}
                </div>
              </div>
              {i < STEPS.length - 1 && <div className={styles.stepConnector} />}
            </div>
          ))}
        </nav>

        {step === 0 && <Step0 onNext={handleNext} />}
        {step === 1 && <Step1 data={formData} onNext={handleNext} />}
        {step === 2 && <Step2 data={formData} />}

      </main>
    </>
  );
}
