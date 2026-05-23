'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';

// ── Constants ──────────────────────────────────────────────────────────────
const ADDR_RE      = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'Unatrare_registrar_bot';

// ── Inline styles (site design system) ────────────────────────────────────
const S = {
  page:       { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '88px 24px 100px', maxWidth: 620, margin: '0 auto' },
  eyebrow:    { fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '4px', color: 'var(--text-dim)', marginBottom: 8 },
  title:      { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 7vw, 44px)', letterSpacing: 6, lineHeight: 1.1, color: 'var(--text)', margin: '0 0 6px' },
  subtitle:   { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '4px', color: 'var(--amber)', marginBottom: 32 },
  divider:    { border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' },
  label:      { display: 'block', fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase' },
  input:      { width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none' },
  hint:       { fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 },
  btn:        { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', padding: '10px 22px', border: 'none', cursor: 'pointer', background: 'var(--amber)', color: 'var(--bg)' },
  btnOutline: { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', padding: '10px 20px', border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)' },
  error:      { fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--red)', marginTop: 8, lineHeight: 1.5 },
  infoBox:    { border: '1px solid var(--border)', padding: '14px 16px', background: 'var(--bg-card)', marginBottom: 20 },
  infoTitle:  { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--amber)', marginBottom: 8 },
  infoBody:   { fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.7 },
  successBox: { border: '1px solid var(--green)', padding: '16px 18px', background: 'var(--bg-card)', marginTop: 8 },
  successKey: { fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)' },
  successVal: { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text)', marginTop: 2, wordBreak: 'break-all' },
};

// ── Registration count badge ───────────────────────────────────────────────
function RegCount({ count }) {
  if (count === null) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28, padding: '5px 12px', border: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)' }}>REGISTERED</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: 2, color: 'var(--amber)' }}>{count}</span>
    </div>
  );
}

// ── Telegram widget injector ───────────────────────────────────────────────
function TelegramWidget({ onAuth }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Define global callback Telegram will call
    window.onTelegramAuth = onAuth;

    // Inject script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      container.innerHTML = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ marginBottom: 6 }} />;
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SoftpwarPage() {
  const [cpAddress,    setCpAddress]    = useState('');
  const [showWidget,   setShowWidget]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [result,       setResult]       = useState(null);  // success state
  const [err,          setErr]          = useState('');
  const [regCount,     setRegCount]     = useState(null);
  const [addrErr,      setAddrErr]      = useState('');

  const addressValid = ADDR_RE.test(cpAddress.trim());

  // Fetch registration count on mount
  useEffect(() => {
    fetch('/api/community-register/count')
      .then(r => r.ok ? r.json() : null)
      .then(j => j?.count !== undefined && setRegCount(j.count))
      .catch(() => {});
  }, []);

  function handleAddressChange(e) {
    const val = e.target.value.trim();
    setCpAddress(val);
    setAddrErr('');
    setShowWidget(false); // reset widget if address changes
    setErr('');
  }

  function handleContinue() {
    if (!addressValid) {
      setAddrErr('Enter a valid legacy Bitcoin address (starts with 1 or 3)');
      return;
    }
    setShowWidget(true);
  }

  async function handleTelegramAuth(tgUser) {
    if (!addressValid) {
      setErr('Enter a valid Counterparty address before authorizing');
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const res = await fetch('/api/community-register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cpAddress: cpAddress.trim(), tg: tgUser }),
      });
      const j = await res.json();
      if (j.ok) {
        setResult(j);
        setRegCount(j.totalRegistrations);
      } else {
        setErr(j.error || 'Registration failed — please try again');
        setShowWidget(false); // allow retry
      }
    } catch {
      setErr('Network error — please try again');
      setShowWidget(false);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────
  if (result) {
    return (
      <>
        <Nav />
        <main style={S.page}>
          <div style={S.eyebrow}>LIMITED REGISTRATION</div>
          <h1 style={S.title}>
            {result.alreadyRegistered && result.addressChanged ? <>UPDAT<span style={{ color: 'var(--amber)' }}>E</span>D</> : result.alreadyRegistered ? <>ALREA<span style={{ color: 'var(--amber)' }}>D</span>Y IN</> : <>REGIST<span style={{ color: 'var(--amber)' }}>E</span>RED</>}
          </h1>
          <div style={S.subtitle}>SOFTPWAR · RAREUNATPEPE</div>

          <div style={S.successBox}>
            <div style={{ marginBottom: 12 }}>
              <div style={S.successKey}>TELEGRAM</div>
              <div style={S.successVal}>@{result.telegramUsername}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={S.successKey}>COUNTERPARTY ADDRESS</div>
              <div style={S.successVal}>{result.cpAddress}</div>
            </div>
            <div>
              <div style={S.successKey}>STATUS</div>
              <div style={{ ...S.successVal, color: 'var(--green)', fontSize: 11, letterSpacing: 1 }}>
                ✓ {result.alreadyRegistered && result.addressChanged ? 'Address updated' : result.alreadyRegistered ? 'Already registered — no change' : 'On the list'}
              </div>
            </div>
          </div>

          <div style={{ ...S.infoBox, marginTop: 20 }}>
            <div style={S.infoTitle}>WHAT HAPPENS NEXT</div>
            <div style={S.infoBody}>
              Your address is locked in. When this registration window closes, SOFTPWAR
              and RAREUNATPEPE will be distributed to everyone on the list.
              <br /><br />
              Watch the{' '}
              <a href="https://t.me/unatrare" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--amber)' }}>UNATRARE Telegram</a>{' '}
              for the distribution announcement. You can update your address before the
              window closes by coming back and re-authorizing.
            </div>
          </div>

          {regCount !== null && (
            <div style={{ marginTop: 20 }}>
              <RegCount count={regCount} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <Link href="/" style={{ ...S.btnOutline, textDecoration: 'none', display: 'inline-block' }}>
              ← home
            </Link>
            <button
              style={S.btnOutline}
              onClick={() => { setResult(null); setShowWidget(false); setErr(''); }}
            >
              update address →
            </button>
          </div>
        </main>
      </>
    );
  }

  // ── Registration form ──────────────────────────────────────────
  return (
    <>
      <Nav />
      <main style={S.page}>

        {/* Header */}
        <div style={S.eyebrow}>LIMITED REGISTRATION</div>
        <h1 style={S.title}>
          SOFT<span style={{ color: 'var(--amber)' }}>P</span>WAR
        </h1>
        <div style={S.subtitle}>+ RAREUNATPEPE · EARLY SUPPORTER CAMPAIGN</div>

        <RegCount count={regCount} />

        {/* What are these tokens */}
        <div style={S.infoBox}>
          <div style={S.infoTitle}>WHAT IS THIS</div>
          <div style={S.infoBody}>
            <strong style={{ color: 'var(--text)' }}>SOFTPWAR</strong> is the official burn token for the
            UNATRARE directory. 2,009 supply. Issued to the community supporting the project early,
            burned with submissions, and distributed through dispensers as they open.
            <br /><br />
            <strong style={{ color: 'var(--text)' }}>RAREUNATPEPE</strong> is the official Series 1 card
            for UNATRARE — a bonus token issued alongside SOFTPWAR to supporters in this campaign.
            Genesis node operators will also be eligible to claim it.
            <br /><br />
            This window is limited. If you found this, you&rsquo;re early.
          </div>
        </div>

        <div style={{ ...S.infoBox, borderColor: 'var(--amber)', marginTop: 0 }}>
          <div style={{ ...S.infoTitle, color: 'var(--text-dim)' }}>HOW IT WORKS</div>
          <div style={S.infoBody}>
            Register your Counterparty address below. One allocation per Telegram account.
            Distribution runs after this registration window closes — tokens are sent directly
            to the address you provide.
          </div>
        </div>

        <hr style={S.divider} />

        {/* Step 1 — CP address */}
        <div style={{ marginBottom: 20 }}>
          <label style={S.label} htmlFor="cpaddr">
            Your Counterparty Address
          </label>
          <input
            id="cpaddr"
            style={{ ...S.input, borderColor: addrErr ? 'var(--red)' : 'var(--border)' }}
            type="text"
            value={cpAddress}
            onChange={handleAddressChange}
            placeholder="1YourCounterpartyAddressHere"
            autoComplete="off"
            spellCheck={false}
          />
          <div style={S.hint}>
            Legacy Bitcoin address (starts with 1 or 3) — this is where you hold XCP tokens.
            Tokens will be sent here.
          </div>
          {addrErr && <div style={S.error}>{addrErr}</div>}
        </div>

        {/* Step 2 — Telegram auth */}
        {!showWidget && (
          <button
            style={{ ...S.btn, opacity: addressValid ? 1 : 0.5 }}
            onClick={handleContinue}
          >
            continue with telegram →
          </button>
        )}

        {showWidget && !submitting && (
          <div style={{ marginTop: 16 }}>
            <div style={S.label}>AUTHORIZE WITH TELEGRAM</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
              Click the button below and confirm in Telegram. This verifies your identity —
              one registration per account.
            </div>
            <TelegramWidget onAuth={handleTelegramAuth} />
          </div>
        )}

        {submitting && (
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--text-dim)', marginTop: 16 }}>
            registering...
          </div>
        )}

        {err && <div style={S.error}>{err}</div>}

        <hr style={S.divider} />

        {/* Fine print */}
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.7 }}>
          One allocation per Telegram account. This window is open for a limited time — distribution
          runs after it closes. Announcement in the{' '}
          <a href="https://t.me/unatrare" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-dim)' }}>UNATRARE Telegram</a>.
          Your Counterparty address and Telegram ID are stored — no other data is kept.
          You can update your address before the window closes by re-registering.
        </div>

      </main>
    </>
  );
}
