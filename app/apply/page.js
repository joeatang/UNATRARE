'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';
import styles from './apply.module.css';

// ── Artist journey — visual only, glyphs + one word ──────
const FLOW_NODES = [
  { glyph: '✦', label: 'ART',       step: 0 },
  { glyph: '⬢', label: 'JUDGED',    step: 2 },
  { glyph: '◆', label: 'CERTIFIED', step: 4 },
  { glyph: '⬟', label: 'BITCOIN',   step: 6 },
];
// Lines between nodes activate at steps 1, 3, 5
const STEP_DELAYS = [800, 480, 480, 480, 480, 480, 480, 2200];

const ASCII_PEPE = `
  ░░░░░░░░░░░░░░░░░░░░░░░
  ░░░░▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░
  ░░▓▓░░░░░░░░░░░░▓▓░░░░░
  ░░▓▓  ▓▓    ▓▓  ▓▓░░░░░
  ░░▓▓  ██    ██  ▓▓░░░░░
  ░░▓▓░░░░░░░░░░░░▓▓░░░░░
  ░░▓▓▓▓▒▒▒▒▒▒▒▒▓▓▓▓░░░░░
  ░░░░▓▓▒▒▒▒▒▒▒▒▓▓░░░░░░░
  ░░░░░░▓▓▓▓▓▓▓▓░░░░░░░░░
  ░░░░░░░░░░░░░░░░░░░░░░░`.trim();

export default function ApplyPage() {
  const [platform, setPlatform] = useState('x');
  const [handle,   setHandle]   = useState('');
  const [state,    setState]    = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [flowStep, setFlowStep] = useState(0);

  useEffect(() => {
    const delay = STEP_DELAYS[flowStep] ?? 480;
    const timer = setTimeout(() => {
      setFlowStep(s => (s >= 7 ? 0 : s + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [flowStep]);

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

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <pre className={styles.pepeAscii} aria-hidden="true">{ASCII_PEPE}</pre>
          <h1 className={styles.headline}>UNATRARE</h1>
          <p className={styles.sub}>Make something rare.<br />
            <span className={styles.subDim}>The Council decides if it stays.</span>
          </p>
        </section>

        {/* ── Visual flow animation ── */}
        <div className={styles.flowWrap}>
          {FLOW_NODES.map((node, i) => {
            const nodeOn = flowStep >= node.step;
            const lineOn = i < FLOW_NODES.length - 1 && flowStep >= node.step + 1;
            return (
              <div key={i} className={styles.flowSegment}>
                <div className={`${styles.flowNode} ${nodeOn ? styles.flowNodeOn : ''}`}>
                  <span className={styles.flowGlyph}>{node.glyph}</span>
                  <span className={styles.flowLabel}>{node.label}</span>
                </div>
                {i < FLOW_NODES.length - 1 && (
                  <div className={`${styles.flowLine} ${lineOn ? styles.flowLineOn : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Three truths ── */}
        <section className={styles.truths}>

          <div className={styles.truth}>
            <span className={styles.truthGlyph}>◉</span>
            <div>
              <strong className={styles.truthTitle}>The co-sign matters.</strong>
              <p className={styles.truthBody}>
                Eight judges who built and collected Rare Pepe score your work.
                Pass, and your name is in the directory — same chain as the original 1,774.
              </p>
            </div>
          </div>

          <div className={styles.truth}>
            <span className={styles.truthGlyph}>⬡</span>
            <div>
              <strong className={styles.truthTitle}>It doesn&apos;t go away.</strong>
              <p className={styles.truthBody}>
                Certified cards are Counterparty tokens on Bitcoin.
                Not a platform. Not a profile. A permanent on-chain record.
              </p>
            </div>
          </div>

          <div className={styles.truth}>
            <span className={styles.truthGlyph}>◈</span>
            <div>
              <strong className={styles.truthTitle}>You get paid.</strong>
              <p className={styles.truthBody}>
                Your certified card gets distributed to UNATPEPE holders in a drop.
                You receive your full ask in NAT. Artists keep 100%.
              </p>
            </div>
          </div>

        </section>

        {/* ── Form ── */}
        <section className={styles.formSection}>
          {state === 'success' ? (
            <div className={styles.successBox}>
              <span className={styles.successSigil}>◉</span>
              <h2 className={styles.successTitle}>You&apos;re in the queue.</h2>
              <p className={styles.successBody}>
                Follow{' '}
                <a href="https://x.com/unatpepe" target="_blank" rel="noopener noreferrer">@unatpepe on X</a>
                {' '}and{' '}
                <a href="https://t.me/unatpepe" target="_blank" rel="noopener noreferrer">@unatpepe on Telegram</a>.
                <br />We&apos;ll reach out directly.
              </p>
            </div>
          ) : (
            <>
              <h2 className={styles.formHeadline}>
                Drop your <span className={styles.accent}>handle.</span>
              </h2>

              <form className={styles.form} onSubmit={handleSubmit} noValidate>
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

                <button type="submit" className={styles.submitBtn} disabled={state === 'loading'}>
                  {state === 'loading' ? 'SUBMITTING...' : 'SUBMIT →'}
                </button>
              </form>

              <div className={styles.followRow}>
                <a href="https://x.com/unatpepe" target="_blank" rel="noopener noreferrer" className={styles.followLink}>
                  @unatpepe on 𝕏
                </a>
                <span className={styles.followDivider}>·</span>
                <a href="https://t.me/unatpepe" target="_blank" rel="noopener noreferrer" className={styles.followLink}>
                  @unatpepe on Telegram
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
