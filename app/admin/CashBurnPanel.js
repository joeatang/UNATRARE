'use client';
// Cash Burn Ceremony — admin control panel.
// Mounted inside <Tools> on /admin. Self-contained: own data fetching, form
// state, sprite picker, live preview, open / close / repost / archive flow.
//
// Mobile-first: form stacks single column ≤720px, expands to 2-col on tablet+.
// Sprite picker: 4 cols mobile → 10 cols desktop. Preview image is full-width.

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './admin.module.css';

const TIERS = [
  { key: 'cataclysm', label: 'CATACLYSM',  min: 1_000_000_000 },
  { key: 'legendary', label: 'LEGENDARY',  min:   100_000_000 },
  { key: 'inferno',   label: 'INFERNO',    min:    10_000_000 },
  { key: 'bonfire',   label: 'BONFIRE',    min:     1_000_000 },
  { key: 'flame',     label: 'FLAME',      min:       100_000 },
  { key: 'torch',     label: 'TORCH',      min:        10_000 },
  { key: 'ember',     label: 'EMBER',      min:             1 },
];

function tierFor(amount) {
  const n = Number(amount || 0);
  return TIERS.find(t => n >= t.min) || TIERS[TIERS.length - 1];
}

function fmtCompact(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  if (x >= 1e9) return (x / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (x >= 1e6) return (x / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K';
  return Math.round(x).toLocaleString('en-US');
}

function fmtFull(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return '0';
  return Math.round(x).toLocaleString('en-US');
}

// Inline style helpers — match patterns used elsewhere in admin/page.js
const label = {
  fontFamily:    'var(--font-card)',
  fontSize:      10,
  letterSpacing: '2px',
  color:         'var(--text-dim)',
  textTransform: 'uppercase',
  display:       'block',
  marginBottom:  4,
};
const input = {
  fontFamily:    'var(--font-card)',
  fontSize:      14,
  letterSpacing: '1px',
  background:    'var(--bg)',
  border:        '1px solid var(--border)',
  borderRadius:  4,
  color:         'var(--text)',
  padding:       '10px 12px',
  width:         '100%',
  boxSizing:     'border-box',
  outline:       'none',
};
function btn(color = 'var(--green)', { disabled } = {}) {
  return {
    fontFamily:    'var(--font-card)',
    fontSize:      11,
    letterSpacing: '2px',
    background:    'var(--bg)',
    color:         disabled ? 'var(--text-dim)' : color,
    border:        `1px solid ${disabled ? 'var(--border-dim)' : color}`,
    padding:       '9px 14px',
    cursor:        disabled ? 'default' : 'pointer',
    textTransform: 'uppercase',
  };
}

export default function CashBurnPanel({ authToken }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [active, setActive] = useState(null);
  const [list, setList] = useState([]);
  const [characters, setCharacters] = useState([]);

  const [form, setForm] = useState({
    character_key: '',
    amount:        '',
    card_name:     '',
    headline:      '',
    quote:         '',
  });
  const [previewUrl, setPreviewUrl] = useState('');
  const previewBlobRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cash-burn?limit=20', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json.error || 'failed to load');
        return;
      }
      setList(json.burns || []);
      setActive(json.active || null);
      setCharacters(json.characters || []);
      // Default sprite to first suggested for current tier (or 'classic')
      setForm(f => ({
        ...f,
        character_key: f.character_key || (json.characters?.[0]?.key || 'classic'),
      }));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (open && characters.length === 0) refresh();
  }, [open, characters.length, refresh]);

  // Free old blob URL when preview changes
  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  const tier = tierFor(form.amount);
  const suggestedSet = new Set(
    characters.filter(c => Array.isArray(c.suggested_tiers) && c.suggested_tiers.includes(tier.key)).map(c => c.key)
  );

  async function doPreview() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/cash-burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          action:        'preview',
          character_key: form.character_key,
          amount:        form.amount,
          card_name:     form.card_name,
          headline:      form.headline,
          quote:         form.quote,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 200));
      }
      const blob = await res.blob();
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      const url = URL.createObjectURL(blob);
      previewBlobRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      setMsg('preview failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function postAction(action, extra = {}) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/cash-burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json.error || `${action} failed`);
        return null;
      }
      setMsg(action === 'open'  ? '🔥 ceremony opened — Telegram fired'
            : action === 'close' ? '🏁 ceremony closed — Telegram fired'
            : action === 'repost' ? '↻ reposted to Telegram'
            : action === 'archive' ? '📦 archived'
            : 'ok');
      await refresh();
      return json.burn;
    } catch (e) {
      setMsg(`${action} error: ${e.message}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function doOpen() {
    if (!form.character_key) { setMsg('pick a character'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setMsg('enter an amount'); return; }
    if (active) { setMsg('close the active ceremony before opening a new one'); return; }
    const burn = await postAction('open', form);
    if (burn) {
      setForm({ character_key: form.character_key, amount: '', card_name: '', headline: '', quote: '' });
      setPreviewUrl('');
    }
  }

  async function doClose(id) {
    if (!confirm('Close this ceremony? It will post a closing announcement to Telegram.')) return;
    await postAction('close', { id });
  }

  async function doRepost(id) {
    if (!confirm('Re-post to Telegram?')) return;
    await postAction('repost', { id });
  }

  async function doArchive(id) {
    if (!confirm('Archive this ceremony? (hides from public list)')) return;
    await postAction('archive', { id });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
           onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-card)', fontSize: 13, letterSpacing: '3px', color: 'var(--amber-hot)', textTransform: 'uppercase' }}>
            🔥 Cash Burn Ceremony
          </span>
          <span style={{ fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: '2px', color: 'var(--text-dim)' }}>
            {active ? `LIVE · #${String(active.ordinal).padStart(3, '0')}` : 'idle ▾'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-card)', fontSize: 14, letterSpacing: '4px', color: 'var(--amber-hot)', textTransform: 'uppercase' }}>
            🔥 Cash Burn Ceremony
          </span>
          {active && (
            <span style={{ fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '2px', color: 'var(--green)', border: '1px solid var(--green)', padding: '2px 8px' }}>
              LIVE · #{String(active.ordinal).padStart(3, '0')}
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)} style={{ ...btn('var(--text-dim)'), fontSize: 10 }}>close ▴</button>
      </div>

      {msg && (
        <div style={{ marginBottom: 12, padding: '8px 12px', border: '1px dashed var(--border)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
          {msg}
        </div>
      )}

      {/* Active ceremony preview + close/repost actions */}
      {active && (
        <div style={{ marginBottom: 18, padding: 12, border: '1px solid var(--green)', background: 'rgba(180, 255, 111, 0.04)' }}>
          <div style={{ fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: '3px', color: 'var(--green)', marginBottom: 8 }}>
            ACTIVE · #{String(active.ordinal).padStart(3, '0')} · {fmtFull(active.amount)} $CASH
          </div>
          {active.image_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.image_path} alt={`ceremony #${active.ordinal}`} className={styles.previewFrame} />
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => doClose(active.id)}   disabled={busy} style={btn('var(--red)', { disabled: busy })}>🏁 close ceremony</button>
            <button onClick={() => doRepost(active.id)}  disabled={busy} style={btn('var(--amber-hot)', { disabled: busy })}>↻ repost telegram</button>
            <a href={`/burns/${active.id}`} target="_blank" rel="noopener noreferrer" style={{ ...btn('var(--text-dim)'), textDecoration: 'none', display: 'inline-block' }}>open public page ↗</a>
          </div>
        </div>
      )}

      {/* New-ceremony form (only shown when no active ceremony) */}
      {!active && (
        <>
          {/* Amount + tier indicator */}
          <div className={styles.ceremonyGrid2}>
            <div>
              <span style={label}>AMOUNT ($CASH)</span>
              <input
                style={input}
                inputMode="decimal"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.,_]/g, '') }))}
                placeholder="69420 / 1000000 / 6900000000"
              />
              <div style={{ marginTop: 6, fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '2px', color: 'var(--text-dim)' }}>
                {form.amount ? `${fmtFull(form.amount)} → ${fmtCompact(form.amount)}` : '—'}
              </div>
            </div>
            <div>
              <span style={label}>TIER (AUTO)</span>
              <div style={{ ...input, color: tier.key === 'cataclysm' || tier.key === 'legendary' ? 'var(--amber-hot)' : 'var(--green)', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{tier.label}</span>
                <span style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-dim)' }}>≥ {fmtCompact(tier.min)}</span>
              </div>
              <div style={{ marginTop: 6, fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '2px', color: 'var(--text-dim)' }}>
                ★ = suggested character for this tier
              </div>
            </div>
          </div>

          {/* Sprite picker */}
          <div style={{ marginBottom: 4 }}>
            <span style={label}>CHARACTER {form.character_key && <span style={{ color: 'var(--green)' }}>· {(characters.find(c => c.key === form.character_key)?.title) || form.character_key}</span>}</span>
            <div className={styles.spriteGrid}>
              {characters.map(c => {
                const isActive = form.character_key === c.key;
                const isSuggested = suggestedSet.has(c.key);
                const cls = [styles.spriteTile, isActive && styles.active, isSuggested && styles.suggested].filter(Boolean).join(' ');
                return (
                  <button
                    type="button"
                    key={c.key}
                    className={cls}
                    onClick={() => setForm(f => ({ ...f, character_key: c.key }))}
                    title={`${c.title} — ${c.bureau}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.sprite} alt={c.title} loading="lazy" />
                    <span className="label">{c.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional fields */}
          <div className={styles.ceremonyGrid2}>
            <div>
              <span style={label}>CARD NAME (OPTIONAL)</span>
              <input
                style={input}
                value={form.card_name}
                onChange={e => setForm(f => ({ ...f, card_name: e.target.value.toUpperCase() }))}
                placeholder="PEPECLASSIC / NAKAMOTOPEPE / —"
              />
            </div>
            <div>
              <span style={label}>HEADLINE OVERRIDE (OPTIONAL)</span>
              <input
                style={input}
                value={form.headline}
                onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                placeholder="CASH BURN CEREMONY (default)"
                maxLength={60}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={label}>QUOTE OVERRIDE (OPTIONAL)</span>
            <input
              style={input}
              value={form.quote}
              onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
              placeholder="leave blank to use the character's default quote"
              maxLength={120}
            />
          </div>

          {/* Preview + Open buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button onClick={doPreview} disabled={busy || !form.character_key || !form.amount} style={btn('var(--amber-hot)', { disabled: busy || !form.character_key || !form.amount })}>
              {busy ? 'rendering…' : '👁 preview'}
            </button>
            <button onClick={doOpen} disabled={busy || !form.character_key || !form.amount} style={btn('var(--green)', { disabled: busy || !form.character_key || !form.amount })}>
              🔥 OPEN CEREMONY (POSTS TO TELEGRAM)
            </button>
          </div>

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className={styles.previewFrame} />
          )}
        </>
      )}

      {/* Recent ceremonies */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-dim)' }}>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: 10, letterSpacing: '3px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
          recent ceremonies {loading && '…'}
        </div>
        {list.length === 0 && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
            no ceremonies yet
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map(b => (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: 8, border: '1px solid var(--border-dim)' }}>
              <span style={{ fontFamily: 'var(--font-card)', fontSize: 11, letterSpacing: '2px', color: b.status === 'active' ? 'var(--green)' : 'var(--text-dim)' }}>
                #{String(b.ordinal).padStart(3, '0')}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fmtFull(b.amount)} $CASH · <span style={{ color: 'var(--text-dim)' }}>{b.character_key}</span>
                {b.card_name && <span style={{ color: 'var(--amber)' }}> · {b.card_name}</span>}
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-dim)' }}>[{b.status}]</span>
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <a href={`/burns/${b.id}`} target="_blank" rel="noopener noreferrer" style={{ ...btn('var(--text-dim)'), fontSize: 10, padding: '6px 10px', textDecoration: 'none' }}>view</a>
                {b.status === 'active' && (
                  <button onClick={() => doClose(b.id)} disabled={busy} style={{ ...btn('var(--red)', { disabled: busy }), fontSize: 10, padding: '6px 10px' }}>close</button>
                )}
                {b.status === 'closed' && (
                  <button onClick={() => doArchive(b.id)} disabled={busy} style={{ ...btn('var(--text-dim)', { disabled: busy }), fontSize: 10, padding: '6px 10px' }}>archive</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
