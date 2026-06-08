'use client';

import { useState } from 'react';
import styles from './BuyCash.module.css';

const CASH_MINT     = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const NATFUN_URL    = 'https://nat.fun/?refId=c69c9108f52b';
const TICKER        = '$CASH';
const TOKEN_NAME    = 'NATCASH';

export default function BuyCash({ variant = 'compact', headline, subline }) {
  const [copied, setCopied] = useState(false);

  async function copyMint() {
    try {
      await navigator.clipboard.writeText(CASH_MINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = CASH_MINT;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
      document.body.removeChild(ta);
    }
  }

  if (variant === 'inline') {
    return (
      <span className={styles.inline}>
        <a
          href={NATFUN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.inlineBtn}
        >
          BUY {TICKER} ON NAT.FUN ↗
        </a>
        <button type="button" onClick={copyMint} className={styles.inlineCopy} title="Copy mint address">
          {copied ? '✓ copied' : 'copy mint'}
        </button>
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={styles.compact}>
        <div className={styles.compactHead}>
          <span className={styles.flame}>🔥</span>
          <span className={styles.compactTitle}>
            {headline || `Need ${TICKER} to participate?`}
          </span>
        </div>
        {subline && <div className={styles.compactSub}>{subline}</div>}
        <div className={styles.row}>
          <a
            href={NATFUN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnPrimary}
          >
            BUY {TICKER} ON NAT.FUN →
          </a>
          <button type="button" onClick={copyMint} className={styles.btnSecondary}>
            {copied ? '✓ MINT COPIED' : 'COPY MINT ADDRESS'}
          </button>
        </div>
        <div className={styles.meta}>
          <span>ticker · <code className={styles.code}>{TICKER}</code></span>
          <span className={styles.dot}>·</span>
          <span>name · <code className={styles.code}>{TOKEN_NAME}</code></span>
          <span className={styles.dot}>·</span>
          <span className={styles.mintLine}>
            mint · <code className={styles.codeMint} onClick={copyMint} title="Click to copy">{CASH_MINT}</code>
          </span>
        </div>
      </div>
    );
  }

  // variant === 'full'
  return (
    <div className={styles.full}>
      <div className={styles.fullEyebrow}>· solana · spl token-2022 ·</div>
      <h3 className={styles.fullTitle}>
        {headline || `GET ${TICKER} ON NAT.FUN`}
      </h3>
      <p className={styles.fullSub}>
        {subline || (
          <>
            {TICKER} is the engagement token of UNATRARE. Salutes &amp; ceremonies
            burn {TICKER} on Solana — every burn is permanent and forever credited
            to the wallet that lit it.
          </>
        )}
      </p>

      <div className={styles.row}>
        <a
          href={NATFUN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btnPrimary}
        >
          BUY {TICKER} ON NAT.FUN →
        </a>
        <button type="button" onClick={copyMint} className={styles.btnSecondary}>
          {copied ? '✓ MINT COPIED' : 'COPY MINT ADDRESS'}
        </button>
      </div>

      <dl className={styles.specs}>
        <div className={styles.specRow}>
          <dt>ticker</dt>
          <dd><code className={styles.code}>{TICKER}</code></dd>
        </div>
        <div className={styles.specRow}>
          <dt>token name</dt>
          <dd><code className={styles.code}>{TOKEN_NAME}</code></dd>
        </div>
        <div className={styles.specRow}>
          <dt>mint address</dt>
          <dd>
            <code className={styles.codeMint} onClick={copyMint} title="Click to copy">{CASH_MINT}</code>
          </dd>
        </div>
        <div className={styles.specRow}>
          <dt>marketplace</dt>
          <dd>
            <a href={NATFUN_URL} target="_blank" rel="noopener noreferrer" className={styles.specLink}>
              nat.fun ↗
            </a>
            <span className={styles.specHint}>by The Block Runners</span>
          </dd>
        </div>
      </dl>

      <div className={styles.fullNote}>
        Search the marketplace by ticker <strong>{TICKER}</strong> or name <strong>{TOKEN_NAME}</strong>.
        Always verify the mint address above matches the token you&apos;re about to buy.
      </div>
    </div>
  );
}
