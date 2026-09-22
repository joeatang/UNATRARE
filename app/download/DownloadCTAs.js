'use client';

import { useState } from 'react';
import styles from './download.module.css';

const MAC_ARM = '/downloads/unatrare-mac-arm64.zip';
const WIN_X64 = '/downloads/unatrare-win-x64.zip';

// Download buttons with visible feedback + a fallback path, so a browser that
// silently blocks the download (Windows SmartScreen, strict Chrome) never
// leaves the visitor staring at a button that "did nothing".
export default function DownloadCTAs() {
  const [started, setStarted] = useState(null); // 'mac' | 'win' | null

  return (
    <>
      <div className={styles.ctaRow}>
        <a className={styles.cta} href={MAC_ARM} download onClick={() => setStarted('mac')}>
          Download for macOS <span className={styles.chip}>Apple Silicon</span>
        </a>
        <a className={styles.cta2} href={WIN_X64} download onClick={() => setStarted('win')}>
          Download for Windows <span className={styles.chip}>x64 &middot; beta</span>
        </a>
      </div>

      <div className={styles.subcta}>Free &middot; self&#8209;custodial &middot; no account</div>

      {started && (
        <div className={styles.dlHelp} role="status">
          <div className={styles.dlHelpTitle}>
            Your {started === 'win' ? 'Windows' : 'macOS'} download should be starting&hellip;
          </div>
          {started === 'win' ? (
            <p>
              Windows may warn that the file &ldquo;isn&rsquo;t commonly downloaded&rdquo; &mdash; that&rsquo;s
              expected for a brand&#8209;new app. Open your browser&rsquo;s downloads, click the{' '}
              <b>&middot;&middot;&middot;</b> next to the file and choose <b>Keep</b>.
            </p>
          ) : (
            <p>If your browser asks, allow the download. It lands in your Downloads folder as a .zip.</p>
          )}
          <div className={styles.dlFallback}>
            Nothing happened?{' '}
            <a href={started === 'win' ? WIN_X64 : MAC_ARM}>Click here to download directly &rarr;</a>
          </div>
        </div>
      )}
    </>
  );
}
