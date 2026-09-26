'use client';

import { useEffect, useState } from 'react';
import styles from './download.module.css';

// Fallbacks if latest.json can't be read. The live URLs come from latest.json
// so the moment a new build repoints it (e.g. arm64 -> universal), these
// buttons follow with NO redeploy.
const FALLBACK_MAC = '/downloads/unatrare-mac-arm64.zip';
const FALLBACK_WIN = '/downloads/unatrare-win-x64.zip';

// Chip label derived from the actual file the URL points at — always accurate,
// whether we're serving an arm64-only or a universal (Intel + Apple Silicon) build.
function macChip(url) {
  if (/universal/i.test(url)) return 'Intel + Apple Silicon';
  if (/arm64|silicon/i.test(url)) return 'Apple Silicon';
  return 'macOS';
}

function detectOS() {
  if (typeof navigator === 'undefined') return null;
  const s = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (s.includes('win')) return 'win';
  if (s.includes('mac')) return 'mac'; // note: can't distinguish Intel vs Apple Silicon
  if (s.includes('linux') && !s.includes('android')) return 'linux';
  return null;
}

// Download buttons with visible feedback + a fallback path, OS auto-detection
// (feature the visitor's platform), min-OS labels, and live URLs from latest.json.
export default function DownloadCTAs() {
  const [started, setStarted] = useState(null); // 'mac' | 'win' | null
  const [urls, setUrls] = useState({ mac: FALLBACK_MAC, win: FALLBACK_WIN });
  const [os, setOS] = useState(null);

  useEffect(() => {
    setOS(detectOS());
    let alive = true;
    fetch('/downloads/latest.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setUrls({ mac: j.mac || FALLBACK_MAC, win: j.win || FALLBACK_WIN });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Feature the detected platform; dim the other so nobody grabs the wrong file.
  const macPrimary = os !== 'win';
  const dim = { opacity: 0.62 };

  const macBtn = (
    <a
      className={macPrimary ? styles.cta : styles.cta2}
      style={os === 'win' ? dim : undefined}
      href={urls.mac}
      download
      onClick={() => setStarted('mac')}
    >
      Download for macOS <span className={styles.chip}>{macChip(urls.mac)}</span>
      <span style={{ display: 'block', fontSize: '0.72em', opacity: 0.75, marginTop: 3, fontWeight: 400 }}>
        Requires macOS 12 (Monterey) or newer{os === 'mac' ? ' · detected on your device' : ''}
      </span>
    </a>
  );

  const winBtn = (
    <a
      className={macPrimary ? styles.cta2 : styles.cta}
      style={macPrimary && os === 'mac' ? dim : undefined}
      href={urls.win}
      download
      onClick={() => setStarted('win')}
    >
      Download for Windows <span className={styles.chip}>x64 &middot; beta</span>
      <span style={{ display: 'block', fontSize: '0.72em', opacity: 0.75, marginTop: 3, fontWeight: 400 }}>
        Requires Windows 10 or newer{os === 'win' ? ' · detected on your device' : ''}
      </span>
    </a>
  );

  return (
    <>
      <div className={styles.ctaRow}>
        {macPrimary ? (<>{macBtn}{winBtn}</>) : (<>{winBtn}{macBtn}</>)}
      </div>

      <div className={styles.subcta}>Free &middot; self&#8209;custodial &middot; no account</div>

      {os === 'linux' && (
        <div className={styles.subcta} style={{ marginTop: 6 }}>
          On Linux? A native build is coming next — for now the macOS/Windows apps cover most setups.
        </div>
      )}

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
            <a href={started === 'win' ? urls.win : urls.mac}>Click here to download directly &rarr;</a>
          </div>
        </div>
      )}
    </>
  );
}
