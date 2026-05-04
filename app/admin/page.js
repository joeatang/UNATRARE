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
  const [expanded, setExpanded] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null); // set after approve/genesis
  const [msgCopied, setMsgCopied] = useState(false);
  const [revealed, setRevealed] = useState(!!token.revealed_at); // tracks drop state

  async function act(action) {
    setLoading(action);
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ tokenName: token.token_name, action, note }),
    });
    const json = await res.json();
    setLoading(null);
    if (json.ok) {
      if (action === 'approve' || action === 'genesis') {
        setApprovalResult(json); // show branded message before dismissing
      } else if (action === 'reveal') {
        setRevealed(true); // update in place — token stays in Certified tab
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
        <div className={styles.rowArt}>
          {token.art_url ? (
            <img src={token.art_url} alt={token.token_name} className={styles.rowThumb} />
          ) : (
            <div className={styles.rowThumbEmpty} />
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
              judge score: <strong>{token.judge_score?.toFixed(1)}</strong>/37.5
            </div>
          )}
          {approvalResult && (
            <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px',
              color:'var(--green)', marginTop:4}}>
              ✓ CERTIFIED — send payment link to artist
            </div>
          )}
        </div>
        <div className={styles.rowToggle}>{approvalResult ? '✉' : expanded ? '▲' : '▼'}</div>
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
                            {Object.values(j.scores || {}).reduce((a,b) => a+b, 0)}/40
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
                title="Certify as SERIES 0 — founding collection, no pepai judgment"
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

// ── Main admin dashboard ───────────────────────────────────────
export default function AdminPage() {
  const [authToken, setAuthToken] = useState(null);
  const [tab, setTab] = useState('pending'); // 'pending' | 'borderline' | 'approved' | 'rejected'
  const [tokens, setTokens] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [judgeAllLoading, setJudgeAllLoading] = useState(false);

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
      const [tokenRes, statsRes] = await Promise.all([
        fetch(`/api/admin/tokens?status=${tab}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);
      if (tokenRes.status === 401 || statsRes.status === 401) {
        handleLogout();
        return;
      }
      const tokenData = await tokenRes.json();
      const statsData = await statsRes.json();
      setTokens(tokenData.tokens ?? []);
      setStats(statsData);
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
    </div>
  );
}
