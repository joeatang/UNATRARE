'use client';

import { useState } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './status.module.css';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

const STATUS_META = {
  pending:  { label: 'COUNCIL DELIBERATING', color: 'var(--amber)',  icon: '⬡' },
  approved: { label: 'CERTIFIED',            color: 'var(--green)',  icon: '✓' },
  rejected: { label: 'REJECTED',             color: 'var(--red)',    icon: '✗' },
};

function timeAgo(unixSec) {
  if (!unixSec) return '—';
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ScoreBar({ score, max = 37.5 }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = pct >= 80 ? 'var(--green)' : pct >= 55 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className={styles.scoreBar}>
      <div className={styles.scoreBarFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function JudgeBreakdown({ breakdown }) {
  if (!breakdown || !Array.isArray(breakdown)) return null;
  return (
    <div className={styles.breakdown}>
      <div className={styles.breakdownTitle}>PEPE COUNCIL VERDICTS</div>
      {breakdown.map((j, i) => {
        const meta = j.verdict === 'CERTIFIED'
          ? { color: 'var(--green)', icon: '✓' }
          : { color: 'var(--red)', icon: '✗' };
        return (
          <div key={i} className={styles.judgeRow}>
            <div className={styles.judgeLeft}>
              <span className={styles.judgeVerdict} style={{ color: meta.color }}>
                {meta.icon}
              </span>
              <span className={styles.judgeName}>{j.judge_id?.toUpperCase().replace(/_/g, ' ') || `JUDGE ${i + 1}`}</span>
            </div>
            <div className={styles.judgeScore}>
              {j.score != null ? <>{j.score.toFixed(1)} <span className={styles.scoreMax}>/ 10</span></> : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubmissionCard({ sub }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[sub.status] || STATUS_META.pending;

  return (
    <div className={`${styles.card} ${styles['card_' + sub.status]}`}>
      {/* Top bar */}
      <div className={styles.cardTop}>
        <div className={styles.cardLeft}>
          {sub.artUrl && (
            <div className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sub.artUrl} alt={sub.tokenName} className={styles.thumbImg} />
            </div>
          )}
          <div>
            <div className={styles.tokenName}>{sub.tokenName}</div>
            <div className={styles.submitted}>submitted {timeAgo(sub.submittedAt)}</div>
          </div>
        </div>
        <div className={styles.cardRight}>
          <div className={styles.statusBadge} style={{ color: meta.color, borderColor: meta.color }}>
            {meta.icon} {meta.label}
          </div>
          {sub.judgeScore != null && (
            <div className={styles.scoreSummary}>
              <span className={styles.scoreNum}>{sub.judgeScore.toFixed(1)}</span>
              <span className={styles.scoreMax}> / 37.5</span>
            </div>
          )}
        </div>
      </div>

      {/* Score bar */}
      {sub.judgeScore != null && <ScoreBar score={sub.judgeScore} />}

      {/* Approved: payment CTA */}
      {sub.status === 'approved' && sub.payUrl && (
        <div className={styles.payStrip}>
          <div className={styles.payLabel}>
            Your art was certified. Complete your listing to go live in the directory.
          </div>
          <Link href={sub.payUrl} className={styles.payBtn}>
            complete listing →
          </Link>
        </div>
      )}

      {/* Rejected: reason */}
      {sub.status === 'rejected' && sub.rejectionReason && (
        <div className={styles.rejectionBox}>
          <div className={styles.rejectionLabel}>council feedback</div>
          <div className={styles.rejectionText}>{sub.rejectionReason}</div>
        </div>
      )}

      {/* Pending: status message */}
      {sub.status === 'pending' && (
        <div className={styles.pendingNote}>
          The Pepe Council is deliberating. You will be able to check back here for your verdict.
        </div>
      )}

      {/* Expand toggle for judge breakdown */}
      {sub.judgeBreakdown && (
        <button className={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ hide council breakdown' : '▼ view council breakdown'}
        </button>
      )}
      {expanded && <JudgeBreakdown breakdown={sub.judgeBreakdown} />}
    </div>
  );
}

export default function StatusPage() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [errMsg, setErrMsg]   = useState('');

  const addrValid = ADDR_RE.test(address.trim());

  async function handleLookup() {
    const addr = address.trim();
    if (!addrValid) { setErrMsg('Enter a valid Bitcoin address (P2PKH, starts with 1)'); return; }
    setLoading(true);
    setErrMsg('');
    setData(null);
    try {
      const res  = await fetch(`/api/artist-status/${encodeURIComponent(addr)}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setErrMsg(json.error || 'Lookup failed');
      }
    } catch {
      setErrMsg('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && addrValid) handleLookup();
  }

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.inner}>

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.eyebrow}>· artist portal ·</div>
            <h1 className={styles.title}>SUBMISS<span>I</span>ON STATUS</h1>
            <div className={styles.subtitle}>
              Enter your Bitcoin address to see the status of your submissions<br />
              and your Pepe Council verdicts.
            </div>
          </div>

          {/* Lookup input */}
          <div className={styles.lookupBox}>
            <div className={styles.lookupLabel}>your bitcoin address</div>
            <div className={styles.lookupRow}>
              <input
                className={styles.lookupInput}
                type="text"
                value={address}
                onChange={e => { setAddress(e.target.value.trim()); setErrMsg(''); setData(null); }}
                onKeyDown={handleKey}
                placeholder="1YourBitcoinAddressHere..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className={styles.lookupBtn}
                onClick={handleLookup}
                disabled={loading || !addrValid}
              >
                {loading ? 'loading...' : 'check status →'}
              </button>
            </div>
            {errMsg && <div className={styles.lookupError}>{errMsg}</div>}
            <div className={styles.lookupHint}>
              This is the Bitcoin address you used as the token owner when submitting.
            </div>
          </div>

          {/* Results */}
          {data && (
            <div className={styles.results}>
              {data.submissions.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>⬡</div>
                  <div className={styles.emptyTitle}>No submissions found</div>
                  <div className={styles.emptyDesc}>
                    This address has not submitted any tokens to UNATRARE.
                  </div>
                  <Link href="/submit" className={styles.emptyBtn}>
                    open pepe wizard →
                  </Link>
                </div>
              ) : (
                <>
                  <div className={styles.resultsHeader}>
                    <span className={styles.resultsCount}>{data.submissions.length} submission{data.submissions.length !== 1 ? 's' : ''}</span>
                    <span className={styles.resultsAddr}>{data.address.slice(0, 12)}…{data.address.slice(-6)}</span>
                  </div>
                  <div className={styles.cardList}>
                    {data.submissions.map(sub => (
                      <SubmissionCard key={sub.tokenName} sub={sub} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
