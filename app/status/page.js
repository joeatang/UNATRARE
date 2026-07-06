'use client';

import { useState, useEffect } from 'react';
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

function formatCountdown(unixSec) {
  if (!unixSec) return null;
  const diff = unixSec - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'closed';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h remaining`;
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m remaining`;
}

function formatDate(unixSec) {
  if (!unixSec) return '—';
  return new Date(unixSec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DropSection({ drop, tokenName, artistAddress }) {
  const [open, setOpen] = useState(false);
  const [sig, setSig] = useState('');
  const [modeView, setModeView] = useState(drop.distributionMode || 'self'); // what the UI shows
  const [pendingMode, setPendingMode] = useState(null); // mode being confirmed
  const [adminAddr, setAdminAddr] = useState(''); // returned after managed confirmed
  const [dlState, setDlState]     = useState('idle');
  const [distState, setDistState] = useState('idle');
  const [modeState, setModeState] = useState('idle');
  const [err, setErr] = useState('');

  const challenge = `UNATRARE:DROP:${tokenName}`;
  const isDist = drop.dropStatus === 'distributed';
  const canAct = ['active', 'closed'].includes(drop.dropStatus);

  const statusColor = {
    upcoming:    'var(--text-dim)',
    active:      'var(--green)',
    closed:      'var(--amber)',
    distributed: 'var(--green)',
  }[drop.dropStatus] || 'var(--text-dim)';

  function resetActionState() {
    setErr(''); setDlState('idle'); setDistState('idle'); setModeState('idle');
  }

  async function handleSetMode(mode) {
    if (!sig.trim()) { setErr('Paste your signature first'); return; }
    setModeState('loading'); setErr('');
    try {
      const res = await fetch('/api/drops/set-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenName, address: artistAddress, signature: sig.trim(), mode }),
      });
      const j = await res.json();
      if (j.ok) {
        setModeView(mode);
        setPendingMode(null);
        if (j.adminXcpAddress) setAdminAddr(j.adminXcpAddress);
        setModeState('ok');
      } else {
        setErr(j.error || 'Failed to set mode'); setModeState('error');
      }
    } catch { setErr('Network error'); setModeState('error'); }
  }

  async function handleDownload() {
    if (!sig.trim()) { setErr('Paste your signature first'); return; }
    setDlState('loading'); setErr('');
    try {
      const res = await fetch('/api/drops/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenName, address: artistAddress, signature: sig.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || 'Download failed'); setDlState('error'); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `drop-${tokenName}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setDlState('ok');
    } catch { setErr('Network error'); setDlState('error'); }
  }

  async function handleMarkDistributed() {
    if (!sig.trim()) { setErr('Paste your signature first'); return; }
    setDistState('loading'); setErr('');
    try {
      const res = await fetch('/api/drops/mark-distributed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenName, address: artistAddress, signature: sig.trim() }),
      });
      const j = await res.json();
      if (j.ok) { setDistState('ok'); }
      else { setErr(j.error || 'Failed'); setDistState('error'); }
    } catch { setErr('Network error'); setDistState('error'); }
  }

  const optionBtn = (active) => ({
    flex: 1, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
    border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
    background: active ? 'rgba(184,134,44,0.08)' : 'transparent',
    color: active ? 'var(--amber)' : 'var(--text-dim)',
    fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px',
  });

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
      <button className={styles.expandBtn} onClick={() => setOpen(o => !o)}>
        {open ? '▲ hide drop details' : '▼ unatpepe holder drop'}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: statusColor }}>
              {drop.dropStatus.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)' }}>
              {drop.totalClaims} / {drop.supplyTotal} claimed
            </span>
            {drop.dropStatus === 'active' && drop.windowClosesAt && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)' }}>
                · {formatCountdown(drop.windowClosesAt)}
              </span>
            )}
            {drop.dropStatus === 'closed' && drop.windowClosesAt && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)' }}>
                · closed {formatDate(drop.windowClosesAt)}
              </span>
            )}
          </div>

          {/* Upcoming */}
          {drop.dropStatus === 'upcoming' && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Scheduled — admin will open the claim window. You&apos;ll be able to choose your distribution method once it opens.
            </div>
          )}

          {/* Active: info only */}
          {drop.dropStatus === 'active' && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Claim window is open. Holders are registering their Counterparty addresses. The full distribution list will be available when the window closes.
            </div>
          )}

          {/* Distributed */}
          {isDist && (
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' }}>
              ✓ DISTRIBUTION CONFIRMED
            </div>
          )}

          {/* Closed: distribution workflow */}
          {drop.dropStatus === 'closed' && !isDist && (
            <>
              {/* Mode picker — two option buttons */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>
                  DISTRIBUTION METHOD
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={optionBtn(modeView === 'self' && pendingMode !== 'managed')}
                    onClick={() => { setPendingMode(null); setModeView('self'); resetActionState(); }}
                  >
                    SEND MYSELF
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 4, textTransform: 'none', letterSpacing: 0, lineHeight: 1.5 }}>
                      Download the claim list and send from your own Counterparty wallet.
                    </div>
                  </button>
                  <button
                    style={optionBtn(modeView === 'managed' || pendingMode === 'managed')}
                    onClick={() => { setPendingMode('managed'); resetActionState(); }}
                  >
                    UNATRARE SENDS
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 4, textTransform: 'none', letterSpacing: 0, lineHeight: 1.5 }}>
                      Send your supply to UNATRARE. We handle the distribution.
                    </div>
                  </button>
                </div>
              </div>

              {/* Shared signature field */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  SIGN TO AUTHENTICATE
                </div>
                <code style={{
                  display: 'block', padding: '6px 10px', marginBottom: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--amber)',
                  wordBreak: 'break-all', lineHeight: 1.6,
                }}>
                  {challenge}
                </code>
                <textarea
                  rows={3}
                  value={sig}
                  onChange={e => { setSig(e.target.value); resetActionState(); }}
                  placeholder="Paste BIP-137 signature here..."
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box', resize: 'vertical',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: "'Courier New', monospace", fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>

              {err && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--red)', marginBottom: 8 }}>
                  {err}
                </div>
              )}

              {/* SELF-DISTRIBUTE actions */}
              {(modeView === 'self' && pendingMode !== 'managed') && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {dlState === 'ok' ? (
                    <span style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' }}>✓ CSV DOWNLOADED</span>
                  ) : (
                    <button className={styles.lookupBtn} onClick={handleDownload} disabled={dlState === 'loading'} style={{ fontSize: 11, padding: '6px 14px' }}>
                      {dlState === 'loading' ? 'downloading...' : 'download claim list (CSV) →'}
                    </button>
                  )}
                  {distState === 'ok' ? (
                    <span style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' }}>✓ DISTRIBUTION CONFIRMED</span>
                  ) : (
                    <button className={styles.lookupBtn} onClick={handleMarkDistributed} disabled={distState === 'loading'} style={{ fontSize: 11, padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                      {distState === 'loading' ? 'confirming...' : 'confirm distribution →'}
                    </button>
                  )}
                </div>
              )}

              {/* MANAGED: confirm selection */}
              {pendingMode === 'managed' && modeState !== 'ok' && (
                <div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
                    Once confirmed, you&apos;ll receive the UNATRARE Counterparty address to send your supply to.
                    UNATRARE will distribute {drop.totalClaims} token{drop.totalClaims !== 1 ? 's' : ''} to all verified claimants.
                  </div>
                  <button className={styles.lookupBtn} onClick={() => handleSetMode('managed')} disabled={modeState === 'loading'} style={{ fontSize: 11, padding: '6px 14px' }}>
                    {modeState === 'loading' ? 'confirming...' : 'confirm — use managed service →'}
                  </button>
                </div>
              )}

              {/* MANAGED: send instructions (after confirmed) */}
              {(modeView === 'managed' && modeState === 'ok' && adminAddr) && (
                <div style={{ marginTop: 8, padding: '12px', border: '1px solid var(--amber)', background: 'rgba(184,134,44,0.05)' }}>
                  <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--amber)', marginBottom: 8 }}>
                    SEND YOUR SUPPLY TO:
                  </div>
                  <code style={{ display: 'block', fontFamily: "'Courier New', monospace", fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', marginBottom: 8 }}>
                    {adminAddr}
                  </code>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    Send exactly <strong>{drop.totalClaims} × {tokenName}</strong> from your Counterparty wallet.
                    UNATRARE will distribute to all {drop.totalClaims} verified claimants.
                  </div>
                </div>
              )}

              {/* MANAGED: already set (loaded from DB) — show send instructions */}
              {(modeView === 'managed' && modeState !== 'ok') && (() => {
                // They've already chosen managed in a previous session — show instructions
                // But we don't have adminAddr yet (need to fetch it). Prompt them to re-sign.
                return (
                  <div style={{ marginTop: 8, padding: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--amber)', marginBottom: 8 }}>
                      MANAGED DISTRIBUTION SELECTED
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
                      UNATRARE will handle distribution. Paste your signature above and click below to reveal the send address.
                    </div>
                    <button className={styles.lookupBtn} onClick={() => handleSetMode('managed')} disabled={modeState === 'loading'} style={{ fontSize: 11, padding: '6px 14px' }}>
                      {modeState === 'loading' ? 'loading...' : 'reveal send address →'}
                    </button>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileSection({ address, initialProfile }) {
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState(initialProfile?.alias || '');
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [website, setWebsite] = useState(initialProfile?.website || '');
  const [twitter, setTwitter] = useState(initialProfile?.twitter_handle || '');
  const [sig, setSig] = useState('');
  const [state, setState] = useState('idle');
  const [errMsg, setErrMsg] = useState('');

  const challenge = `UNATRARE:PROFILE:${address}`;
  const hasProfile = !!(initialProfile?.alias || initialProfile?.bio);

  async function handleSave() {
    if (!sig.trim()) { setErrMsg('Paste your signature first'); return; }
    setState('loading'); setErrMsg('');
    try {
      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature:    sig.trim(),
          alias:        alias.trim(),
          bio:          bio.trim(),
          website:      website.trim(),
          twitterHandle: twitter.trim(),
        }),
      });
      const j = await res.json();
      if (j.ok) { setState('ok'); }
      else { setErrMsg(j.error || 'Save failed'); setState('error'); }
    } catch { setErrMsg('Network error'); setState('error'); }
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', boxSizing: 'border-box',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
    outline: 'none', marginBottom: 10,
  };
  const labelStyle = {
    display: 'block', fontFamily: 'var(--font-card)', fontSize: '8px',
    letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 4,
  };

  return (
    <div style={{ border: '1px solid var(--border)', marginTop: 24 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '0.1em' }}>
            YOUR ARTIST PROFILE
          </span>
          {hasProfile && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--green)' }}>· set</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 14 }}>
            This appears on your public artist page at{' '}
            <a href={`/artist/${address}`} style={{ color: 'var(--amber)', textDecoration: 'none' }}>
              /artist/{address.slice(0, 10)}…
            </a>.
          </div>

          <label style={labelStyle}>DISPLAY NAME</label>
          <input
            type="text"
            value={alias}
            maxLength={60}
            onChange={e => { setAlias(e.target.value); setState('idle'); setErrMsg(''); }}
            placeholder="e.g. JNA, SOFTPWAR, anonymous"
            style={inputStyle}
          />

          <label style={labelStyle}>BIO <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0 }}>({bio.length}/500)</span></label>
          <textarea
            rows={4}
            value={bio}
            maxLength={500}
            onChange={e => { setBio(e.target.value); setState('idle'); setErrMsg(''); }}
            placeholder="Tell the council who you are..."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }}
          />

          <label style={labelStyle}>WEBSITE</label>
          <input
            type="url"
            value={website}
            onChange={e => { setWebsite(e.target.value); setState('idle'); setErrMsg(''); }}
            placeholder="https://..."
            style={inputStyle}
          />

          <label style={labelStyle}>X / TWITTER HANDLE</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>@</span>
            <input
              type="text"
              value={twitter}
              maxLength={50}
              onChange={e => { setTwitter(e.target.value.replace(/^@/, '')); setState('idle'); setErrMsg(''); }}
              placeholder="handle (no @)"
              style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
            />
          </div>

          <label style={labelStyle}>SIGN TO VERIFY</label>
          <code style={{
            display: 'block', padding: '6px 10px', marginBottom: 8,
            background: 'var(--bg)', border: '1px solid var(--border)',
            fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--amber)',
            wordBreak: 'break-all', lineHeight: 1.6,
          }}>
            {challenge}
          </code>
          <textarea
            rows={3}
            value={sig}
            onChange={e => { setSig(e.target.value); setState('idle'); setErrMsg(''); }}
            placeholder="Paste BIP-137 signature here..."
            style={{
              width: '100%', padding: '7px 10px', boxSizing: 'border-box', resize: 'vertical',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text)', fontFamily: "'Courier New', monospace", fontSize: 11,
              outline: 'none', marginBottom: 10,
            }}
          />

          {errMsg && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--red)', marginBottom: 8 }}>
              {errMsg}
            </div>
          )}
          {state === 'ok' ? (
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' }}>
              ✓ PROFILE SAVED — view at /artist/{address.slice(0, 10)}…
            </div>
          ) : (
            <button
              className={styles.lookupBtn}
              onClick={handleSave}
              disabled={state === 'loading'}
              style={{ fontSize: 11, padding: '6px 14px' }}
            >
              {state === 'loading' ? 'saving...' : 'save profile →'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function hoursLabel(h) {
  const n = parseInt(h, 10);
  if (isNaN(n) || n < 1) return '';
  if (n < 48) return `${n} hour${n !== 1 ? 's' : ''}`;
  const days = Math.round(n / 24);
  if (days < 14) return `≈ ${days} day${days !== 1 ? 's' : ''}`;
  const weeks = Math.round(days / 7);
  return `≈ ${weeks} week${weeks !== 1 ? 's' : ''}`;
}

function DropSetup({ tokenName, artistAddress, onCreated }) {
  const [open, setOpen]         = useState(false);
  const [distMode, setDistMode] = useState('unatpepe'); // 'unatpepe' | 'open'
  const [supply, setSupply]     = useState('100');
  const [hours, setHours]       = useState('168');
  const [sig, setSig]           = useState('');
  const [state, setState]       = useState('idle'); // idle | loading | ok | error
  const [err, setErr]           = useState('');

  const challenge = `UNATRARE:DROP:CREATE:${tokenName}`;

  async function handleCreate() {
    const supplyNum = parseInt(supply, 10);
    const hoursNum  = parseInt(hours, 10);
    if (isNaN(supplyNum) || supplyNum < 10 || supplyNum > 2016) {
      setErr('Supply must be between 10 and 2016'); return;
    }
    if (isNaN(hoursNum) || hoursNum < 24 || hoursNum > 720) {
      setErr('Window must be between 24 and 720 hours'); return;
    }
    if (!sig.trim()) { setErr('Paste your signature first'); return; }
    setState('loading'); setErr('');
    try {
      const res = await fetch('/api/drops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenName,
          address:     artistAddress,
          signature:   sig.trim(),
          supplyTotal: supplyNum,
          windowHours: hoursNum,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState('ok');
        setTimeout(() => onCreated(), 1500);
      } else {
        setErr(j.error || 'Failed to activate drop');
        setState('error');
      }
    } catch {
      setErr('Network error — please try again');
      setState('error');
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
      <button className={styles.expandBtn} onClick={() => setOpen(o => !o)}>
        {open ? '▲ hide drop setup' : '▼ set up drop'}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {state === 'ok' ? (
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' }}>
              ✓ DROP ACTIVATED — reloading...
            </div>
          ) : (
            <>
              {/* Distribution type selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>
                  DISTRIBUTION TYPE
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                  <input
                    type="radio"
                    name={`distMode-${tokenName}`}
                    value="unatpepe"
                    checked={distMode === 'unatpepe'}
                    onChange={() => { setDistMode('unatpepe'); setErr(''); setState('idle'); }}
                    style={{ marginTop: 2, accentColor: 'var(--amber)' }}
                  />
                  <div>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--text)' }}>
                      UNATPEPE HOLDERS
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 2 }}>
                      Open a gated claim window — one free copy per UNATPEPE address. UNATRARE manages the queue.
                    </div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={`distMode-${tokenName}`}
                    value="open"
                    checked={distMode === 'open'}
                    onChange={() => { setDistMode('open'); setErr(''); setState('idle'); }}
                    style={{ marginTop: 2, accentColor: 'var(--amber)' }}
                  />
                  <div>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--text)' }}>
                      OPEN DISTRIBUTION
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 2 }}>
                      Set up a Counterparty dispenser — anyone can buy or claim directly on-chain. You manage it yourself.
                    </div>
                  </div>
                </label>
              </div>

              {/* ── UNATPEPE-gated path ─────────────────────────────── */}
              {distMode === 'unatpepe' && (
                <>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
                    Offer copies of <strong>{tokenName}</strong> to UNATPEPE holders.
                    Each UNATPEPE address gets one claim. You distribute the tokens yourself
                    after the window closes — or request UNATRARE to handle it.
                  </div>

                  {/* Supply + Window inputs */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 4 }}>
                        COPIES TO OFFER
                      </div>
                      <input
                        type="number"
                        min={10}
                        max={2016}
                        value={supply}
                        onChange={e => { setSupply(e.target.value); setErr(''); setState('idle'); }}
                        style={{
                          width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 3 }}>
                        10 – 2016 · one claim per UNATPEPE address
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 4 }}>
                        CLAIM WINDOW (hours)
                      </div>
                      <input
                        type="number"
                        min={24}
                        max={720}
                        value={hours}
                        onChange={e => { setHours(e.target.value); setErr(''); setState('idle'); }}
                        style={{
                          width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 3 }}>
                        {hoursLabel(hours)} · min 24h · max 720h (30 days)
                      </div>
                    </div>
                  </div>

                  {/* Challenge string + signature */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 4 }}>
                      SIGN TO ACTIVATE
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
                      Open the wallet holding <strong>{tokenName}</strong> and sign this message
                      (address: {artistAddress.slice(0, 8)}…{artistAddress.slice(-6)})
                    </div>
                    <code style={{
                      display: 'block', padding: '6px 10px', marginBottom: 8,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--amber)',
                      wordBreak: 'break-all', lineHeight: 1.6,
                    }}>
                      {challenge}
                    </code>
                    <textarea
                      rows={3}
                      value={sig}
                      onChange={e => { setSig(e.target.value); setErr(''); setState('idle'); }}
                      placeholder="Paste BIP-137 signature here..."
                      style={{
                        width: '100%', padding: '7px 10px', boxSizing: 'border-box', resize: 'vertical',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        color: 'var(--text)', fontFamily: "'Courier New', monospace", fontSize: 11,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {err && (
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--red)', marginBottom: 8 }}>
                      {err}
                    </div>
                  )}

                  <button
                    className={styles.lookupBtn}
                    onClick={handleCreate}
                    disabled={state === 'loading'}
                    style={{ fontSize: 11, padding: '6px 14px' }}
                  >
                    {state === 'loading' ? 'activating...' : 'activate drop →'}
                  </button>

                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
                    Once active, UNATPEPE holders can claim on the /drops page. After the window
                    closes, download the claim list and send {tokenName} from your Counterparty
                    wallet — or choose &ldquo;UNATRARE sends&rdquo; in the drop management panel.
                  </div>
                </>
              )}

              {/* ── Open distribution path ──────────────────────────── */}
              {distMode === 'open' && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16 }}>
                    A <strong>Counterparty dispenser</strong> lets anyone buy or claim <strong>{tokenName}</strong> directly
                    on-chain by sending BTC to your dispenser address. You set the price and quantity — no UNATRARE involvement.
                  </div>

                  <div style={{
                    border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 16,
                    background: 'var(--bg-card)',
                  }}>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--amber)', marginBottom: 10 }}>
                      HOW TO SET UP A DISPENSER
                    </div>
                    <ol style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                      <li>Open <strong>Freewallet</strong> → go to your token <strong>{tokenName}</strong></li>
                      <li>Tap <strong>Create Dispenser</strong> (or in Electrum: Counterparty → Dispensers)</li>
                      <li>Set price per unit (in BTC), quantity to dispense, and escrow amount</li>
                      <li>Broadcast — your dispenser address is live once confirmed</li>
                      <li>Share the dispenser address so buyers can send BTC to receive your token</li>
                    </ol>
                  </div>

                  <div style={{
                    border: '1px solid var(--border)', padding: '10px 16px', marginBottom: 16,
                    background: 'var(--bg-card)',
                  }}>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6 }}>
                      TIP — ADD YOUR DISPENSER TO YOUR LISTING
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      Once your dispenser is set up, use <strong>manage your listing</strong> above to add the
                      dispenser address — it will appear as a &ldquo;buy&rdquo; button on your card page.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a
                      href="https://docs.counterparty.io/docs/basics/dispensers/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px',
                        color: 'var(--text-dim)', border: '1px solid var(--border)',
                        padding: '6px 12px', textDecoration: 'none',
                      }}
                    >
                      counterparty dispenser docs →
                    </a>
                    <a
                      href="https://freewallet.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px',
                        color: 'var(--text-dim)', border: '1px solid var(--border)',
                        padding: '6px 12px', textDecoration: 'none',
                      }}
                    >
                      freewallet.io →
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ sub, artistAddress, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // editable fields
  const [dispenser,    setDispenser]    = useState(sub.dispenserAddress || '');
  const [artistSolAddress, setArtistSolAddress] = useState(sub.artistSolAddress || '');
  const [displayTitle, setDisplayTitle] = useState(sub.displayTitle || '');
  const [artistHandle, setArtistHandle] = useState(sub.artistHandle || '');
  const [description,  setDescription]  = useState(sub.description || '');
  const [officialSignal, setOfficialSignal] = useState(sub.officialSignal || '');
  const [campaignUpdate, setCampaignUpdate] = useState('');
  const [audioUrl,     setAudioUrl]     = useState(sub.audioUrl || '');
  const [videoUrl,     setVideoUrl]     = useState(sub.videoUrl || '');
  // art replacement
  const [artUpload,      setArtUpload]      = useState(null); // { url, hash, mime }
  const [artUploadState, setArtUploadState] = useState('idle'); // idle|uploading|ready|error
  const [artUploadErr,   setArtUploadErr]   = useState('');
  // form state
  const [manageSig,   setManageSig]   = useState('');
  const [manageState, setManageState] = useState('idle'); // idle | loading | ok | error
  const [manageErr,   setManageErr]   = useState('');
  const meta = STATUS_META[sub.status] || STATUS_META.pending;

  const DISPENSER_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  const challenge = `UNATRARE:UPDATE:${sub.tokenName}`;

  function resetManage() {
    setManageErr(''); setManageState('idle');
  }

  async function handleArtFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setArtUploadErr('File too large — image max is 15 MB'); setArtUploadState('error'); return; }
    setArtUploadState('uploading');
    setArtUploadErr('');
    setArtUpload(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('tokenName', sub.tokenName);
    try {
      const res = await fetch('/api/upload-art', { method: 'POST', body: fd });
      const j = await res.json();
      if (j.ok) {
        setArtUpload({ url: j.url, hash: j.hash, mime: file.type });
        setArtUploadState('ready');
      } else {
        setArtUploadErr(j.error || 'Upload failed');
        setArtUploadState('error');
      }
    } catch {
      setArtUploadErr('Network error during upload');
      setArtUploadState('error');
    }
  }

  async function handleManageSubmit() {
    if (dispenser && !DISPENSER_RE.test(dispenser)) {
      setManageErr('Invalid address — must be a legacy Bitcoin address starting with 1');
      return;
    }
    if (artistSolAddress && !SOL_ADDR_RE.test(artistSolAddress.trim())) {
      setManageErr('Invalid SOL payout address — must be a valid Solana public key');
      return;
    }
    if (!manageSig.trim()) {
      setManageErr('Paste your BIP-137 signature');
      return;
    }
    setManageState('loading');
    setManageErr('');
    try {
      const payload = {
        tokenName:        sub.tokenName,
        artistAddress:    artistAddress,
        signature:        manageSig.trim(),
        dispenserAddress: dispenser.trim(),
          artistSolAddress: artistSolAddress.trim(),
        displayTitle:     displayTitle.trim(),
        artistHandle:     artistHandle.trim(),
        description:      description.trim(),
        officialSignal:   officialSignal.trim(),
        campaignUpdate:   campaignUpdate.trim(),
        audioUrl:         audioUrl.trim(),
        videoUrl:         videoUrl.trim(),
      };
      if (artUpload) {
        payload.artUrl  = artUpload.url;
        payload.artHash = artUpload.hash;
        payload.artMime = artUpload.mime;
      }
      const res = await fetch('/api/update-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setManageState('ok');
      } else {
        setManageErr(json.error || 'Update failed');
        setManageState('error');
      }
    } catch {
      setManageErr('Network error — please try again');
      setManageState('error');
    }
  }

  return (
    <div className={`${styles.card} ${styles['card_' + sub.status]}`}>
      {/* Top bar */}
      <div className={styles.cardTop}>
        <div className={styles.cardLeft}>
          {sub.artUrl && (
            <div className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {sub.artMime?.startsWith('video/')
                ? (sub.artCoverUrl
                  ? <img src={sub.artCoverUrl} alt={sub.tokenName} className={styles.thumbImg} />
                  : <div className={styles.thumbImg} style={{display:'flex',alignItems:'center',justifyContent:'center',background:'var(--surface)',fontSize:18}}>▶</div>)
                : <img src={sub.artUrl} alt={sub.tokenName} className={styles.thumbImg} />}
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

      {/* Manage listing — pending and approved tokens */}
      {(sub.status === 'approved' || sub.status === 'pending') && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <button
            className={styles.expandBtn}
            onClick={() => { setManageOpen(o => !o); resetManage(); }}
          >
            {manageOpen ? '▲ hide listing settings' : '▼ manage your listing'}
          </button>
          {manageOpen && (
            <div style={{ marginTop: 12 }}>
              {sub.unatpepeAllocQty > 0 && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 12 }}>
                  UNATPEPE drop: <strong>{sub.unatpepeAllocQty}</strong> copies offered to holders
                </div>
              )}

              {/* ── Art details ───────────────────────────────────────── */}
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>
                ART DETAILS
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  DISPLAY TITLE
                </div>
                <input
                  type="text"
                  value={displayTitle}
                  onChange={e => { setDisplayTitle(e.target.value); resetManage(); }}
                  placeholder={sub.tokenName}
                  maxLength={128}
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  ARTIST HANDLE
                </div>
                <input
                  type="text"
                  value={artistHandle}
                  onChange={e => { setArtistHandle(e.target.value); resetManage(); }}
                  placeholder="@handle (optional)"
                  maxLength={64}
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  DESCRIPTION
                </div>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => { setDescription(e.target.value); resetManage(); }}
                  placeholder="Short description of the art and its significance..."
                  maxLength={2000}
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box', resize: 'vertical',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  OFFICIAL ARTIST SIGNAL
                </div>
                <textarea
                  rows={3}
                  value={officialSignal}
                  onChange={e => { setOfficialSignal(e.target.value); resetManage(); }}
                  placeholder="One official message torchbearers can rally around..."
                  maxLength={280}
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box', resize: 'vertical',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none',
                  }}
                />
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 4 }}>
                  One permanent campaign message from the artist. Keep it short and shareable.
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  POST ARTIST UPDATE
                </div>
                <textarea
                  rows={3}
                  value={campaignUpdate}
                  onChange={e => { setCampaignUpdate(e.target.value); resetManage(); }}
                  placeholder="Post a short campaign update that will appear on the card page..."
                  maxLength={500}
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box', resize: 'vertical',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none',
                  }}
                />
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 4 }}>
                  Append-only. Use this for reveals, milestones, context, and artist notes.
                </div>
              </div>

              {/* ── Replace art image ─────────────────────────────────── */}
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>
                REPLACE ART IMAGE
              </div>
              <div style={{ marginBottom: 16 }}>
                {sub.status === 'approved' ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {sub.artUrl && (
                      sub.artMime?.startsWith('video/')
                        ? (sub.artCoverUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={sub.artCoverUrl} alt="certified art" style={{ height: 64, width: 64, objectFit: 'cover', border: '1px solid var(--green)', flexShrink: 0 }} />
                          : <div style={{ height: 64, width: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--green)', background: 'var(--surface)', fontSize: 22, flexShrink: 0 }}>▶</div>)
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={sub.artUrl} alt="certified art" style={{ height: 64, width: 64, objectFit: 'cover', border: '1px solid var(--green)', flexShrink: 0 }} />
                    )}
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      Art is locked after certification. The council judged this specific image — swapping it after approval would undermine the certification.<br />
                      <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Need a legitimate correction? Contact support.</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
                      Upload a replacement image (PNG, JPG, GIF, WebP — max 15 MB). Leave blank to keep the current art.
                    </div>
                    {sub.artUrl && artUploadState !== 'ready' && (
                      <div style={{ marginBottom: 8 }}>
                        {sub.artMime?.startsWith('video/')
                          ? (sub.artCoverUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={sub.artCoverUrl} alt="current art" style={{ height: 64, width: 64, objectFit: 'cover', border: '1px solid var(--border)' }} />
                            : <div style={{ height: 64, width: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 22 }}>▶</div>)
                          // eslint-disable-next-line @next/next/no-img-element
                          : <img src={sub.artUrl} alt="current art" style={{ height: 64, width: 64, objectFit: 'cover', border: '1px solid var(--border)' }} />}
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 4 }}>current</div>
                      </div>
                    )}
                    {artUploadState === 'ready' && artUpload && (
                      <div style={{ marginBottom: 8 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={artUpload.url} alt="new art" style={{ height: 64, width: 64, objectFit: 'cover', border: '1px solid var(--green)' }} />
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--green)', marginTop: 4 }}>✓ new art ready</div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleArtFileChange}
                      disabled={artUploadState === 'uploading'}
                      style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)' }}
                    />
                    {artUploadState === 'uploading' && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--amber)', marginTop: 6 }}>uploading...</div>
                    )}
                    {artUploadErr && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--red)', marginTop: 6 }}>{artUploadErr}</div>
                    )}
                  </>
                )}
              </div>

              {/* ── Media links ───────────────────────────────────────── */}
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>
                MEDIA LINKS
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  AUDIO URL
                </div>
                <input
                  type="url"
                  value={audioUrl}
                  onChange={e => { setAudioUrl(e.target.value); resetManage(); }}
                  placeholder="https://arweave.net/... (leave blank to remove)"
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
                  VIDEO URL
                </div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={e => { setVideoUrl(e.target.value); resetManage(); }}
                  placeholder="https://arweave.net/... (leave blank to remove)"
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>

              {/* ── Dispenser address (approved only) ────────────────── */}
              {sub.status === 'approved' && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6 }}>
                    DISPENSER ADDRESS
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
                    Add your Counterparty dispenser address to show a secondary market link on your card page.
                  </div>
                  <input
                    type="text"
                    value={dispenser}
                    onChange={e => { setDispenser(e.target.value.trim()); resetManage(); }}
                    placeholder="1YourDispenserAddress... (leave blank to remove)"
                    style={{
                      width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
              )}

                {/* ── Artist SOL payout address (signed binding) ───────────── */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6 }}>
                    ARTIST SOL PAYOUT ADDRESS
                  </div>

                  <div style={{
                    border: '1px solid var(--amber)',
                    background: 'rgba(184,134,44,0.06)',
                    padding: '10px 12px',
                    marginBottom: 10,
                  }}>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--amber)', marginBottom: 6 }}>
                      QUICK SETUP (ARTIST-FRIENDLY)
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      1. Paste your Solana receive address below.
                      <br />
                      2. Sign the BTC message in the section below (same as other listing edits).
                      <br />
                      3. Click <strong style={{ color: 'var(--text)' }}>save changes</strong>.
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Link
                        href="/studio/sol-payout-help"
                        style={{
                          fontFamily: 'var(--font-card)',
                          fontSize: '9px',
                          letterSpacing: '2px',
                          color: 'var(--amber)',
                          textDecoration: 'none',
                        }}
                      >
                        need help? 1-minute walkthrough →
                      </Link>
                    </div>
                  </div>

                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
                    This makes sure split payouts go to your wallet. You can update it anytime with a new signature.
                    {sub.artistSolVerifiedAt ? ` Last verified ${new Date(sub.artistSolVerifiedAt * 1000).toISOString().slice(0, 10)}.` : ''}
                  </div>

                  <input
                    type="text"
                    value={artistSolAddress}
                    onChange={e => { setArtistSolAddress(e.target.value.trim()); resetManage(); }}
                    placeholder="Example: 9xQeWvG816bUx9EPfV7a..."
                    style={{
                      width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                      outline: 'none',
                    }}
                  />

                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
                    Tip: send a tiny test transfer to this address first if you want to double-check it.
                  </div>
                </div>

              {/* ── Signature ─────────────────────────────────────────── */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6 }}>
                  SIGN TO VERIFY OWNERSHIP
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
                  Sign this message with the Bitcoin address you used for this token:
                </div>
                <code style={{
                  display: 'block', padding: '6px 10px', marginBottom: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--amber)',
                  wordBreak: 'break-all', lineHeight: 1.6,
                }}>
                  {challenge}
                </code>
                <textarea
                  rows={3}
                  value={manageSig}
                  onChange={e => { setManageSig(e.target.value); resetManage(); }}
                  placeholder="Paste BIP-137 signature here..."
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box', resize: 'vertical',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontFamily: "'Courier New', monospace", fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>
              {manageErr && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--red)', marginBottom: 8 }}>
                  {manageErr}
                </div>
              )}
              {manageState === 'ok' ? (
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' }}>
                  ✓ UPDATED — changes saved
                </div>
              ) : (
                <button
                  className={styles.lookupBtn}
                  onClick={handleManageSubmit}
                  disabled={manageState === 'loading' || artUploadState === 'uploading'}
                  style={{ fontSize: 11, padding: '6px 14px' }}
                >
                  {manageState === 'loading' ? 'saving...' : 'save changes →'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Drop distribution — approved tokens with an active/closed/distributed drop */}
      {sub.status === 'approved' && sub.drop && (
        <DropSection drop={sub.drop} tokenName={sub.tokenName} artistAddress={artistAddress} />
      )}

      {/* Drop setup — approved tokens with no drop yet */}
      {sub.status === 'approved' && !sub.drop && (
        <DropSetup tokenName={sub.tokenName} artistAddress={artistAddress} onCreated={onRefresh} />
      )}
    </div>
  );
}

