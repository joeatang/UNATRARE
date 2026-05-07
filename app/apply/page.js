'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './apply.module.css';

// ── Flow path definitions ───────────────────────────────
// step = animation step at which the item activates (0–6)
const HOLDER_PATH = [
  { type: 'node', label: 'HOLD UNATPEPE', glyph: '◈', step: 0 },
  { type: 'line', step: 1 },
  { type: 'node', label: 'DROP OPENS',    glyph: '◎', step: 2 },
  { type: 'line', step: 3 },
  { type: 'node', label: 'CLAIM IN NAT',  glyph: '◉', step: 4 },
  { type: 'line', step: 5 },
  { type: 'node', label: 'XCP CARD',      glyph: '⬡', step: 6 },
];

const ARTIST_PATH = [
  { type: 'node', label: 'SUBMIT ART',   glyph: '✦', step: 0 },
  { type: 'line', step: 1 },
  { type: 'node', label: 'PEPE COUNCIL', glyph: '⬢', step: 2 },
  { type: 'line', step: 3 },
  { type: 'node', label: 'CERTIFIED',    glyph: '◆', step: 4 },
  { type: 'line', step: 5 },
  { type: 'node', label: 'ON BITCOIN',   glyph: '⬟', step: 6 },
];

// Steps 0–6 light up one item; step 7 is the pause before reset
const STEP_DELAYS = [700, 520, 520, 520, 520, 520, 520, 2000];

const PITCH_ITEMS = [
  {
    title: 'THE CO-SIGN.',
    body: 'Eight judges — NAKAMOJO, RARELOONEY, DANKSHAWN, M.CATALOGUS, PROF.TG00DMAN, DJ PEPAI, J.FROG, and CHIGUIRIPEPE — score on inevitability, memetic density, craft, cultural continuity, and archival value. Pass the hard rules, enter the directory. Score above 42/69, earn the Council stamp.',
  },
  {
    title: 'THE RECORD.',
    body: 'Certified cards live on Counterparty — the same chain as the original 1,774 Rare Pepes. P2P archived via Hyperswarm. Not a website entry. A permanent token on Bitcoin that does not go away.',
  },
  {
    title: 'THE DROPS.',
    body: 'Certified Series 0 cards are distributed to UNATPEPE holders via drops — priced in DMT-NAT. Artists earn. Collectors claim. Two Bitcoin-native communities. One on-chain artifact.',
  },
];

