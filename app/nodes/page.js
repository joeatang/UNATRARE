'use client';

import { useEffect, useState, useRef } from 'react';
import styles from './nodes.module.css';

const SPLASH_LINES = [
  '                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░',
  '                    ░                                                              ░',
  '                    ░   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ░',
  '                    ░   ░                                                      ░   ░',
  '                    ░   ░        ░░░░░  ░░░░░  ░░░░░  ░░░░░  ░░░░░            ░   ░',
  '                    ░   ░        ░   ░  ░      ░      ░        ░              ░   ░',
  '                    ░   ░        ░░░░░  ░░░░   ░░░░   ░░░░░    ░              ░   ░',
  '                    ░   ░        ░      ░      ░      ░        ░              ░   ░',
  '                    ░   ░        ░      ░░░░░  ░░░░░  ░░░░░    ░              ░   ░',
  '                    ░   ░                                                      ░   ░',
  '                    ░   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ░',
  '                    ░                                                              ░',
  '                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░',
  '',
  '          ██████╗ ███████╗███████╗██████╗     ███╗   ██╗ ██████╗ ██████╗ ███████╗',
  '          ██╔══██╗██╔════╝██╔════╝██╔══██╗    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝',
  '          ██║  ██║█████╗  █████╗  ██████╔╝    ██╔██╗ ██║██║   ██║██║  ██║█████╗  ',
  '          ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝     ██║╚██╗██║██║   ██║██║  ██║██╔══╝  ',
  '          ██████╔╝███████╗███████╗██║          ██║ ╚████║╚██████╔╝██████╔╝███████╗',
  '          ╚═════╝ ╚══════╝╚══════╝╚═╝          ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝╚══════╝',
  '',
  '             > UNATRARE NETWORK — HYPERSWARM P2P ART ARCHIVE NODES',
  '             > TRAC SUBNET: unatrare-art-archive-v1',
  '             > GENESIS NODE WINDOW: OPEN',
  '             > IT IS RARE. IT IS UNAT. IT IS ON BITCOIN. FEELS GOOD MAN.',
  '',
  '             [ LOADING NODE REGISTRY... ]',
];

function AsciiSplash({ onDone }) {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= SPLASH_LINES.length) {
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
    const delay = visibleLines < 13 ? 18 : visibleLines < 20 ? 35 : 60;
    const t = setTimeout(() => setVisibleLines(v => v + 1), delay);
    return () => clearTimeout(t);
  }, [visibleLines, onDone]);

  return (
    <div className={styles.splash}>
      <pre className={styles.splashPre}>
        {SPLASH_LINES.slice(0, visibleLines).join('\n')}
        {visibleLines < SPLASH_LINES.length && <span className={styles.cursor}>▌</span>}
      </pre>
    </div>
  );
}

function timeAgo(ms) {
  if (!ms) return 'never';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}

function truncPubkey(pk) {
  if (!pk || pk.length < 16) return pk ?? '—';
  return pk.slice(0, 8) + '…' + pk.slice(-8);
}

