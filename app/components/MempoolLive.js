'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';

function timeAgo(unixSeconds) {
  if (!unixSeconds) return '';
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function MempoolLive({ initialStats, initialRecent, initialPending3 }) {
  const [stats, setStats] = useState({
    pending:  initialStats.pending,
    approved: initialStats.approved,
    rejected: initialStats.rejected,
  });
  const [recent, setRecent]   = useState(initialRecent);
  const [pending3, setPending3] = useState(initialPending3);
  const [pulse, setPulse]     = useState(null); // token_name of last approval flash
  const esRef = useRef(null);

  useEffect(() => {
    const es = new EventSource('/api/events');
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'stats') {
          setStats({ pending: msg.pending, approved: msg.approved, rejected: msg.rejected });
        }

        if (msg.type === 'submission') {
          // Add to pending3 (max 3)
          setPending3(prev => [msg.token, ...prev].slice(0, 3));
          // Prepend to activity feed
          setRecent(prev => [{ ...msg.token, status: 'pending' }, ...prev].slice(0, 20));
        }

        if (msg.type === 'approved') {
          // Flash the card name
          setPulse(msg.token.token_name);
          setTimeout(() => setPulse(null), 1500);
          // Remove from pending3
          setPending3(prev => prev.filter(t => t.token_name !== msg.token.token_name));
          // Update or prepend in activity
          setRecent(prev => {
            const filtered = prev.filter(t => t.token_name !== msg.token.token_name);
            return [{ ...msg.token, status: 'approved' }, ...filtered].slice(0, 20);
          });
        }

        if (msg.type === 'rejected') {
          setPending3(prev => prev.filter(t => t.token_name !== msg.token.token_name));
          setRecent(prev => {
            const filtered = prev.filter(t => t.token_name !== msg.token.token_name);
            return [{ ...msg.token, status: 'rejected' }, ...filtered].slice(0, 20);
          });
        }
      } catch { /* malformed event */ }
    };

    es.onerror = () => {
      // Browser auto-reconnects on error — no manual retry needed
    };

    return () => es.close();
  }, []);

  return (
    <>
      {/* ── Live stats ── */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.amber}`}>{stats.pending}</span>
          <span className={styles.statLabel}>awaiting judgment</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.green}`}>{stats.approved}</span>
          <span className={styles.statLabel}>certified dank</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.red}`}>{stats.rejected}</span>
          <span className={styles.statLabel}>rejected</span>
        </div>
      </div>

      {/* ── Pending cards in mempool ── */}
      <section className={styles.mempoolSection}>
        <div className={styles.sectionLabel}>· under review ·</div>
        <div className={styles.pendingRow}>
          {/* Always show 3 mystery card slots — filled if pending, ghost if empty */}
          {[0, 1, 2].map((i) => {
            const t = pending3[i];
            return (
              <div key={t ? t.token_name : `ghost-${i}`} className={styles.pendingCard}
                style={{ opacity: t ? 1 : 0.28 }}>
                {/* Art area — blurred hatch pattern */}
                <div className={styles.pendingArt} style={{
                  display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:4,
                }}>
                  {/* Mystery pack icon */}
                  <div style={{
                    width:52, height:52, border:'1px solid rgba(139,115,85,0.4)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(0,0,0,0.4)',
                  }}>
                    <span style={{
                      fontFamily:'var(--font-display)', fontSize:26,
                      color:'rgba(139,115,85,0.5)', lineHeight:1,
                    }}>?</span>
                  </div>
                  <div style={{
                    fontFamily:'var(--font-card)', fontSize:'11px',
                    letterSpacing:'2px', color:'rgba(139,115,85,0.4)',
                    textAlign:'center', textTransform:'uppercase',
                  }}>
                    {t ? 'COUNCIL\nJUDGING' : 'AWAITING\nSUBMISSION'}
                  </div>
                </div>
                {/* Card footer */}
                <div className={styles.pendingLabel} style={{ opacity: t ? 1 : 0.5, fontSize: t ? '9px' : undefined }}>
                  {t ? t.token_name : '· · ·'}
                </div>
              </div>
            );
          })}
          {pending3.length === 0 && (
            <div style={{
              display:'flex', alignItems:'center',
              fontFamily:'var(--font-card)', fontSize:'10px',
              letterSpacing:'3px', color:'var(--text-dim)',
              paddingLeft:8, paddingBottom:24,
            }}>
              be the first →
            </div>
          )}
        </div>
      </section>

      {/* ── Activity feed ── */}
      <section className={styles.activitySection}>
        <div className={styles.sectionLabel}>· activity ·</div>
        <div className={styles.activityList}>
          {recent.length === 0 ? (
            <div className={styles.activityItem}>
              <span className={styles.activityTime}>—</span>
              <span>no activity yet</span>
            </div>
          ) : (
            recent.map(t => (
              <div key={t.token_name + (t.judged_at ?? t.submitted_at)} className={styles.activityItem}>
                <div className={`${styles.activityDot} ${styles[t.status]}`}></div>
                <span className={styles.activityToken}>{t.token_name}</span>
                <span className={`${styles.activityAction} ${styles[t.status]}`}>
                  {t.status === 'approved' ? 'certified dank' :
                   t.status === 'rejected' ? 'rejected' : 'submission received'}
                </span>
                <span className={styles.activityTime}>
                  {timeAgo(t.judged_at ?? t.submitted_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
