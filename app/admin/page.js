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
            {token.artist_address?.slice(0, 14)}… · {submittedAt}
            {token.payment_currency && ` · paid ${token.payment_currency}`}
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
                    style={{ background: '#00ff87', color: '#000', fontWeight: 700, cursor: 'default', opacity: 1 }}
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
          'UNATRARE pepai scientist panel and certified DANK.',
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
  const [genDropsLoading, setGenDropsLoading] = useState(false);
  const [genDropsStatus, setGenDropsStatus] = useState(null);

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
      if (settingsData.ok) setEarlyAccess(settingsData.settings?.early_access_mode === '1');
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
        setGenDropsStatus(`⬡ ${data.total_drops} drops generated (${data.judges_generated}/5 judges)`);
      } else {
        setGenDropsStatus(`error: ${data.error}`);
      }
    } catch (err) {
      setGenDropsStatus(`error: ${err.message}`);
    } finally {
      setGenDropsLoading(false);
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

  if (!authToken) return <LoginGate onAuth={handleAuth} />;

  const TABS = [
    { key: 'pending',   label: 'Pending' },
    { key: 'borderline', label: 'Review Queue' },
    { key: 'approved',  label: 'Certified' },
    { key: 'rejected',  label: 'Rejected' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLogo}>UNATR<span>A</span>RE <span className={styles.headerSub}>ADMIN</span></div>
        <div className={styles.headerActions}>
          {genDropsStatus && (
            <span style={{ fontSize: '10px', letterSpacing: '1px', color: genDropsStatus.startsWith('error') ? 'var(--red)' : 'var(--green-hot)', fontFamily: 'var(--font-card)' }}>
              {genDropsStatus}
            </span>
          )}
          <button
            className={styles.judgeAllBtn}
            onClick={handleGenerateDrops}
            disabled={genDropsLoading}
            title="Generate LLM council drops for the feed"
          >
            {genDropsLoading ? 'generating...' : '⬡ gen drops'}
          </button>
          <button
            className={styles.judgeAllBtn}
            onClick={toggleEarlyAccess}
            disabled={eaToggling}
            style={{
              background: earlyAccess ? 'var(--amber)' : 'var(--surface)',
              color: earlyAccess ? 'var(--bg)' : 'var(--amber)',
              border: '1px solid var(--amber)',
            }}
          >
            {eaToggling ? '...' : earlyAccess ? '⚡ HOLDER-ONLY: ON' : '⚡ HOLDER-ONLY: OFF'}
          </button>
          <button
            className={styles.judgeAllBtn}
            onClick={handleJudgeAll}
            disabled={judgeAllLoading}
          >
            {judgeAllLoading ? 'judging...' : '⚡ judge all pending'}
          </button>
          <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
            {loading ? '...' : '↻ refresh'}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            logout
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
      </div>

      <DemoPanel authToken={authToken} />
      <S0CodesPanel authToken={authToken} />
      <ClaimsPanel authToken={authToken} />
    </div>
  );
}
