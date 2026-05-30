'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './admin.module.css';

// ── Admin password gate ────────────────────────────────────────
function LoginGate({ onAuth }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      onAuth(json.token);
    } else {
      setErr('invalid password');
      setPw('');
    }
  }

  return (
    <div className={styles.gate}>
      <div className={styles.gateBox}>
        <div className={styles.gateLogo}>UNATR<span>A</span>RE</div>
        <div className={styles.gateLabel}>ADMIN ACCESS</div>
        <form onSubmit={handleLogin} className={styles.gateForm}>
          <input
            type="password"
            className={styles.gateInput}
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="password"
            autoFocus
          />
          {err && <div className={styles.gateErr}>{err}</div>}
          <button type="submit" className={styles.gateBtn} disabled={loading || !pw}>
            {loading ? 'checking...' : 'enter →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Single token row in review queue ──────────────────────────
function TokenRow({ token, authToken, onAction }) {
  const [loading, setLoading] = useState(null); // 'approve' | 'reject' | 'judge' | 'genesis' | 'purge' | 'reveal' | null
  const [note, setNote] = useState('');
  const [targetSeries, setTargetSeries] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null); // set after approve/genesis
  const [msgCopied, setMsgCopied] = useState(false);
  const [revealed, setRevealed] = useState(!!token.revealed_at); // tracks drop state
  const [announceText, setAnnounceText] = useState(null); // set after drop art
  const [announceCopied, setAnnounceCopied] = useState(false);
  const [dirHidden, setDirHidden] = useState(!!token.directory_hidden);
  const [stamped, setStamped] = useState(!!token.council_certified);

  async function act(action) {
    setLoading(action);
    const body = { tokenName: token.token_name, action, note };
    if ((action === 'approve' || action === 'genesis') && targetSeries !== '') body.series = targetSeries;
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setLoading(null);
    if (json.ok) {
      if (action === 'hide_from_directory') {
        setDirHidden(true);
      } else if (action === 'show_in_directory') {
        setDirHidden(false);
      } else if (action === 'certify_stamp') {
        setStamped(true);
        setRevealed(true); // certify_stamp auto-reveals server-side
      } else if (action === 'decertify_stamp') {
        setStamped(false);
      } else if (action === 'approve' || action === 'genesis') {
        setApprovalResult(json); // show branded message before dismissing
      } else if (action === 'reveal') {
        setRevealed(true);
        const cardUrl = `https://unatrare.wtf/card/${token.token_name}`;
        const title = token.display_title && token.display_title !== token.token_name
          ? `${token.display_title} (${token.token_name})`
          : token.token_name;
        const byLine = token.artist_handle ? ` by @${token.artist_handle}` : '';
        const cardLine = token.series && token.card_number
          ? `Series ${token.series} · Card #${String(token.card_number).padStart(3,'0')}`
          : '';
        const tweet = [
          `🐸 NEW DROP: ${title}${byLine}`,
          cardLine,
          `Certified Dank on UNATRARE`,
          cardUrl,
          `#Counterparty #UNATPEPE #RarePepe`,
        ].filter(Boolean).join('\n');
        setAnnounceText(tweet);
      } else {
        onAction(token.token_name, action);
      }
    } else {
      alert(json.error || 'Action failed');
    }
  }

  const submittedAt = token.submitted_at
    ? new Date(token.submitted_at * 1000).toISOString().slice(0, 16).replace('T', ' ')
    : '—';

  return (
    <div className={`${styles.row} ${expanded ? styles.rowExpanded : ''}`}>
      <div className={styles.rowMain} onClick={() => setExpanded(v => !v)}>
        <div className={styles.rowArt} style={{position:'relative'}}>
          {token.art_url ? (
            <img src={token.art_url} alt={token.token_name} className={styles.rowThumb} />
          ) : (
            <div className={styles.rowThumbEmpty} />
          )}
          {(token.status === 'pending' || token.status === 'rejected') && (
            <div style={{
              position:'absolute', inset:0, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              background: token.art_url ? 'rgba(0,0,0,0.55)' : 'transparent',
              gap:1,
            }}>
              <span style={{fontSize:'18px', lineHeight:1, filter:'drop-shadow(0 0 3px #000)'}}>🐸</span>
              <span style={{
                fontFamily:'var(--font-card)', fontSize:'5px', letterSpacing:'1px',
                color: token.status === 'pending' ? 'var(--amber)' : 'var(--red)',
                textTransform:'uppercase',
              }}>
                {token.status === 'pending' ? 'pending' : 'rejected'}
              </span>
            </div>
          )}
        </div>
        <div className={styles.rowInfo}>
          <div className={styles.rowName}>{token.token_name}</div>
          <div className={styles.rowMeta}>
            {token.artist_address?.slice(0, 14)}…
            {token.payment_currency && ` · paid ${token.payment_currency}`}
          </div>
          <div className={styles.rowDate}>
            {submittedAt}
          </div>
          {token.judge_score !== undefined && token.judge_score !== null && (
            <div className={styles.rowScore}>
              judge score: <strong>{token.judge_score?.toFixed(1)}</strong>/69
            </div>
          )}
          {approvalResult && (
            <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px',
              color:'var(--green)', marginTop:4}}>
              ✓ CERTIFIED — send payment link to artist
            </div>
          )}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {token.status === 'approved' && !token.revealed_at && !approvalResult && (
            <span style={{
              fontFamily:'var(--font-card)', fontSize:'8px', letterSpacing:'2px',
              color:'var(--amber)', border:'1px solid var(--amber)',
              padding:'2px 6px', whiteSpace:'nowrap',
            }}>⬡ DROP NEEDED</span>
          )}
          <div className={styles.rowToggle}>{approvalResult ? '✉' : expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {expanded && !approvalResult && (
        <div className={styles.rowDetail}>
          {token.art_url && (
            <div className={styles.detailArt}>
              <img src={token.art_url} alt={token.token_name} className={styles.detailImg} />
            </div>
          )}
          <div className={styles.detailMeta}>
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Token</span>
              <span className={styles.detailVal}>{token.token_name}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Address</span>
              <span className={styles.detailVal} style={{fontFamily:'var(--font-card)', fontSize:11}}>
                {token.artist_address}
              </span>
            </div>
            {token.display_title && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Title</span>
                <span className={styles.detailVal}>{token.display_title}</span>
              </div>
            )}
            {token.description && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Description</span>
                <span className={styles.detailVal}>{token.description}</span>
              </div>
            )}
            {token.ord_inscription && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>ORD</span>
                <span className={styles.detailVal} style={{fontFamily:'var(--font-card)', fontSize:10}}>
                  {token.ord_inscription}
                </span>
              </div>
            )}
            {token.payment_txid && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Payment TXid</span>
                <a
                  href={`https://mempool.space/tx/${token.payment_txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.detailLink}
                >
                  {token.payment_txid.slice(0, 16)}…
                </a>
              </div>
            )}
            {token.rejection_reason && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Pepai Reason</span>
                <span className={styles.detailVal}>{token.rejection_reason}</span>
              </div>
            )}
          </div>

          {/* Per-judge breakdown */}
          {token.judge_notes && (() => {
            try {
              const notes = JSON.parse(token.judge_notes);
              return (
                <div style={{margin:'12px 0', padding:'10px 12px', border:'1px solid var(--border-dim)', background:'var(--bg)'}}>
                  <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px', color:'var(--text-dim)', marginBottom:8}}>
                    JUDGE PANEL VERDICT
                  </div>
                  {notes.map(j => (
                    <div key={j.judge_id} style={{display:'flex', gap:8, marginBottom:6, alignItems:'flex-start'}}>
                      <div style={{
                        fontFamily:'var(--font-card)', fontSize:'8px', letterSpacing:'1px',
                        color: j.verdict === 'CERTIFIED' ? 'var(--green)' : 'var(--red)',
                        minWidth:12, marginTop:1,
                      }}>
                        {j.verdict === 'CERTIFIED' ? '✓' : '✗'}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px', color:'var(--amber)', marginBottom:2}}>
                          {j.display_name}
                          <span style={{color:'var(--text-dim)', marginLeft:8}}>
                            {Object.values(j.scores || {}).reduce((a,b) => a+b, 0)}/45
                          </span>
                        </div>
                        <div style={{fontFamily:'var(--font-body)', fontSize:'11px', color:'var(--text-dim)', lineHeight:1.5}}>
                          {j.reasoning}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            } catch { return null; }
          })()}

          <div className={styles.actions}>
            <textarea
              className={styles.noteInput}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="admin note (optional — shown in rejection feedback)"
              rows={2}
            />
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <span style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px', color:'var(--text-dim)', whiteSpace:'nowrap'}}>
                SERIES OVERRIDE
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={targetSeries}
                onChange={e => setTargetSeries(e.target.value)}
                placeholder="auto"
                style={{
                  width:80, padding:'5px 8px',
                  background:'var(--bg)', border:'1px solid var(--border)',
                  color:'var(--text)', fontFamily:'var(--font-card)', fontSize:'11px',
                  letterSpacing:'2px',
                }}
              />
              <span style={{fontFamily:'var(--font-body)', fontSize:'11px', color:'var(--text-dim)'}}>
                (blank = auto-assign)
              </span>
            </div>
            <div className={styles.actionBtns}>
              <button
                className={`${styles.actionBtn} ${styles.approveBtn}`}
                onClick={() => act('approve')}
                disabled={!!loading}
              >
                {loading === 'approve' ? 'approving...' : '✓ certify'}
              </button>
              <button
                className={`${styles.actionBtn} ${styles.rejectBtn}`}
                onClick={() => act('reject')}
                disabled={!!loading}
              >
                {loading === 'reject' ? 'rejecting...' : '✗ reject'}
              </button>
              <button
                className={`${styles.actionBtn} ${styles.judgeBtn}`}
                onClick={() => act('judge')}
                disabled={!!loading}
              >
                {loading === 'judge' ? 'judging...' : '⚡ re-judge'}
              </button>
              <button
                className={`${styles.actionBtn} ${styles.genesisBtn}`}
                onClick={() => act('genesis')}
                disabled={!!loading}
                title={`Admin-certify as founding card (Series ${targetSeries !== '' ? targetSeries : '0'} default) — no pepai judgment required`}
              >
                {loading === 'genesis' ? 'certifying...' : '★ genesis'}
              </button>
              {/* DROP button — only show for approved tokens not yet revealed */}
              {token.status === 'approved' && (
                revealed ? (
                  <span
                    className={styles.actionBtn}
                    style={{ background: 'var(--green)', color: 'var(--bg)', fontWeight: 700, cursor: 'default', opacity: 1 }}
                    title="Art is live publicly"
                  >
                    ● LIVE
                  </span>
                ) : (
                  <button
                    className={`${styles.actionBtn} ${styles.dropBtn}`}
                    onClick={() => {
                      if (confirm(`Drop art for ${token.token_name} publicly? This will reveal the art on the homepage and to wallets.`)) act('reveal');
                    }}
                    disabled={!!loading}
                    title="Release art publicly — homepage + wallets can now see it"
                  >
                    {loading === 'reveal' ? 'dropping...' : '⬡ drop art'}
                  </button>
                )
              )}
              <button
                className={`${styles.actionBtn} ${styles.purgeBtn}`}
                onClick={() => {
                  if (confirm(`Permanently delete ${token.token_name} from the database?`)) act('purge');
                }}
                disabled={!!loading}
                title="Delete this submission entirely — for test cleanup"
              >
                {loading === 'purge' ? 'deleting...' : '✕ purge'}
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => act(dirHidden ? 'show_in_directory' : 'hide_from_directory')}
                disabled={!!loading}
                title={dirHidden ? 'Show in public directory' : 'Hide from public directory (still shows in feed)'}
                style={{
                  border: dirHidden ? '1px solid var(--amber)' : '1px solid var(--border-dim)',
                  color: dirHidden ? 'var(--amber)' : 'var(--text-dim)',
                }}
              >
                {loading === 'hide_from_directory' || loading === 'show_in_directory'
                  ? '...'
                  : dirHidden ? '◎ show dir' : '◯ hide dir'}
              </button>
              {token.status === 'approved' && (
                <button
                  className={styles.actionBtn}
                  onClick={() => act(stamped ? 'decertify_stamp' : 'certify_stamp')}
                  disabled={!!loading}
                  title={stamped ? 'Revoke council stamp of approval' : 'Grant council stamp of approval'}
                  style={{
                    border: stamped ? '1px solid var(--green)' : '1px solid var(--border-dim)',
                    color: stamped ? 'var(--green)' : 'var(--text-dim)',
                  }}
                >
                  {loading === 'certify_stamp' || loading === 'decertify_stamp'
                    ? '...'
                    : stamped ? '⬟ stamped' : '⬟ stamp'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Branded approval message — shown after certify */}
      {approvalResult && (() => {
        const payUrl = approvalResult.payUrl || `https://unatrare.wtf/pay/${token.token_name}`;
        const series = approvalResult.series ?? '—';
        const cardNum = approvalResult.card_number ?? '—';
        const msg = [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '✦  UNATRARE — CERTIFIED DANK  ✦',
          '',
          `${token.token_name} has been evaluated by the`,
          'UNATRARE Pepe Council and certified DANK.',
          '',
          'Your art has earned a place in the directory.',
          '',
          'Complete your enrollment:',
          `→ ${payUrl}`,
          '',
          'Submit the fee to take your official position',
          'in the collection.',
          '',
          `Series ${series} · Card #${cardNum}`,
          '— The UNATRARE Scientist Panel',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n');

        async function copyMsg() {
          try { await navigator.clipboard.writeText(msg); } catch { /* fallback */ }
          setMsgCopied(true);
          setTimeout(() => setMsgCopied(false), 2000);
        }

        return (
          <div style={{
            margin:'0', padding:'16px', background:'rgba(0,255,100,0.04)',
            borderTop:'1px solid var(--green)', borderBottom:'1px solid var(--green)',
          }}>
            <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px',
              color:'var(--green)', marginBottom:10}}>
              ✓ CERTIFIED — COPY THIS MESSAGE AND SEND TO ARTIST
            </div>
            <pre style={{
              fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'1px',
              color:'var(--text-dim)', whiteSpace:'pre-wrap', wordBreak:'break-word',
              lineHeight:1.8, marginBottom:12, background:'var(--bg)',
              padding:'12px', border:'1px solid var(--border)',
            }}>
              {msg}
            </pre>
            <div style={{display:'flex', gap:8}}>
              <button
                onClick={copyMsg}
                style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'2px',
                  padding:'8px 16px', border:'1px solid var(--green)',
                  background: msgCopied ? 'var(--green)' : 'transparent',
                  color: msgCopied ? 'var(--bg)' : 'var(--green)', cursor:'pointer'}}>
                {msgCopied ? 'copied!' : '⎘ copy message'}
              </button>
              <button
                onClick={() => onAction(token.token_name, 'approve')}
                style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'2px',
                  padding:'8px 16px', border:'1px solid var(--border)',
                  background:'transparent', color:'var(--text-dim)', cursor:'pointer'}}>
                dismiss →
              </button>
            </div>
          </div>
        );
      })()}

      {/* Drop announcement — shown after ⬡ drop art */}
      {announceText && (
        <div style={{
          margin:'0', padding:'16px', background:'rgba(0,136,255,0.04)',
          borderTop:'1px solid var(--amber)', borderBottom:'1px solid var(--amber)',
        }}>
          <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px',
            color:'var(--amber)', marginBottom:10}}>
            ⬡ DROP LIVE — COPY THIS TWEET
          </div>
          <pre style={{
            fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'1px',
            color:'var(--text)', whiteSpace:'pre-wrap', wordBreak:'break-word',
            lineHeight:1.9, marginBottom:12, background:'var(--bg)',
            padding:'12px', border:'1px solid var(--border)',
          }}>
            {announceText}
          </pre>
          <div style={{display:'flex', gap:8}}>
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(announceText); } catch {}
                setAnnounceCopied(true);
                setTimeout(() => setAnnounceCopied(false), 2000);
              }}
              style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'2px',
                padding:'8px 16px', border:'1px solid var(--amber)',
                background: announceCopied ? 'var(--amber)' : 'transparent',
                color: announceCopied ? 'var(--bg)' : 'var(--amber)', cursor:'pointer'}}>
              {announceCopied ? 'copied!' : '⎘ copy tweet'}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(announceText)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'2px',
                padding:'8px 16px', border:'1px solid var(--border)',
                background:'transparent', color:'var(--text-dim)',
                textDecoration:'none', display:'flex', alignItems:'center'}}>
              post on X →
            </a>
            <button
              onClick={() => setAnnounceText(null)}
              style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'2px',
                padding:'8px 16px', border:'1px solid var(--border)',
                background:'transparent', color:'var(--text-dim)', cursor:'pointer'}}>
              dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────