export default function ApplyPage() {
  const [platform, setPlatform] = useState('x');
  const [handle,   setHandle]   = useState('');
  const [state,    setState]    = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [flowStep, setFlowStep] = useState(0);

  // Sequential flow animation
  useEffect(() => {
    const delay = STEP_DELAYS[flowStep] ?? 520;
    const timer = setTimeout(() => {
      setFlowStep(s => (s >= 7 ? 0 : s + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [flowStep]);

  function renderPath(path) {
    return path.map((item, i) => {
      const on = flowStep >= item.step;
      if (item.type === 'node') {
        return (
          <div key={i} className={`${styles.fNode} ${on ? styles.fNodeOn : ''}`}>
            <span className={styles.fGlyph}>{item.glyph}</span>
            <span className={styles.fLabel}>{item.label}</span>
          </div>
        );
      }
      return (
        <div key={i} className={`${styles.fLine} ${on ? styles.fLineOn : ''}`} />
      );
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = handle.trim().replace(/^@+/, '');
    if (!clean) return;
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: clean, platform }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Try again.');
        setState('error');
        return;
      }
      setState('success');
    } catch {
      setErrorMsg('Network error. Try again.');
      setState('error');
    }
  }

  return (
    <>
      <Nav />
      <main className={styles.wrap}>

        {/* ── Header ── */}
        <header className={styles.header}>
          <div className={styles.eyebrow}>ARTISTS · SERIES 0 OPEN</div>
          <h1 className={styles.title}>AP<span>P</span>LY</h1>
          <p className={styles.subtitle}>
            Certified on Counterparty by the Pepe Council.<br />
            Distributed to UNATPEPE holders. Priced in NAT.
          </p>
          <div className={styles.chainBadge}>
            PEPE COUNCIL · COUNTERPARTY · UNATPEPE · DMT-NAT
          </div>
        </header>

        {/* ── Flow Animation ── */}
        <section className={styles.flowSection}>
          <div className={styles.flowSectionTitle}>HOW IT WORKS</div>

          <div className={styles.flowDiagram}>
            <div className={styles.flowRow}>
              <div className={styles.flowRowLabel}>HOLDER</div>
              <div className={styles.flowPathWrap}>{renderPath(HOLDER_PATH)}</div>
            </div>
            <div className={styles.flowRow}>
              <div className={styles.flowRowLabel}>ARTIST</div>
              <div className={styles.flowPathWrap}>{renderPath(ARTIST_PATH)}</div>
            </div>
          </div>

          <p className={styles.flowNote}>
            UNATPEPE gives access. NAT is the currency. XCP Wallet holds the art.{' '}
            <Link href="/wallets">Get set up →</Link>
          </p>
        </section>

        {/* ── Pitch ── */}
        <section className={styles.pitch}>
          {PITCH_ITEMS.map((item, i) => (
            <div key={i} className={styles.pitchItem}>
              <span className={styles.pitchNum}>0{i + 1}</span>
              <div>
                <strong className={styles.pitchTitle}>{item.title}</strong>
                <p className={styles.pitchBody}>{item.body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Form ── */}
        <section className={styles.formSection}>
        {state === 'success' ? (
            <div className={styles.successBox}>
              <span className={styles.successSigil}>◉</span>
              <h2 className={styles.successTitle}>You&apos;re in the queue.</h2>
              <p className={styles.successBody}>
                Follow{' '}
                <a href="https://x.com/unatpepe" target="_blank" rel="noopener noreferrer">
                  @unatpepe on X
                </a>{' '}
                and{' '}
                <a href="https://t.me/unatpepe" target="_blank" rel="noopener noreferrer">
                  @unatpepe on Telegram
                </a>
                .<br />
                We will reach out directly to set something up.
              </p>
            </div>
        ) : (
          <>
            <h2 className={styles.formHeadline}>
                Submit your <span className={styles.accent}>handle.</span>
              </h2>
              <p className={styles.formSub}>
                Drop it below. We&apos;ll reach out directly with submission details.
                {/* Platform toggle */}
                <div className={styles.platformRow}>
                  <label className={`${styles.platformLabel} ${platform === 'x' ? styles.platformActive : ''}`}>
                    <input type="radio" name="platform" value="x"
                      checked={platform === 'x'} onChange={() => setPlatform('x')}
                      className={styles.radioHidden} />
                    𝕏 &nbsp;Twitter / X
                  </label>
                  <label className={`${styles.platformLabel} ${platform === 'telegram' ? styles.platformActive : ''}`}>
                    <input type="radio" name="platform" value="telegram"
                      checked={platform === 'telegram'} onChange={() => setPlatform('telegram')}
                      className={styles.radioHidden} />
                    ✈ &nbsp;Telegram
                  </label>
                </div>

                {/* Handle input */}
                <div className={styles.handleRow}>
                  <span className={styles.atSymbol}>@</span>
                  <input
                    type="text"
                    className={styles.handleInput}
                    placeholder={platform === 'x' ? 'yourXhandle' : 'yourtelegramhandle'}
                    value={handle}
                    onChange={e => setHandle(e.target.value.replace(/^@+/, ''))}
                    maxLength={50}
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>

                {state === 'error' && (
                  <p className={styles.errorMsg}>{errorMsg}</p>
                )}

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={state === 'loading'}
                >
                  {state === 'loading' ? 'SUBMITTING...' : 'SUBMIT →'}
                </button>
              </form>

              {/* Follow CTAs */}
              <div className={styles.followRow}>
                <a href="https://x.com/unatpepe" target="_blank" rel="noopener noreferrer" className={styles.followLink}>
                  Follow @unatpepe on 𝕏
                </a>
                <span className={styles.followDivider}>·</span>
                <a href="https://t.me/unatpepe" target="_blank" rel="noopener noreferrer" className={styles.followLink}>
                  Join @unatpepe on Telegram
                </a>
              </div>
            </>
          )}
        </section>

        <footer className={styles.footer}>
          <span className={styles.footerText}>unatrare.wtf · Bitcoin · Counterparty</span>
        </footer>

      </main>
    </>
  );
}
