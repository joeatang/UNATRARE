'use client';

import { useEffect, useState } from 'react';
import styles from './nodes.module.css';

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

  useEffect(() => {
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
  }, []);

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
        <h2 className={styles.joinTitle}>RUN A NODE</h2>
        <p className={styles.joinDesc}>
          Community nodes seed the UNATRARE art archive over Hyperswarm P2P.
          Genesis nodes (first 100) earn 2× UNAT rewards once the token launches.
        </p>
        <div className={styles.codeBlock}>
          <span className={styles.codeComment}># Install Pear runtime (one-time)</span>
          <span className={styles.codeLine}>npm install -g pear</span>
          <span className={styles.codeComment}># Clone and start the node</span>
          <span className={styles.codeLine}>git clone https://github.com/joeatang/unatrare-intercom node</span>
          <span className={styles.codeLine}>cd node &amp;&amp; npm install</span>
          <span className={styles.codeLine}>pear run . --peer-store-name unatrare-node \</span>
          <span className={styles.codeLine}>&nbsp;&nbsp;--subnet-channel unatrare-art-archive-v1</span>
        </div>
        <p className={styles.joinNote}>
          Requires Node.js v22+. Questions?{' '}
          <a className={styles.joinLink} href="https://discord.gg/trac" target="_blank" rel="noopener noreferrer">
            TRAC Discord
          </a>
        </p>
      </div>
    </main>
  );
}
