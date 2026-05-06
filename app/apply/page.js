'use client';

import { useState } from 'react';
import styles from './apply.module.css';

const PITCH_ITEMS = [
  {
    title: 'THE CO-SIGN.',
    body: 'Your art is evaluated by a council of 6 judges — NAKAMOJO, RARELOONEY, DANKSHAWN, M.CATALOGUS, PROF.TG00DMAN, and DJ PEPAI. They score on inevitability, memetic density, craft, cultural continuity, and archival value. Pass the council, get certified.',
  },
  {
    title: 'THE RECORD.',
    body: 'Certified cards live on Counterparty — the same chain as the original 1,774 Rare Pepes. P2P archived via Hyperswarm. Not a website. A permanent entry in an on-chain curated directory that does not go away.',
  },
  {
    title: 'THE WINDOW.',
    body: "We are accepting the first 15 artists. Series 1 has no roadmap, no mint date, no price. The first certified cards shape the character of everything that follows. Be early to something that does not announce itself.",
  },
];

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
  const [handle, setHandle] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

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
    <main className={styles.wrap}>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <pre className={styles.pepeAscii} aria-hidden="true">{ASCII_PEPE}</pre>
        <h1 className={styles.headline}>UNATRARE</h1>
        <p className={styles.sub}>
          The first curated Rare Pepe directory<br />
          <span className={styles.subDim}>since the original.</span>
        </p>
        <div className={styles.chainBadge}>
          Bitcoin · Counterparty · AI Council · P2P Archive
        </div>
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
              Certifying the first{' '}
              <span className={styles.accent}>15 artists.</span>
            </h2>
            <p className={styles.formSub}>
              Drop your handle. Follow @unatpepe. We&apos;ll reach out.
            </p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {/* Platform toggle */}
              <div className={styles.platformRow}>
                <label
                  className={`${styles.platformLabel} ${platform === 'x' ? styles.platformActive : ''}`}
                >
                  <input
                    type="radio"
                    name="platform"
                    value="x"
                    checked={platform === 'x'}
                    onChange={() => setPlatform('x')}
                    className={styles.radioHidden}
                  />
                  𝕏 &nbsp;Twitter / X
                </label>
                <label
                  className={`${styles.platformLabel} ${platform === 'telegram' ? styles.platformActive : ''}`}
                >
                  <input
                    type="radio"
                    name="platform"
                    value="telegram"
                    checked={platform === 'telegram'}
                    onChange={() => setPlatform('telegram')}
                    className={styles.radioHidden}
                  />
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

              {(state === 'error') && (
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
              <a
                href="https://x.com/unatpepe"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.followLink}
              >
                Follow @unatpepe on 𝕏
              </a>
              <span className={styles.followDivider}>·</span>
              <a
                href="https://t.me/unatpepe"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.followLink}
              >
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
  );
}
