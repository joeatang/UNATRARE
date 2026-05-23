'use client';

import { useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import styles from '../vault.module.css';

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const ADDR_RE  = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

function timeAgo(ms) {
  if (!ms) return '—';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Edit panel for a single vault asset ──────────────────────────── */
function EditPanel({ asset, ownerAddress, onSaved }) {
  const ext    = MIME_EXT[asset.art_mime] ?? asset.art_mime?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const artUrl = asset.art_url || `/uploads/vault/${asset.art_hash}.${ext}`;
  const challenge = `UNATRARE:VAULT:UPDATE:${asset.art_hash.toUpperCase()}`;

  // Editable state
  const [assetName,    setAssetName]    = useState(asset.asset_name    || '');
  const [description,  setDescription]  = useState(asset.description   || '');
  const [artistHandle, setArtistHandle] = useState(asset.artist_handle || '');
  const [twitter,      setTwitter]      = useState(asset.twitter       || '');
  const [telegram,     setTelegram]     = useState(asset.telegram      || '');

  // Art replacement state
  const [newArtFile,     setNewArtFile]     = useState(null);
  const [newArtPreview,  setNewArtPreview]  = useState(null);

  // Signature + form state
  const [sig,       setSig]       = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | loading | ok | error
  const [saveErr,   setSaveErr]   = useState('');

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) { setNewArtFile(null); setNewArtPreview(null); return; }
    setNewArtFile(file);
    setNewArtPreview(URL.createObjectURL(file));
    resetSave();
  }

  function resetSave() {
    setSaveState('idle');
    setSaveErr('');
  }

  async function handleSave() {
    if (!sig.trim()) {
      setSaveErr('Paste your BIP-137 signature first');
      return;
    }
    setSaveState('loading');
    setSaveErr('');
    try {
      const fd = new FormData();
      fd.append('art_hash',      asset.art_hash);
      fd.append('owner_address', ownerAddress);
      fd.append('signature',     sig.trim());
      fd.append('asset_name',    assetName.trim());
      fd.append('description',   description.trim());
      fd.append('artist_handle', artistHandle.trim());
      fd.append('twitter',       twitter.trim());
      fd.append('telegram',      telegram.trim());
      if (newArtFile) fd.append('file', newArtFile);

      const res  = await fetch('/api/vault/update', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.ok) {
        setSaveState('ok');
        if (onSaved) onSaved();
      } else {
        setSaveErr(json.error || 'Update failed');
        setSaveState('error');
      }
    } catch {
      setSaveErr('Network error — please try again');
      setSaveState('error');
    }
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', boxSizing: 'border-box',
    background: '#080808', border: '1px solid #1e1e1e',
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
    outline: 'none',
  };

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #1e1e1e', paddingTop: 14 }}>
      {/* Current art preview */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={newArtPreview || artUrl}
          alt={asset.token_name}
          style={{
            width: 64, height: 64, objectFit: 'contain', flexShrink: 0,
            border: `1px solid ${newArtPreview ? 'var(--green)' : '#1e1e1e'}`,
            background: '#050505',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>
            TOKEN
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--amber-hot)', fontWeight: 700, letterSpacing: '0.06em', wordBreak: 'break-all' }}>
            {asset.token_name}
          </div>
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', color: 'var(--text-dim)', marginTop: 4 }}>
            {timeAgo(asset.uploaded_at)}
          </div>
        </div>
      </div>

      {/* Asset name */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>DISPLAY NAME</div>
        <input type="text" value={assetName} maxLength={100} placeholder="Display name for this art" onChange={e => { setAssetName(e.target.value); resetSave(); }} style={inputStyle} />
      </div>

      {/* Artist handle */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>ARTIST HANDLE</div>
        <input type="text" value={artistHandle} maxLength={64} placeholder="@handle (optional)" onChange={e => { setArtistHandle(e.target.value); resetSave(); }} style={inputStyle} />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>DESCRIPTION</div>
        <textarea
          rows={3}
          value={description}
          maxLength={1000}
          placeholder="Short description..."
          onChange={e => { setDescription(e.target.value); resetSave(); }}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Social links */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>TWITTER / X</div>
        <input type="text" value={twitter} maxLength={120} placeholder="@yourhandle or https://x.com/..." onChange={e => { setTwitter(e.target.value); resetSave(); }} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 4 }}>TELEGRAM</div>
        <input type="text" value={telegram} maxLength={120} placeholder="@username or https://t.me/..." onChange={e => { setTelegram(e.target.value); resetSave(); }} style={inputStyle} />
      </div>

      {/* Replace art */}
      <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>REPLACE ART IMAGE</div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
          Upload a replacement (PNG, JPG, GIF, or WebP — max 25 MB). Leave blank to keep the current art.
          {newArtPreview && (
            <span style={{ color: 'var(--green)', marginLeft: 8 }}>✓ new art ready</span>
          )}
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleFileChange}
          style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)' }}
        />
      </div>

      {/* Signature */}
      <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6 }}>
        SIGN TO VERIFY OWNERSHIP
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
        Sign this message with the Bitcoin/XCP address you used when you uploaded:
      </div>
      <code style={{
        display: 'block', padding: '6px 10px', marginBottom: 8,
        background: '#080808', border: '1px solid #1e1e1e',
        fontFamily: "'Courier New', monospace", fontSize: 11, color: 'var(--amber)',
        wordBreak: 'break-all', lineHeight: 1.6,
      }}>
        {challenge}
      </code>
      <textarea
        rows={3}
        value={sig}
        onChange={e => { setSig(e.target.value); resetSave(); }}
        placeholder="Paste BIP-137 signature here..."
        style={{
          ...inputStyle, resize: 'vertical',
          fontFamily: "'Courier New', monospace", fontSize: 11,
          marginBottom: 10,
        }}
      />

      {saveErr && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#e05050', marginBottom: 8 }}>
          {saveErr}
        </div>
      )}

      {saveState === 'ok' ? (
        <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)' }}>
          ✓ UPDATED — changes saved
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saveState === 'loading'}
          style={{
            fontFamily: 'monospace', fontSize: '0.7rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#0a0a0a', background: 'var(--amber-hot)',
            border: 'none', borderRadius: 3, padding: '0.45rem 1rem',
            cursor: saveState === 'loading' ? 'not-allowed' : 'pointer',
            opacity: saveState === 'loading' ? 0.6 : 1,
          }}
        >
          {saveState === 'loading' ? 'saving...' : 'save changes →'}
        </button>
      )}
    </div>
  );
}