// ── Account payout — one SOL address for ALL of this artist's cards ──
function AccountPayoutPanel({ address }) {
  const [current, setCurrent] = useState(null);
  const [sol, setSol]     = useState('');
  const [sig, setSig]     = useState('');
  const [state, setState] = useState('idle'); // idle | loading | ok | error
  const [err, setErr]     = useState('');
  const [updated, setUpdated] = useState(0);
  const [open, setOpen]   = useState(false);

  const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  const challenge = `UNATRARE:PAYOUT:${address}`;

  useEffect(() => {
    let live = true;
    fetch(`/api/artist/payout?address=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then(j => { if (live && j.ok) { setCurrent(j); setSol(j.solPayout || ''); } })
      .catch(() => {});
    return () => { live = false; };
  }, [address]);

  async function apply() {
    if (!SOL_RE.test(sol.trim())) { setErr('Enter a valid Solana payout address'); return; }
    if (!sig.trim()) { setErr('Paste your signature of the message below'); return; }
    setState('loading'); setErr('');
    try {
      const res = await fetch('/api/artist/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistAddress: address, signature: sig.trim(), solAddress: sol.trim() }),
      });
      const j = await res.json();
      if (j.ok) {
        setState('ok'); setUpdated(j.updated); setSig('');
        setCurrent(c => ({ ...(c || {}), solPayout: j.solPayout, linkedCount: j.updated }));
      } else { setErr(j.error || 'Failed to save'); setState('error'); }
    } catch { setErr('Network error — try again'); setState('error'); }
  }

  const box = { fontFamily: 'var(--font-card)', fontSize: 12, color: 'var(--text)', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface,#0f0f0f)', width: '100%', wordBreak: 'break-all' };
  const label = { fontFamily: 'var(--font-card)', fontSize: 9, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 };

  return (
    <div style={{ border: '1px solid var(--amber)', borderRadius: 12, padding: 16, marginBottom: 18, background: 'rgba(255,143,90,0.05)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: 2, color: 'var(--amber)' }}>
        {open ? '▲' : '▼'} 🎨 PAYOUT ADDRESS · ALL YOUR CARDS
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>
            Set one Solana address here and it applies to <strong>every card you own</strong> — so 31% of each
            salute reaches you. Update it anytime; it re-applies to all your cards.
            {current && (
              <> Currently linked on <strong>{current.linkedCount ?? 0}</strong> of <strong>{current.cardCount ?? 0}</strong> cards.</>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={label}>your SOL payout address</div>
            <input value={sol} onChange={e => { setSol(e.target.value.trim()); setState('idle'); setErr(''); }} placeholder="your Solana address" spellCheck={false} autoCapitalize="none" style={box} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={label}>1) sign this exact message with your submission wallet</div>
            <div style={{ ...box, userSelect: 'all', color: 'var(--amber)' }}>{challenge}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={label}>2) paste the signature</div>
            <input value={sig} onChange={e => { setSig(e.target.value.trim()); setState('idle'); setErr(''); }} placeholder="base64 signature from your wallet" spellCheck={false} autoCapitalize="none" style={box} />
          </div>

          {err && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--red,#ff6b6b)', marginBottom: 10 }}>{err}</div>}
          {state === 'ok' && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--green,#b4ff6f)', marginBottom: 10 }}>✓ Payout saved and applied to {updated} card{updated === 1 ? '' : 's'}.</div>}

          <button
            onClick={apply}
            disabled={state === 'loading'}
            style={{ fontFamily: 'var(--font-card)', fontSize: 12, letterSpacing: 1, padding: '11px 18px', borderRadius: 10, cursor: 'pointer', background: 'var(--amber)', color: '#080808', fontWeight: 700, border: '1px solid var(--amber)' }}
          >
            {state === 'loading' ? 'saving…' : 'save payout for all my cards'}
          </button>

          <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
            Sign with the same Bitcoin wallet you submitted with. Need help signing?{' '}
            <Link href="/studio/sol-payout-help" style={{ color: 'var(--amber)' }}>SOL payout help →</Link>
          </div>
        </div>
      )}
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
            <h1 className={styles.title}>ARTIST ST<span>U</span>DIO</h1>
            <div className={styles.subtitle}>
              Enter your Bitcoin address to manage submissions, listings, drops,<br />
              payout settings, and your Pepe Council verdicts.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href="/studio" style={{
                fontFamily: 'var(--font-card)',
                fontSize: '9px',
                letterSpacing: '2px',
                color: 'var(--amber)',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}>
                artist studio is the primary entry point →
              </Link>
            </div>
            <div style={{
              marginTop: 8,
              fontFamily: 'var(--font-card)',
              fontSize: '8px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>
              legacy compatibility path for old links
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
                {loading ? 'loading...' : 'open artist studio →'}
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
                  <AccountPayoutPanel address={data.address} />
                  <div className={styles.cardList}>
                    {data.submissions.map(sub => (
                      <SubmissionCard key={sub.tokenName} sub={sub} artistAddress={data.address} onRefresh={handleLookup} />
                    ))}
                  </div>
                  <ProfileSection address={data.address} initialProfile={data.profile} />
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