function StatsBar({ stats }) {
  return (
    <div className={styles.statsBar}>
      <div className={styles.stat}>
        <div className={styles.statNum}>{stats.pending ?? '—'}</div>
        <div className={styles.statLabel}>PENDING</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statNum} data-color="green">{stats.approved ?? '—'}</div>
        <div className={styles.statLabel}>CERTIFIED</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statNum} data-color="red">{stats.rejected ?? '—'}</div>
        <div className={styles.statLabel}>REJECTED</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statNum} data-color="amber">{stats.borderline ?? '—'}</div>
        <div className={styles.statLabel}>REVIEW QUEUE</div>
      </div>
    </div>
  );
}

// ── Telegram Registrations panel ──────────────────────────────
function TelegramRegistrationsPanel({ authToken }) {
  const [open,  setOpen]  = useState(false);
  const [count, setCount] = useState(null);
  const [rows,  setRows]  = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/community-register/count');
      const j   = await res.json();
      if (j.count !== undefined) setCount(j.count);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function handleExport() {
    const res = await fetch('/api/admin/tg-export', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) { alert('Export failed — check admin token'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `tg-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', color: 'var(--text-dim)' }}
      >
        {open ? '▲' : '▼'} TELEGRAM REGISTRATIONS {count !== null ? `· ${count}` : ''}
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          {loading && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>loading...</div>}
          {!loading && count !== null && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}>
                <strong>{count}</strong> registered for SOFTPWAR · RAREUNATPEPE
              </span>
            </div>
          )}
          <button
            onClick={handleExport}
            style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', padding: '7px 14px', background: 'var(--surface)', color: 'var(--amber)', border: '1px solid var(--amber)', cursor: 'pointer' }}
          >
            export CSV →
          </button>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
            CSV includes: telegram_id, username, cp_address, registered_at, updated_at
          </div>
        </div>
      )}
    </div>
  );
}

// ── Genesis Grants panel ───────────────────────────────────────
function GenesisGrantsPanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [txids, setTxids] = useState({});   // xcp_address → txid input value
  const [sendStatus, setSendStatus] = useState({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/genesis-grants', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (json.ok) setGrants(json.grants);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function markSent(xcpAddress) {
    const txid = (txids[xcpAddress] || '').trim();
    if (!txid) return;
    setSendStatus(s => ({ ...s, [xcpAddress]: 'saving…' }));
    try {
      const res = await fetch('/api/admin/genesis-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ xcp_address: xcpAddress, txid }),
      });
      const json = await res.json();
      if (json.ok) {
        setSendStatus(s => ({ ...s, [xcpAddress]: '✓ marked sent' }));
        load();
      } else {
        setSendStatus(s => ({ ...s, [xcpAddress]: json.error || 'error' }));
      }
    } catch {
      setSendStatus(s => ({ ...s, [xcpAddress]: 'network error' }));
    }
  }

  const pending = grants.filter(g => g.rareunatpepe_claim_submitted_at && !g.rareunatpepe_sent_at);
  const sent    = grants.filter(g => g.rareunatpepe_sent_at);
  const unclaimed = grants.filter(g => !g.rareunatpepe_claim_submitted_at && !g.rareunatpepe_sent_at);

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '12px 16px', background: 'var(--bg-2)',
          border: 'none', borderBottom: open ? '1px solid var(--border)' : 'none',
          color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '10px',
          letterSpacing: '3px', cursor: 'pointer', textAlign: 'left', display: 'flex',
          alignItems: 'center', gap: 8,
        }}
      >
        ⬡ GENESIS GRANTS — RAREUNATPEPE
        {pending.length > 0 && (
          <span style={{ background: 'var(--amber)', color: '#000', borderRadius: 2, padding: '1px 6px', fontSize: '9px', letterSpacing: '1px' }}>
            {pending.length} PENDING
          </span>
        )}
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: 16 }}>
          {loading && <div style={{ fontSize: 11, color: 'var(--muted)' }}>loading…</div>}

          {!loading && grants.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>No confirmed genesis grants yet.</div>
          )}

          {pending.length > 0 && (
            <>
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--amber)', marginBottom: 8 }}>
                PENDING SEND ({pending.length})
              </div>
              {pending.map(g => (
                <div key={g.xcp_address} style={{ border: '1px solid var(--amber)', borderRadius: 3, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text)', marginBottom: 4 }}>
                    Slot #{g.slot_number} · <span style={{ color: 'var(--amber)' }}>SEND TO: {g.rareunatpepe_receive_address || g.xcp_address}</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 8 }}>
                    Claimed {g.rareunatpepe_claim_submitted_at ? new Date(g.rareunatpepe_claim_submitted_at).toISOString().slice(0, 10) : '—'}
                    {' · '}Node btc: {g.btc_address?.slice(0, 14)}…
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 2, padding: '4px 8px', fontFamily: 'monospace', fontSize: 10, color: 'var(--text)' }}
                      placeholder="Paste txid after sending from Freewallet…"
                      value={txids[g.xcp_address] || ''}
                      onChange={e => setTxids(t => ({ ...t, [g.xcp_address]: e.target.value }))}
                    />
                    <button
                      onClick={() => markSent(g.xcp_address)}
                      disabled={!(txids[g.xcp_address] || '').trim()}
                      style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', padding: '5px 10px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 2, cursor: 'pointer' }}
                    >
                      MARK SENT
                    </button>
                  </div>
                  {sendStatus[g.xcp_address] && (
                    <div style={{ fontSize: 9, color: 'var(--green-hot)', marginTop: 4 }}>{sendStatus[g.xcp_address]}</div>
                  )}
                </div>
              ))}
            </>
          )}

          {unclaimed.length > 0 && (
            <>
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--muted)', margin: '12px 0 8px' }}>
                CONFIRMED — NOT YET CLAIMED ({unclaimed.length})
              </div>
              {unclaimed.map(g => (
                <div key={g.xcp_address} style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  Slot #{g.slot_number} · {g.xcp_address || g.btc_address}
                </div>
              ))}
            </>
          )}

          {sent.length > 0 && (
            <>
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--green-hot)', margin: '12px 0 8px' }}>
                SENT ({sent.length})
              </div>
              {sent.map(g => (
                <div key={g.xcp_address} style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace', padding: '3px 0' }}>
                  Slot #{g.slot_number} · {g.rareunatpepe_receive_address || g.xcp_address} · txid: {g.rareunatpepe_txid?.slice(0, 12)}…
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Art Drops management panel ─────────────────────────────────
function DropsPanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [drops, setDrops] = useState([]);
  const [allClaims, setAllClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [windowHours, setWindowHours] = useState('168');
  const [natAddr, setNatAddr] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [bundleInputs, setBundleInputs] = useState({});
  const [bonusInputs, setBonusInputs] = useState({});  // drop.id → { token, qty }
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ token_name: '', title: '', artist_handle: '', description: '', claim_type: 'cultural', supply_total: '', series: '0' });

  async function fetchDrops() {
    setLoading(true);
    const res = await fetch('/api/admin/art-drops', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) { setDrops(json.drops); setAllClaims(json.claims); }
  }

  useEffect(() => { if (open) fetchDrops(); }, [open]);

  async function doAction(body) {
    setActionMsg('');
    const res = await fetch('/api/admin/art-drops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setActionMsg(json.ok ? '✓ done' : `✗ ${json.error || 'error'}`);
    if (json.ok) fetchDrops();
  }

  function exportCsv(dropId, tokenName) {
    const dc = allClaims.filter(c => c.drop_id === dropId);
    const rows = [['claim_id', 'cp_address', 'tap_address', 'claim_type', 'unatpepe_qty', 'status', 'notes', 'claimed_at']];
    for (const c of dc) {
      rows.push([c.id, c.cp_address, c.tap_address, c.claim_type, c.unatpepe_qty || 0, c.status, c.notes || '', c.claimed_at ? new Date(c.claimed_at * 1000).toISOString() : '']);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tokenName}-drop-claims.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const totalPending = drops.reduce((a, d) => a + (d.pending_dist || 0), 0);
  const dBtn = (c = 'var(--amber)') => ({ padding: '4px 12px', border: `1px solid ${c}`, background: 'transparent', color: c, fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', whiteSpace: 'nowrap' });
  const dInput = (w = 80) => ({ padding: '5px 8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '10px', width: w, boxSizing: 'border-box' });

  return (
    <div style={{ margin: '24px 0', border: '1px solid var(--border-dim)', background: 'rgba(168,144,96,0.02)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', color: 'var(--amber)' }}
      >
        <span>◈ ART DROPS {totalPending > 0 ? `(${totalPending} PENDING SEND)` : drops.length > 0 ? `(${drops.length})` : ''}</span>
        <span style={{ color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          {actionMsg && (
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: actionMsg.startsWith('✓') ? 'var(--green)' : '#cc4444', marginBottom: 12 }}>
              {actionMsg}
            </div>
          )}
          {drops.length === 0 && !loading && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)' }}>no drops found</div>
          )}
          {drops.map(drop => {
            const dropClaims = allClaims.filter(c => c.drop_id === drop.id);
            const pendingClaims = dropClaims.filter(c => c.status === 'awaiting_distribution');
            const statusColor = drop.status === 'active' ? 'var(--green)' : drop.status === 'upcoming' ? 'var(--amber)' : 'var(--text-dim)';
            return (
              <div key={drop.id} style={{ marginBottom: 28, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 3, color: 'var(--text)' }}>{drop.token_name}</span>
                  <span style={{ fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, color: statusColor }}>{drop.status.toUpperCase()}</span>
                  {drop.distribution_mode === 'managed' && (
                    <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--amber)', border: '1px solid var(--amber)', padding: '1px 6px' }}>
                      ⬡ ARTIST USING MANAGED DIST — AWAITING SUPPLY
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '1px', color: 'var(--text-dim)' }}>
                    {drop.sent_count || 0} sent · {drop.pending_dist || 0} pending · {drop.pending_payment || 0} awaiting payment · {drop.supply_remaining}/{drop.supply_total} remaining
                  </span>
                </div>
                {drop.status === 'upcoming' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', padding: '10px 0', borderBottom: '1px solid var(--border-dim)' }}>
                    <input type="number" value={windowHours} onChange={e => setWindowHours(e.target.value)} placeholder="hours" style={dInput(70)} min="1" />
                    <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', color: 'var(--text-dim)' }}>hrs open</span>
                    {drop.claim_type === 'support' && (
                      <input type="text" placeholder="NAT payment address (required)" value={natAddr} onChange={e => setNatAddr(e.target.value)} style={dInput(240)} />
                    )}
                    <button
                      onClick={() => doAction({ action: 'activate', drop_id: drop.id, window_hours: Number(windowHours || 168), ...(natAddr ? { nat_address: natAddr } : {}) })}
                      style={dBtn('var(--amber-hot)')}
                    >
                      ▶ ACTIVATE
                    </button>
                  </div>
                )}
                {drop.status === 'active' && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => doAction({ action: 'close', drop_id: drop.id })} style={dBtn()}>■ CLOSE WINDOW</button>
                    {dropClaims.length > 0 && <button onClick={() => exportCsv(drop.id, drop.token_name)} style={dBtn('var(--text-dim)')}>↓ CSV</button>}
                  </div>
                )}
                {drop.status === 'closed' && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => doAction({ action: 'distributed', drop_id: drop.id })} style={dBtn('var(--green)')}>✓ MARK DISTRIBUTED</button>
                    {dropClaims.length > 0 && <button onClick={() => exportCsv(drop.id, drop.token_name)} style={dBtn('var(--text-dim)')}>↓ CSV</button>}
                  </div>
                )}
                {/* Bonus token config row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border-dim)' }}>
                  <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', minWidth: 60 }}>BONUS:</span>
                  {drop.bonus_token ? (
                    <>
                      <span style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: '#a78bfa', fontWeight: 700 }}>{drop.bonus_token}</span>
                      <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', color: drop.bonus_remaining > 0 ? 'var(--green)' : '#ef4444' }}>
                        {drop.bonus_remaining > 0 ? `${drop.bonus_remaining} remaining` : '⚠ SUPPLY = 0 — nobody gets bonus'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', color: 'var(--text-dim)' }}>none set</span>
                  )}
                  <input
                    type="text"
                    placeholder="token (e.g. RAREUNATPEPE)"
                    value={(bonusInputs[drop.id] || {}).token ?? (drop.bonus_token || '')}
                    onChange={e => setBonusInputs(b => ({ ...b, [drop.id]: { ...b[drop.id], token: e.target.value.toUpperCase() } }))}
                    style={dInput(160)}
                  />
                  <input
                    type="number"
                    placeholder="qty"
                    value={(bonusInputs[drop.id] || {}).qty ?? ''}
                    onChange={e => setBonusInputs(b => ({ ...b, [drop.id]: { ...b[drop.id], qty: e.target.value } }))}
                    style={dInput(70)}
                    min="0"
                  />
                  <button
                    onClick={() => {
                      const inp = bonusInputs[drop.id] || {};
                      doAction({ action: 'set_bonus', drop_id: drop.id, bonus_token: inp.token ?? drop.bonus_token ?? '', bonus_remaining: Number(inp.qty ?? 0) });
                      setBonusInputs(b => ({ ...b, [drop.id]: {} }));
                    }}
                    style={dBtn('#a78bfa')}
                  >⬡ set bonus</button>
                </div>

                {/* Bundle config row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border-dim)' }}>
                  {drop.bundle_token ? (
                    <>
                      <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)' }}>BUNDLE:</span>
                      <span style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--amber)', fontWeight: 700 }}>{drop.bundle_token}</span>
                      <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', color: 'var(--text-dim)' }}>{drop.bundle_limit > 0 ? `first ${drop.bundle_limit} claims` : 'all claims'}</span>
                      <button onClick={() => doAction({ action: 'set_bundle', drop_id: drop.id, bundle_token: '', bundle_limit: 0 })} style={{ ...dBtn('var(--text-dim)'), padding: '2px 8px' }}>✕ remove</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)' }}>BUNDLE TOKEN:</span>
                      <input
                        type="text"
                        placeholder="e.g. RAREUNATPEPE"
                        value={(bundleInputs[drop.id] || {}).token || ''}
                        onChange={e => setBundleInputs(prev => ({ ...prev, [drop.id]: { ...prev[drop.id], token: e.target.value.toUpperCase() } }))}
                        style={dInput(160)}
                      />
                      <input
                        type="number"
                        placeholder="limit (0=all)"
                        value={(bundleInputs[drop.id] || {}).limit ?? ''}
                        onChange={e => setBundleInputs(prev => ({ ...prev, [drop.id]: { ...prev[drop.id], limit: e.target.value } }))}
                        style={dInput(80)}
                        min="0"
                      />
                      <button
                        onClick={() => {
                          const inp = bundleInputs[drop.id] || {};
                          if (!inp.token) return;
                          doAction({ action: 'set_bundle', drop_id: drop.id, bundle_token: inp.token, bundle_limit: Number(inp.limit) || 0 });
                          setBundleInputs(prev => ({ ...prev, [drop.id]: {} }));
                        }}
                        style={dBtn('var(--amber)')}
                      >⬡ set bundle</button>
                    </>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', margin: '8px 0 4px' }}>
                  CLAIMS ({dropClaims.length}){pendingClaims.length > 0 && <span style={{ color: 'var(--amber)', marginLeft: 10 }}>⬡ {pendingClaims.length} need sending</span>}
                  {drop.bundle_token && (() => { const sr = [...dropClaims].sort((a,b) => a.claimed_at - b.claimed_at); return dropClaims.some(c => !c.bundle_sent && (drop.bundle_limit === 0 || sr.findIndex(x => x.id === c.id) + 1 <= drop.bundle_limit)); })() && (
                    <span style={{ color: 'var(--amber)', marginLeft: 10 }}>⬡ bundle pending</span>
                  )}
                </div>
                {dropClaims.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)', marginBottom: 8 }}>no claims yet</div>
                )}
                {(() => {
                  const sortedForRank = [...dropClaims].sort((a, b) => a.claimed_at - b.claimed_at);
                  const rankMap = {};
                  sortedForRank.forEach((c, i) => { rankMap[c.id] = i + 1; });
                  return dropClaims.map(c => {
                    const rank = rankMap[c.id];
                    const bundleEligible = drop.bundle_token && (drop.bundle_limit === 0 || rank <= drop.bundle_limit);
                    return (
                      <div key={c.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                        {/* Primary token row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 4px', fontFamily: 'var(--font-card)', fontSize: '9px' }}>
                          <span style={{ color: 'var(--text-dim)', minWidth: 24 }}>#{c.id}</span>
                          <span style={{ flex: 1, wordBreak: 'break-all', letterSpacing: '0.5px' }} title={`TAP: ${c.tap_address}`}>
                            <span style={{ color: 'var(--text-dim)' }}>SEND TO: </span>{c.cp_address}
                          </span>
                          {c.unatpepe_qty > 0 && <span style={{ color: 'var(--green)', letterSpacing: '1px', whiteSpace: 'nowrap' }}>UNAT:{c.unatpepe_qty}</span>}
                          <span style={{ color: c.status === 'sent' ? 'var(--green)' : c.status === 'awaiting_distribution' ? 'var(--amber)' : 'var(--text-dim)', letterSpacing: '1px', minWidth: 80, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {c.status.toUpperCase().replace(/_/g, ' ')}
                          </span>
                          {c.status === 'awaiting_distribution' && (
                            <button onClick={() => doAction({ action: 'mark_sent', claim_id: c.id })} style={dBtn('var(--green)')}>✓ sent</button>
                          )}
                        </div>
                        {/* Bundle token row — only when eligible */}
                        {bundleEligible && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0 6px 24px', fontFamily: 'var(--font-card)', fontSize: '9px' }}>
                            <span style={{ color: 'var(--text-dim)', letterSpacing: '0.5px' }}>↳ ALSO SEND:</span>
                            <span style={{ color: 'var(--amber)', letterSpacing: '2px', fontWeight: 700 }}>{drop.bundle_token} × 1</span>
                            <span style={{ color: 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cp_address}</span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(c.cp_address); }}
                              style={{ ...dBtn('var(--text-dim)'), padding: '2px 8px' }}
                              title="Copy address"
                            >⊕ copy</button>
                            {c.bundle_sent ? (
                              <span style={{ color: 'var(--green)', letterSpacing: '1px', whiteSpace: 'nowrap', minWidth: 80, textAlign: 'right' }}>✓ BUNDLE SENT</span>
                            ) : (
                              <button onClick={() => doAction({ action: 'mark_bundle_sent', claim_id: c.id })} style={{ ...dBtn('#9b8cff'), minWidth: 80 }}>✓ bundle sent</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            );
          })}
          <button onClick={fetchDrops} disabled={loading} style={{ ...dBtn('var(--text-dim)'), marginTop: 8 }}>
            {loading ? '...' : '↻ refresh'}
          </button>

          {/* ── Create new drop form ── */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowCreate(c => !c)}
              style={{ ...dBtn('var(--text-dim)'), marginBottom: showCreate ? 12 : 0 }}
            >+ CREATE NEW DROP</button>
            {showCreate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input style={dInput(140)} placeholder="TOKEN NAME" value={createForm.token_name} onChange={e => setCreateForm(f => ({ ...f, token_name: e.target.value.toUpperCase() }))} />
                  <input style={dInput(180)} placeholder="Title / display name" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} />
                  <input style={dInput(100)} placeholder="artist handle" value={createForm.artist_handle} onChange={e => setCreateForm(f => ({ ...f, artist_handle: e.target.value }))} />
                </div>
                <textarea
                  style={{ ...dInput(500), height: 60, resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: 11 }}
                  placeholder="Description"
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select style={{ ...dInput(120), cursor: 'pointer' }} value={createForm.claim_type} onChange={e => setCreateForm(f => ({ ...f, claim_type: e.target.value }))}>
                    <option value="cultural">cultural (free)</option>
                    <option value="support">support (paid NAT)</option>
                  </select>
                  <input style={dInput(80)} type="number" placeholder="supply" value={createForm.supply_total} onChange={e => setCreateForm(f => ({ ...f, supply_total: e.target.value }))} min="1" />
                  <span style={{ fontFamily: 'var(--font-card)', fontSize: '9px', color: 'var(--text-dim)' }}>series</span>
                  <input style={dInput(50)} type="number" placeholder="0" value={createForm.series} onChange={e => setCreateForm(f => ({ ...f, series: e.target.value }))} min="0" />
                  <button
                    onClick={async () => {
                      if (!createForm.token_name || !createForm.supply_total) { setActionMsg('✗ token_name and supply required'); return; }
                      await doAction({ action: 'create', ...createForm, supply_total: Number(createForm.supply_total), series: Number(createForm.series || 0) });
                      setCreateForm({ token_name: '', title: '', artist_handle: '', description: '', claim_type: 'cultural', supply_total: '', series: '0' });
                      setShowCreate(false);
                    }}
                    style={dBtn('var(--amber-hot)')}
                  >+ CREATE</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Demo card creation panel ───────────────────────────────────
function DemoPanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tokenName: '', artUrl: '', artMime: 'image/png', artistHandle: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { ok, tokenName } | { error }
  const [demos, setDemos] = useState([]);
  const [loadingDemos, setLoadingDemos] = useState(false);

  const MIME_OPTIONS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

  async function fetchDemos() {
    setLoadingDemos(true);
    try {
      const res = await fetch('/api/admin/demo', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      setDemos(json.tokens ?? []);
    } finally {
      setLoadingDemos(false);
    }
  }

  useEffect(() => { if (open) fetchDemos(); }, [open]);

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      setResult(json);
      if (json.ok) {
        setForm({ tokenName: '', artUrl: '', artMime: 'image/png', artistHandle: '', description: '' });
        fetchDemos();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRejudge(tokenName) {
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ tokenName, action: 'rejudge' }),
    });
    const json = await res.json();
    if (json.ok) fetchDemos();
    return json;
  }

  async function handleDelete(tokenName) {
    if (!confirm(`Delete demo card ${tokenName}?`)) return;
    const res = await fetch('/api/admin/demo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ tokenName }),
    });
    const json = await res.json();
    if (json.ok) fetchDemos();
  }

  return (
    <div style={{ margin: '24px 0', border: '1px solid var(--border-dim)', background: 'rgba(255,200,0,0.03)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-card)', fontSize: '10px',
          letterSpacing: '3px', color: 'var(--amber)',
        }}
      >
        <span>◈ DEMO CARDS</span>
        <span style={{ color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
            Demo cards run the full judge pipeline and appear on the feed with a SAMPLE badge.
            They are excluded from the directory, stats, and homepage counts.
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>TOKEN NAME *</div>
                <input
                  value={form.tokenName}
                  onChange={e => setForm(f => ({ ...f, tokenName: e.target.value }))}
                  placeholder="DEMOPEPE"
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '1px' }}
                />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>ARTIST HANDLE</div>
                <input
                  value={form.artistHandle}
                  onChange={e => setForm(f => ({ ...f, artistHandle: e.target.value }))}
                  placeholder="demo_artist"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '1px' }}
                />
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>ART URL *</div>
              <input
                value={form.artUrl}
                onChange={e => setForm(f => ({ ...f, artUrl: e.target.value }))}
                placeholder="https://..."
                required
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '1px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>MIME TYPE</div>
                <select
                  value={form.artMime}
                  onChange={e => setForm(f => ({ ...f, artMime: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '1px' }}
                >
                  {MIME_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>DESCRIPTION</div>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Demo sample card."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '1px' }}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !form.tokenName || !form.artUrl}
              style={{
                padding: '10px 20px', border: '1px solid var(--amber)', background: 'transparent',
                color: 'var(--amber)', fontFamily: 'var(--font-card)', fontSize: '10px',
                letterSpacing: '3px', cursor: 'pointer', alignSelf: 'flex-start',
              }}
            >
              {loading ? 'creating + judging...' : '◈ CREATE DEMO CARD'}
            </button>
          </form>

          {result && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              border: `1px solid ${result.ok ? 'var(--green)' : 'var(--red)'}`,
              fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px',
              color: result.ok ? 'var(--green)' : 'var(--red)',
            }}>
              {result.ok
                ? `✓ ${result.tokenName} created — judging complete`
                : `✗ ${result.error}`}
            </div>
          )}

          {/* Existing demo cards list */}
          {demos.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 10 }}>EXISTING DEMO CARDS</div>
              {demos.map(d => (
                <div key={d.token_name} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                  borderBottom: '1px solid var(--border-dim)',
                }}>
                  {d.art_url && (
                    <img src={d.art_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', border: '1px solid var(--border)' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--amber)' }}>{d.token_name}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)' }}>
                    score: {d.judge_score != null ? d.judge_score.toFixed(1) : <span style={{color:'var(--red)'}}>not judged</span>} · {d.artist_handle || 'no handle'}
                    </div>
                  </div>
                  <a
                    href={`/feed`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', textDecoration: 'none' }}
                  >
                    view →
                  </a>
                  <button
                    onClick={async () => {
                      const json = await handleRejudge(d.token_name);
                      if (!json.ok) alert(json.error || 'rejudge failed');
                    }}
                    style={{
                      padding: '4px 10px', border: '1px solid var(--amber)', background: 'transparent',
                      color: 'var(--amber)', fontFamily: 'var(--font-card)', fontSize: '9px',
                      letterSpacing: '2px', cursor: 'pointer',
                    }}
                  >
                    re-judge
                  </button>
                  <button
                    onClick={() => handleDelete(d.token_name)}
                    style={{
                      padding: '4px 10px', border: '1px solid var(--red)', background: 'transparent',
                      color: 'var(--red)', fontFamily: 'var(--font-card)', fontSize: '9px',
                      letterSpacing: '2px', cursor: 'pointer',
                    }}
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>
          )}
          {!loadingDemos && demos.length === 0 && (
            <div style={{ marginTop: 12, fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)' }}>no demo cards yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Series 0 invite codes panel ────────────────────────────────
function S0CodesPanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState([]);
  const [generated, setGenerated] = useState(null);

  async function fetchCodes() {
    const res = await fetch('/api/admin/series0-codes', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    if (json.ok) setCodes(json.codes);
  }

  useEffect(() => { if (open) fetchCodes(); }, [open]);

  async function handleGenerate() {
    setLoading(true);
    setGenerated(null);
    const res = await fetch('/api/admin/series0-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ note }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      setGenerated(json.code);
      setNote('');
      fetchCodes();
    }
  }

  async function handleRevoke(code) {
    if (!confirm(`Revoke code ${code}? (Cannot revoke used codes)`)) return;
    const res = await fetch('/api/admin/series0-codes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    if (json.ok) fetchCodes();
    else alert(json.error);
  }

  return (
    <div style={{ margin: '24px 0', border: '1px solid var(--border-dim)', background: 'rgba(255,200,0,0.03)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-card)', fontSize: '10px',
          letterSpacing: '3px', color: 'var(--amber)',
        }}
      >
        <span>★ SERIES 0 INVITE CODES</span>
        <span style={{ color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
            Generate a single-use code to give to a Series 0 honorary artist. They enter it in the submit wizard Step 1.
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="note (e.g. 'for SOFTPWAR artist')"
              style={{ flex: 1, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '1px' }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{ padding: '8px 16px', border: '1px solid var(--amber)', background: 'transparent', color: 'var(--amber)', fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer' }}
            >
              {loading ? '...' : '★ generate'}
            </button>
          </div>
          {generated && (
            <div style={{ padding: '10px 14px', border: '1px solid var(--green)', fontFamily: 'var(--font-card)', fontSize: '14px', letterSpacing: '4px', color: 'var(--green)', marginBottom: 16 }}>
              ✓ {generated} — send this to the artist
            </div>
          )}
          {codes.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>ALL CODES</div>
              {codes.map(c => (
                <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-dim)', fontFamily: 'var(--font-card)', fontSize: '10px' }}>
                  <span style={{ letterSpacing: '3px', color: c.used_by ? 'var(--text-dim)' : 'var(--amber)', flex: 0 }}>{c.code}</span>
                  <span style={{ flex: 1, color: 'var(--text-dim)', fontSize: '9px', letterSpacing: '1px' }}>
                    {c.note && `${c.note} · `}{c.used_by ? `used by ${c.used_by}` : 'unused'}
                  </span>
                  {!c.used_by && (
                    <button
                      onClick={() => handleRevoke(c.code)}
                      style={{ padding: '3px 8px', border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '1px', cursor: 'pointer' }}
                    >
                      revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {codes.length === 0 && <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)' }}>no codes generated yet</div>}
        </div>
      )}
    </div>
  );
}

// ── UNATAMOTO claims panel ─────────────────────────────────────
function ClaimsPanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState([]);
  const [total, setTotal] = useState(0);
  const [eligible, setEligible] = useState(0);
  const [loading, setLoading] = useState(false);

  async function fetchClaims() {
    setLoading(true);
    const res = await fetch('/api/admin/claims', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) { setClaims(json.claims); setTotal(json.total); setEligible(json.eligible); }
  }

  useEffect(() => { if (open) fetchClaims(); }, [open]);

  async function markDistributed(address) {
    const res = await fetch('/api/admin/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ address }),
    });
    const json = await res.json();
    if (json.ok) fetchClaims();
  }

  function exportCsv() {
    const rows = [['address','unatpepe','softpwar','eligible','distributed','verified_at']];
    for (const c of claims) {
      const el = c.unatpepe_qty > 0 && c.softpwar_qty > 0;
      rows.push([c.address, c.unatpepe_qty, c.softpwar_qty, el ? 'yes' : 'no', c.distributed ? 'yes' : 'no', new Date(c.verified_at * 1000).toISOString()]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'unatamoto-claims.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ margin: '24px 0', border: '1px solid var(--border-dim)', background: 'rgba(0,255,136,0.02)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-card)', fontSize: '10px',
          letterSpacing: '3px', color: 'var(--green)',
        }}
      >
        <span>⬡ UNATAMOTO CLAIMS {total > 0 ? `(${eligible}/${total} eligible)` : ''}</span>
        <span style={{ color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)' }}>
              Wallets that submitted a claim. Eligible = holds UNATPEPE + SOFTPWAR.
            </div>
            {claims.length > 0 && (
              <button
                onClick={exportCsv}
                style={{ padding: '6px 14px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                ↓ csv
              </button>
            )}
            <button
              onClick={fetchClaims}
              disabled={loading}
              style={{ padding: '6px 14px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer' }}
            >
              {loading ? '...' : '↻'}
            </button>
          </div>
          {claims.length === 0 && !loading && <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-dim)' }}>no claims yet</div>}
          {claims.map(c => {
            const el = c.unatpepe_qty > 0 && c.softpwar_qty > 0;
            return (
              <div key={c.address} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-dim)', fontFamily: 'var(--font-card)', fontSize: '10px' }}>
                <span style={{ flex: 1, color: el ? 'var(--text)' : 'var(--text-dim)', wordBreak: 'break-all' }}>{c.address}</span>
                <span style={{ color: c.unatpepe_qty > 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '1px' }}>UNATPEPE:{c.unatpepe_qty}</span>
                <span style={{ color: c.softpwar_qty > 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '1px' }}>SOFTPWAR:{c.softpwar_qty}</span>
                {c.distributed ? (
                  <span style={{ color: 'var(--green)', letterSpacing: '1px' }}>✓ sent</span>
                ) : el ? (
                  <button
                    onClick={() => markDistributed(c.address)}
                    style={{ padding: '3px 10px', border: '1px solid var(--green)', background: 'transparent', color: 'var(--green)', fontFamily: 'var(--font-card)', fontSize: '9px', cursor: 'pointer' }}
                  >
                    mark sent
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-dim)', letterSpacing: '1px' }}>ineligible</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Archive scraper panel ───────────────────────────────────────
function ArchivePanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [collection, setCollection] = useState('rarepepe');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [scrapeStatus, setScrapeStatus] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);

  async function fetchStats() {
    setLoading(true);
    const res = await fetch(`/api/archive/status?collection=${collection}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) setStats(json);
  }

  useEffect(() => { if (open) fetchStats(); }, [open, collection]);

  async function doImport() {
    const names = importText.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!names.length) return;
    setImportStatus('importing...');
    const res = await fetch('/api/archive/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ action: 'import', collection, asset_names: names }),
    });
    const json = await res.json();
    if (json.ok) {
      setImportStatus(`✓ ${json.inserted} new / ${json.total} total`);
      setImportText('');
      fetchStats();
    } else {
      setImportStatus(`✗ ${json.error}`);
    }
  }

  async function doScrape(batchSize = 20) {
    setScraping(true);
    setScrapeStatus('scraping...');
    const res = await fetch('/api/archive/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ action: 'scrape', collection, batch_size: batchSize }),
    });
    const json = await res.json();
    setScraping(false);
    if (json.ok) {
      setScrapeStatus(`✓ ${json.succeeded}/${json.processed} ok — ${json.remaining} remaining`);
      fetchStats();
    } else {
      setScrapeStatus(`✗ ${json.error}`);
    }
  }

  async function doResetFailed() {
    const res = await fetch('/api/archive/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ action: 'reset_failed', collection }),
    });
    const json = await res.json();
    if (json.ok) {
      setScrapeStatus(`↻ reset ${json.reset} failed → pending`);
      fetchStats();
    }
  }

  const btnStyle = {
    padding: '7px 16px', border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-dim)', fontFamily: 'var(--font-card)', fontSize: '10px',
    letterSpacing: '2px', cursor: 'pointer', transition: 'border-color 0.15s',
  };
  const btnGreen = { ...btnStyle, border: '1px solid var(--green)', color: 'var(--green)' };

  return (
    <div style={{ margin: '24px 0', border: '1px solid var(--border-dim)', background: 'rgba(0,255,136,0.02)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-card)', fontSize: '10px',
          letterSpacing: '3px', color: 'var(--green)',
        }}
      >
        <span>⬡ ARCHIVE SCRAPER {stats ? `(${stats.stats?.fetched ?? 0} fetched / ${stats.stats?.total ?? 0} total)` : ''}</span>
        <span style={{ color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Collection selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <label style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--text-dim)' }}>COLLECTION</label>
            <select
              value={collection}
              onChange={e => setCollection(e.target.value)}
              style={{ fontFamily: 'var(--font-card)', fontSize: '11px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', padding: '4px 8px' }}
            >
              <option value="rarepepe">Rare Pepe (S1–38)</option>
            </select>
            <button onClick={fetchStats} disabled={loading} style={btnStyle}>{loading ? '...' : '↻ refresh'}</button>
          </div>

          {/* Stats bar */}
          {stats?.stats && (
            <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '2px' }}>
              <span style={{ color: 'var(--text-dim)' }}>PENDING <span style={{ color: 'var(--amber)' }}>{stats.stats.pending}</span></span>
              <span style={{ color: 'var(--text-dim)' }}>FETCHED <span style={{ color: 'var(--green)' }}>{stats.stats.fetched}</span></span>
              <span style={{ color: 'var(--text-dim)' }}>FAILED <span style={{ color: 'var(--red)' }}>{stats.stats.failed}</span></span>
              <span style={{ color: 'var(--text-dim)' }}>SKIPPED <span style={{ color: 'var(--text)' }}>{stats.stats.skipped}</span></span>
              <span style={{ color: 'var(--text-dim)' }}>TOTAL <span style={{ color: 'var(--text)' }}>{stats.stats.total}</span></span>
            </div>
          )}

          {/* Progress bar */}
          {stats?.stats && stats.stats.total > 0 && (
            <div style={{ height: 4, background: 'var(--border-dim)', marginBottom: 20, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--green)', width: `${Math.round((stats.stats.fetched / stats.stats.total) * 100)}%`, transition: 'width 0.3s' }} />
            </div>
          )}

          {/* Bulk import */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6 }}>BULK IMPORT ASSET NAMES</div>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={'RAREPEPE\nSTACKRARE\nNAKAMOTOCARD\n...'}
              style={{
                width: '100%', height: 100, background: 'var(--surface)', color: 'var(--text)',
                border: '1px solid var(--border)', fontFamily: 'var(--font-card)', fontSize: '11px',
                padding: '8px', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <button onClick={doImport} style={btnGreen}>↑ import</button>
              {importStatus && <span style={{ fontFamily: 'var(--font-card)', fontSize: '10px', color: importStatus.startsWith('✓') ? 'var(--green)' : 'var(--red)', letterSpacing: '2px' }}>{importStatus}</span>}
            </div>
          </div>

          {/* Scrape controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => doScrape(20)} disabled={scraping} style={btnGreen}>{scraping ? 'scraping...' : '▶ scrape batch (20)'}</button>
            <button onClick={() => doScrape(50)} disabled={scraping} style={btnStyle}>▶ batch (50)</button>
            <button onClick={doResetFailed} disabled={scraping} style={btnStyle}>↻ reset failed</button>
            {scrapeStatus && <span style={{ fontFamily: 'var(--font-card)', fontSize: '10px', color: scrapeStatus.startsWith('✓') ? 'var(--green)' : scrapeStatus.startsWith('↻') ? 'var(--amber)' : 'var(--red)', letterSpacing: '2px' }}>{scrapeStatus}</span>}
          </div>

          {/* Recently scraped */}
          {stats?.recent?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>RECENTLY SCRAPED</div>
              {stats.recent.map(a => (
                <div key={a.asset_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border-dim)', fontFamily: 'var(--font-card)', fontSize: '10px' }}>
                  <span style={{ color: 'var(--green)', width: 12 }}>✓</span>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{a.asset_name}</span>
                  {a.image_url_type && <span style={{ color: 'var(--text-dim)', letterSpacing: '1px' }}>{a.image_url_type}</span>}
                  <a href={`/c/${a.asset_name}.json`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-dim)', fontSize: '9px' }}>json ↗</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Artist profile panel ────────────────────────────────────────
function ArtistProfilePanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedIndex, setSavedIndex] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    alias: '',
    anonymous: false,
    pfp_url: '',
    bio: '',
    website: '',
    twitter_handle: '',
    past_projects: '',
    cp_collections: '',
  });

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleLookup(e) {
    e.preventDefault();
    if (!address.trim()) return;
    setFetching(true);
    setMsg(null);
    setSavedIndex(null);
    try {
      const res = await fetch(`/api/admin/artists?address=${encodeURIComponent(address.trim())}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ err: true, text: json.error || 'Lookup failed' }); return; }
      const p = json.profile || {};
      setForm({
        alias: p.alias || '',
        anonymous: !!p.anonymous,
        pfp_url: p.pfp_url || '',
        bio: p.bio || '',
        website: p.website || '',
        twitter_handle: p.twitter_handle || '',
        past_projects: p.past_projects || '',
        cp_collections: p.cp_collections && p.cp_collections !== '[]'
          ? (typeof p.cp_collections === 'string' ? p.cp_collections : JSON.stringify(p.cp_collections, null, 2))
          : '',
      });
      if (p.archive_index != null) setSavedIndex(p.archive_index);
      setMsg({ err: false, text: p.alias ? `Loaded: ${p.alias}` : (json.handle_fallback ? `No profile yet — handle: @${json.handle_fallback}` : 'No profile yet') });
    } finally {
      setFetching(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      let cp = form.cp_collections.trim();
      if (cp) {
        try { JSON.parse(cp); } catch (_) {
          // try to coerce newline-delimited list into JSON array
          cp = JSON.stringify(cp.split('\n').map(s => s.trim()).filter(Boolean));
        }
      }
      const body = {
        btc_address: address.trim(),
        alias: form.alias || null,
        anonymous: form.anonymous ? 1 : 0,
        pfp_url: form.pfp_url || null,
        bio: form.bio || null,
        website: form.website || null,
        twitter_handle: form.twitter_handle || null,
        past_projects: form.past_projects || null,
        cp_collections: cp || '[]',
      };
      const res = await fetch('/api/admin/artists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ err: true, text: json.error || 'Save failed' }); return; }
      setSavedIndex(json.archive_index);
      setMsg({ err: false, text: `Saved — Archive Entry #${String(json.archive_index).padStart(3,'0')}` });
    } finally {
      setSaving(false);
    }
  }

  const panelStyle = { border: '1px solid var(--border)', borderRadius: 4, marginBottom: 24, overflow: 'hidden' };
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', userSelect: 'none', background: 'var(--surface)' };
  const bodyStyle = { padding: '16px', borderTop: '1px solid var(--border-dim)' };
  const inputStyle = { width: '100%', background: '#111', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', fontSize: 14, borderRadius: 3, boxSizing: 'border-box', fontFamily: 'var(--font-body)', marginBottom: 10 };
  const labelStyle = { display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' };
  const btnStyle = { background: 'var(--amber)', color: '#080808', border: 'none', padding: '8px 18px', fontSize: 13, fontFamily: 'var(--font-card)', letterSpacing: '0.08em', cursor: 'pointer', borderRadius: 3 };

  return (
    <div style={panelStyle}>
      <div style={headerStyle} onClick={() => setOpen(o => !o)}>
        <span style={{ fontFamily: 'var(--font-card)', fontSize: 13, letterSpacing: '0.1em' }}>ARTIST PROFILES</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={bodyStyle}>
          <form onSubmit={handleLookup} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              placeholder="BTC address"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
            <button type="submit" style={{ ...btnStyle, whiteSpace: 'nowrap' }} disabled={fetching}>
              {fetching ? 'Loading…' : 'Load'}
            </button>
          </form>

          {msg && (
            <p style={{ fontSize: 13, color: msg.err ? '#e05555' : '#5a9', marginBottom: 12 }}>{msg.text}</p>
          )}

          {savedIndex != null && address && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              Archive Entry{' '}
              <strong style={{ color: 'var(--amber)' }}>#{String(savedIndex).padStart(3,'0')}</strong>
              {' — '}
              <a href={`/artist/${address.trim()}`} target="_blank" rel="noreferrer"
                style={{ color: 'var(--amber)', textDecoration: 'none' }}>
                /artist/{address.trim().slice(0,8)}…{address.trim().slice(-6)} ↗
              </a>
            </p>
          )}

          <form onSubmit={handleSave}>
            <label style={labelStyle}>Alias</label>
            <input style={inputStyle} value={form.alias} onChange={e => setField('alias', e.target.value)} placeholder="Display name / alias" />

            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
              <input type="checkbox" checked={form.anonymous} onChange={e => setField('anonymous', e.target.checked)} />
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Anonymous (hide identity)</span>
            </label>

            <label style={{ ...labelStyle, marginTop: 10 }}>PFP URL</label>
            <input style={inputStyle} value={form.pfp_url} onChange={e => setField('pfp_url', e.target.value)} placeholder="https://…" />

            <label style={labelStyle}>Bio / Statement</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.bio} onChange={e => setField('bio', e.target.value)} placeholder="Short artist statement…" />

            <label style={labelStyle}>Website</label>
            <input style={inputStyle} value={form.website} onChange={e => setField('website', e.target.value)} placeholder="https://…" />

            <label style={labelStyle}>X / Twitter handle</label>
            <input style={inputStyle} value={form.twitter_handle} onChange={e => setField('twitter_handle', e.target.value)} placeholder="username (without @)" />

            <label style={labelStyle}>Past projects (one per line)</label>
            <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.past_projects} onChange={e => setField('past_projects', e.target.value)} placeholder="Project name — year&#10;…" />

            <label style={labelStyle}>CP Collections (JSON array or one per line)</label>
            <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} value={form.cp_collections} onChange={e => setField('cp_collections', e.target.value)} placeholder={'["COLLECTIONNAME"]\nor one name per line'} />

            <button type="submit" style={btnStyle} disabled={saving || !address.trim()}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Main admin dashboard ───────────────────────────────────────
export default function AdminPage() {
  const [authToken, setAuthToken] = useState(null);
  const [tab, setTab] = useState('pending'); // 'pending' | 'borderline' | 'approved' | 'rejected'
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [judgeAllLoading, setJudgeAllLoading] = useState(false);
  const [earlyAccess, setEarlyAccess] = useState(false);
  const [eaToggling, setEaToggling] = useState(false);
  const [burnRequired, setBurnRequired] = useState(false);
  const [burnToggling, setBurnToggling] = useState(false);
  const [genDropsLoading, setGenDropsLoading] = useState(false);
  const [genDropsStatus, setGenDropsStatus] = useState(null);
  const [fullCouncilLoading, setFullCouncilLoading] = useState(false);

  // Try to restore session token from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('unatrare_admin_token');
    if (saved) setAuthToken(saved);
  }, []);

  function handleAuth(token) {
    sessionStorage.setItem('unatrare_admin_token', token);
    setAuthToken(token);
  }

  function handleLogout() {
    sessionStorage.removeItem('unatrare_admin_token');
    setAuthToken(null);
  }

  const fetchData = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const [tokenRes, statsRes, settingsRes] = await Promise.all([
        fetch(`/api/admin/tokens?status=${tab}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);
      if (tokenRes.status === 401 || statsRes.status === 401) {
        handleLogout();
        return;
      }
      const tokenData = await tokenRes.json();
      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();
      setTokens(tokenData.tokens ?? []);
      setStats(statsData);
      if (settingsData.ok) {
        setEarlyAccess(settingsData.settings?.early_access_mode === '1');
        setBurnRequired(settingsData.settings?.burn_required === '1');
      }
    } finally {
      setLoading(false);
    }
  }, [authToken, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleAction(tokenName, action) {
    // Remove from current list immediately for snappy UX
    setTokens(prev => prev.filter(t => t.token_name !== tokenName));
    // Update stat counts optimistically
    setStats(prev => {
      const next = { ...prev };
      if (tab === 'pending')    next.pending    = Math.max(0, (next.pending    ?? 0) - 1);
      if (tab === 'borderline') next.borderline = Math.max(0, (next.borderline ?? 0) - 1);
      if (action === 'approve') next.approved = (next.approved ?? 0) + 1;
      if (action === 'reject')  next.rejected = (next.rejected ?? 0) + 1;
      return next;
    });
  }

  async function handleJudgeAll() {
    setJudgeAllLoading(true);
    try {
      await fetch('/api/admin/judge-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      await fetchData();
    } finally {
      setJudgeAllLoading(false);
    }
  }

  async function handleGenerateDrops() {
    setGenDropsLoading(true);
    setGenDropsStatus(null);
    try {
      const res = await fetch('/api/admin/generate-drops', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.ok) {
        setGenDropsStatus(`⬡ ${data.total_drops} drops generated (${data.judges_generated}/8 judges)`);
      } else {
        setGenDropsStatus(`error: ${data.error}`);
      }
    } catch (err) {
      setGenDropsStatus(`error: ${err.message}`);
    } finally {
      setGenDropsLoading(false);
    }
  }

  async function handleFullCouncil() {
    setFullCouncilLoading(true);
    setGenDropsStatus(null);
    try {
      const res = await fetch('/api/admin/generate-drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ force_all: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setGenDropsStatus(`⬡ FULL COUNCIL: ${data.total_drops} drops (${data.judges_generated}/8 judges)`);
      } else {
        setGenDropsStatus(`error: ${data.error}`);
      }
    } catch (err) {
      setGenDropsStatus(`error: ${err.message}`);
    } finally {
      setFullCouncilLoading(false);
    }
  }

  async function toggleEarlyAccess() {
    setEaToggling(true);
    const newVal = earlyAccess ? '0' : '1';
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ key: 'early_access_mode', value: newVal }),
      });
      const json = await res.json();
      if (json.ok) setEarlyAccess(newVal === '1');
    } finally {
      setEaToggling(false);
    }
  }

  async function toggleBurnRequired() {
    setBurnToggling(true);
    const newVal = burnRequired ? '0' : '1';
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ key: 'burn_required', value: newVal }),
      });
      const json = await res.json();
      if (json.ok) setBurnRequired(newVal === '1');
    } finally {
      setBurnToggling(false);
    }
  }

  if (!authToken) return <LoginGate onAuth={handleAuth} />;

  const TABS = [
    { key: 'pending',    label: 'Pending' },
    { key: 'borderline', label: 'Review Queue' },
    { key: 'approved',   label: 'Certified' },
    { key: 'rejected',   label: 'Rejected' },
    { key: 'tools',      label: '⚙ Tools' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {/* Row 1 — logo + quick actions */}
        <div className={styles.headerTop}>
          <div className={styles.headerLogo}>UNATR<span>A</span>RE <span className={styles.headerSub}>ADMIN</span></div>
          <div className={styles.headerRight}>
            {genDropsStatus && (
              <span style={{ fontSize: '9px', letterSpacing: '1px', color: genDropsStatus.startsWith('error') ? 'var(--red)' : 'var(--green-hot)', fontFamily: 'var(--font-card)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                {genDropsStatus}
              </span>
            )}
            <button className={styles.refreshBtn} onClick={fetchData} disabled={loading} title="Refresh">
              {loading ? '···' : '↻'}
            </button>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              out
            </button>
          </div>
        </div>
        {/* Row 2 — scrollable tool buttons */}
        <div className={styles.headerActions}>
          <button
            className={styles.judgeAllBtn}
            onClick={handleJudgeAll}
            disabled={judgeAllLoading}
            title="Run judge pipeline on all pending submissions"
          >
            {judgeAllLoading ? 'judging…' : '⚡ judge all'}
          </button>
          <button
            className={styles.judgeAllBtn}
            onClick={toggleEarlyAccess}
            disabled={eaToggling}
            style={{
              background: earlyAccess ? 'var(--amber)' : 'transparent',
              color: earlyAccess ? 'var(--bg)' : 'var(--amber)',
              border: '1px solid var(--amber)',
            }}
            title="Toggle holder-only early access gate"
          >
            {eaToggling ? '…' : earlyAccess ? '⚡ holders only: ON' : '⚡ holders only: OFF'}
          </button>
          <button
            className={styles.judgeAllBtn}
            onClick={toggleBurnRequired}
            disabled={burnToggling}
            style={{
              background: burnRequired ? 'var(--amber)' : 'transparent',
              color: burnRequired ? 'var(--bg)' : 'var(--amber)',
              border: '1px solid var(--amber)',
            }}
            title="Toggle SOFTPWAR burn gate for submissions"
          >
            {burnToggling ? '…' : burnRequired ? '🔥 burn gate: ON' : '🔥 burn gate: OFF'}
          </button>
          <button
            className={styles.judgeAllBtn}
            onClick={handleGenerateDrops}
            disabled={genDropsLoading || fullCouncilLoading}
            title="Generate LLM council drops for the feed"
          >
            {genDropsLoading ? 'generating…' : '⬡ gen drops'}
          </button>
          <button
            className={styles.judgeAllBtn}
            onClick={handleFullCouncil}
            disabled={genDropsLoading || fullCouncilLoading}
            style={{ background: 'transparent', color: 'var(--amber)', border: '1px solid var(--amber)' }}
            title="Fire all 8 judges at once — full council"
          >
            {fullCouncilLoading ? 'summoning…' : '⬡ full council'}
          </button>
        </div>
      </header>

      <StatsBar stats={stats} />

      {/* ── NEEDS DROP alert — prominent, impossible to miss ── */}
      {stats.unrevealed > 0 && (
        <div
          onClick={() => setTab('approved')}
          style={{
            margin: '0 0 0 0', padding: '14px 20px',
            background: 'rgba(255, 136, 0, 0.12)',
            border: '2px solid var(--amber)',
            borderLeft: 'none', borderRight: 'none',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '20px', lineHeight: 1 }}>⬡</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-card)', fontSize: '11px',
              letterSpacing: '3px', color: 'var(--amber)',
            }}>
              {stats.unrevealed} TOKEN{stats.unrevealed > 1 ? 'S' : ''} CERTIFIED BUT NOT DROPPED
            </div>
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '11px',
              color: 'var(--text-dim)', marginTop: 2,
            }}>
              Wallets are showing &ldquo;pending&rdquo; for these — go to Certified tab and click ⬡ drop art
            </div>
          </div>
          <span style={{
            fontFamily: 'var(--font-card)', fontSize: '10px',
            letterSpacing: '2px', color: 'var(--amber)',
          }}>view →</span>
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'pending' && stats.pending > 0 && (
              <span className={styles.tabBadge}>{stats.pending}</span>
            )}
            {t.key === 'borderline' && stats.borderline > 0 && (
              <span className={styles.tabBadge} data-urgent="true">{stats.borderline}</span>
            )}
            {t.key === 'approved' && stats.unrevealed > 0 && (
              <span className={styles.tabBadge} data-urgent="true" title="Certified but not dropped">{stats.unrevealed} ⬡</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.queue}>
        {tab === 'tools' ? (
          <>
            <TelegramRegistrationsPanel authToken={authToken} />
            <GenesisGrantsPanel authToken={authToken} />
            <DropsPanel authToken={authToken} />
            <DemoPanel authToken={authToken} />
            <S0CodesPanel authToken={authToken} />
            <ClaimsPanel authToken={authToken} />
            <ArchivePanel authToken={authToken} />
            <ArtistProfilePanel authToken={authToken} />
          </>
        ) : (
          <>
            {loading && <div className={styles.loading}>loading...</div>}
            {!loading && tokens.length === 0 && (
              <div className={styles.empty}>no {tab} submissions</div>
            )}
            {!loading && tokens.map(token => (
              <TokenRow
                key={token.token_name}
                token={token}
                authToken={authToken}
                onAction={handleAction}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