/* ── Asset row card ───────────────────────────────────────────────── */
function ManagedAssetCard({ asset, ownerAddress, onSaved }) {
  const [open, setOpen] = useState(false);
  const ext    = MIME_EXT[asset.art_mime] ?? asset.art_mime?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const artUrl = asset.art_url || `/uploads/vault/${asset.art_hash}.${ext}`;

  return (
    <div style={{
      background: '#0c0c0c', border: '1px solid #1e1e1e', borderRadius: 5,
      padding: '0.9rem', marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artUrl}
          alt={asset.token_name}
          style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0, border: '1px solid #1e1e1e', background: '#050505' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: 'var(--amber-hot)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {asset.token_name}
          </div>
          {asset.asset_name && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>{asset.asset_name}</div>
          )}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--amber)', background: 'transparent',
            border: '1px solid rgba(168,144,96,0.4)', borderRadius: 3,
            padding: '0.3rem 0.6rem', cursor: 'pointer', flexShrink: 0,
          }}
        >
          {open ? '▲ close' : '▼ edit'}
        </button>
      </div>

      {open && (
        <EditPanel
          asset={asset}
          ownerAddress={ownerAddress}
          onSaved={() => { if (onSaved) onSaved(); }}
        />
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function VaultManagePage() {
  const [address,  setAddress]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [assets,   setAssets]   = useState(null); // null = not yet fetched
  const [fetchErr, setFetchErr] = useState('');

  async function handleLookup(e) {
    e.preventDefault();
    const addr = address.trim();
    if (!ADDR_RE.test(addr)) {
      setFetchErr('Enter a valid legacy Bitcoin/XCP address (starts with 1)');
      return;
    }
    setFetchErr('');
    setLoading(true);
    setAssets(null);
    try {
      const res  = await fetch(`/api/vault/assets?owner=${encodeURIComponent(addr)}&limit=96`);
      const json = await res.json();
      if (json.ok) {
        setAssets(json.assets || []);
      } else {
        setFetchErr(json.error || 'Lookup failed');
      }
    } catch {
      setFetchErr('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    // Re-run lookup to refresh asset data
    if (address.trim()) {
      const syntheticEvent = { preventDefault: () => {} };
      handleLookup(syntheticEvent);
    }
  }

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>MANAGE VAULT ENTRIES</h1>
          <p className={styles.subtitle}>
            Update the details on your PEPE VAULT assets.
            Enter the Bitcoin or XCP address you used when uploading.
          </p>
          <Link href="/vault" className={styles.uploadBtn} style={{ background: 'transparent', border: '1px solid rgba(245,166,35,0.4)', color: 'var(--amber)' }}>
            ← back to vault
          </Link>
        </div>

        {/* Address lookup */}
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={address}
            onChange={e => { setAddress(e.target.value); setFetchErr(''); }}
            placeholder="Enter your Bitcoin / XCP address..."
            style={{
              flex: '1 1 300px', padding: '0.5rem 0.8rem',
              background: '#080808', border: '1px solid #1e1e1e',
              color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13,
              outline: 'none', borderRadius: 3,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              fontFamily: 'monospace', fontSize: '0.7rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#0a0a0a', background: 'var(--amber-hot)',
              border: 'none', borderRadius: 3, padding: '0.45rem 1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {loading ? 'looking up...' : 'look up entries →'}
          </button>
        </form>

        {fetchErr && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#e05050', marginBottom: '1rem' }}>
            {fetchErr}
          </div>
        )}

        {/* Results */}
        {assets !== null && assets.length === 0 && (
          <div className={styles.empty}>
            No vault entries found for that address.{' '}
            <Link href="/vault/upload" className={styles.emptyLink}>Upload art →</Link>
          </div>
        )}

        {assets !== null && assets.length > 0 && (
          <div>
            <div className={styles.meta}>{assets.length} entry{assets.length !== 1 ? 's' : ''} found</div>
            {assets.map(a => (
              <ManagedAssetCard
                key={a.art_hash}
                asset={a}
                ownerAddress={address.trim()}
                onSaved={handleRefresh}
              />
            ))}
          </div>
        )}

        {/* Help text */}
        {assets === null && !loading && !fetchErr && (
          <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <div style={{ fontFamily: 'var(--font-card)', fontSize: '8px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>HOW EDITS WORK</div>
            <ul style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: '1.25rem', margin: 0, maxWidth: 520 }}>
              <li>Enter the Bitcoin or XCP address you used when uploading.</li>
              <li>Your entries will appear. Click <strong>edit</strong> on any entry to expand the edit form.</li>
              <li>You can update the display name, description, artist handle, and social links.</li>
              <li>You can also replace the art image — the file hash and JSON URL will update.</li>
              <li>To save, sign the challenge message shown with your wallet (same address you uploaded with) and paste the BIP-137 signature.</li>
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