export default function NodesPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!splashDone) return;
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/nodes');
        const json = await res.json();
        if (mounted) { setData(json); setLoading(false); }
      } catch (e) {
        if (mounted) { setError('Could not reach node registry.'); setLoading(false); }
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [splashDone]);

  if (!splashDone) {
    return <AsciiSplash onDone={() => setSplashDone(true)} />;
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>UNATRARE NETWORK NODES</h1>
        <p className={styles.subtitle}>
          Live view of registered nodes seeding the archive on the TRAC P2P subnet.
        </p>
      </div>

      {loading && (
        <div className={styles.status}>
          <span className={styles.blink}>▮</span> Connecting to subnet…
        </div>
      )}

      {error && (
        <div className={styles.statusError}>{error}</div>
      )}

      {!loading && !error && data && (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryVal}>{data.count}</span>
              <span className={styles.summaryLabel}>NODES</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryVal}>
                {data.nodes.filter(n => n.is_genesis).length}
              </span>
              <span className={styles.summaryLabel}>GENESIS</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryVal}>
                {data.nodes.reduce((s, n) => s + (n.total_heartbeats || 0), 0)}
              </span>
              <span className={styles.summaryLabel}>HEARTBEATS</span>
            </div>
          </div>

          {data.nodes.length === 0 ? (
            <div className={styles.empty}>
              No nodes registered yet. Be the first —{' '}
              <a className={styles.emptyLink} href="/nodes#join">join the network</a>.
            </div>
          ) : (
            <div className={styles.grid}>
              {data.nodes.map((node) => (
                <div key={node.pubkey} className={styles.card}>
                  {node.is_genesis && (
                    <span className={styles.genesisBadge}>GENESIS</span>
                  )}
                  <div className={styles.pubkey} title={node.pubkey}>
                    {truncPubkey(node.pubkey)}
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>JOINED</span>
                    <span className={styles.val}>{formatDate(node.registered_at)}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>HEARTBEATS</span>
                    <span className={styles.val}>{node.total_heartbeats ?? 0}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>LAST SEEN</span>
                    <span className={styles.val}>{timeAgo(node.last_heartbeat)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.updatedAt}>
            Updated {timeAgo(data.updatedAt)} · auto-refreshes every 30s
          </div>
        </>
      )}

      {/* ── Join section ─────────────────────────────────────────── */}
      <div className={styles.joinSection} id="join">
        <h2 className={styles.joinTitle}>RUN A DEEP NODE</h2>
        <p className={styles.joinDesc}>
          Deep Nodes seed the UNATRARE art archive over the TRAC Hyperswarm P2P network.
          The first 100 nodes earn permanent <strong>GENESIS</strong> status — an on-chain record
          of founding participation, with 2× reward weight when the NAT reward system launches.
        </p>

        <div className={styles.reqGrid}>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>OPERATING SYSTEM</span>
            <span className={styles.reqVal}>Ubuntu 20.04+ &nbsp;✓&nbsp; &nbsp;macOS 12+ &nbsp;✓&nbsp; &nbsp;Windows &nbsp;✗</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>RAM</span>
            <span className={styles.reqVal}>1 GB minimum &nbsp;·&nbsp; 2 GB recommended</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>STORAGE</span>
            <span className={styles.reqVal}>10 GB free minimum &nbsp;·&nbsp; 50 GB recommended</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>INTERNET</span>
            <span className={styles.reqVal}>Always-on broadband &nbsp;·&nbsp; laptop sleep = missed heartbeats</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>COST (cloud)</span>
            <span className={styles.reqVal}>$6–12/mo VPS &nbsp;·&nbsp; home device = ~$1–3/mo electricity</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>macOS MINIMUM</span>
            <span className={styles.reqVal}>macOS 12 Monterey &nbsp;·&nbsp; Catalina / Big Sur will NOT work</span>
          </div>
        </div>

        <a className={styles.guideBtn} href="/nodes/guide">
          FULL SETUP GUIDE →
        </a>

        <div className={styles.codeBlock} style={{marginTop: '1.5rem'}}>
          <span className={styles.codeComment}># Quick start (Linux / macOS)</span>
          <span className={styles.codeLine}>npm install -g pear</span>
          <span className={styles.codeLine}>git clone https://github.com/joeatang/unatrare-intercom node &amp;&amp; cd node &amp;&amp; npm install</span>
          <span className={styles.codeLine}>pear run . --peer-store-name unatrare-node \</span>
          <span className={styles.codeLine}>&nbsp;&nbsp;--subnet-bootstrap 38a1b001756148f3f96f8cff7bd38d2924669f5c1880b4f779512d6449cfff56 \</span>
          <span className={styles.codeLine}>&nbsp;&nbsp;--btc-address YOUR_BITCOIN_ADDRESS</span>
        </div>
        <p className={styles.joinNote}>
          Requires Node.js v22+. &nbsp;
          <a className={styles.joinLink} href="/nodes/guide">Full guide with Linux VPS + Raspberry Pi instructions →</a>
        </p>
      </div>
    </main>
  );
}
