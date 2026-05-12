'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './upload.module.css';

const BASE = process.env.NEXT_PUBLIC_BASE_URL || '';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export default function VaultUploadPage() {
  const [promo,    setPromo]    = useState(null);
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [form,     setForm]     = useState({
    token_name: '', asset_name: '', description: '', owner_xcp: '', owner_btc: '',
    fee_tx: '', fee_currency: 'PEPECASH',
  });
  const [status,   setStatus]   = useState('');          // idle | uploading | done | error
  const [result,   setResult]   = useState(null);
  const [copied,   setCopied]   = useState('');
  const fileRef  = useRef();

  useEffect(() => {
    fetch('/api/vault/upload')
      .then(r => r.json())
      .then(j => setPromo(j))
      .catch(() => {});
  }, []);

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setStatus('error');
      setResult({ error: 'Only PNG, JPG, GIF, WebP allowed.' });
      return;
    }
    if (f.size > 1_048_576) {
      setStatus('error');
      setResult({ error: `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 1 MB.` });
      return;
    }
    setFile(f);
    setStatus('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  function field(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { setStatus('error'); setResult({ error: 'Please choose a file.' }); return; }
    if (!form.token_name.trim()) { setStatus('error'); setResult({ error: 'Token name is required.' }); return; }

    setStatus('uploading');
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));

      const res  = await fetch('/api/vault/upload', { method: 'POST', body: fd });
      const json = await res.json();

      if (json.ok) {
        setStatus('done');
        setResult(json);
      } else {
        setStatus('error');
        setResult(json);
      }
    } catch (err) {
      setStatus('error');
      setResult({ error: 'Network error — please try again.' });
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  }

  const promoSlotsLeft = promo ? promo.max - promo.count : null;

  return (
    <main className={styles.page}>
      <div className={styles.nav}>
        <Link href="/vault" className={styles.back}>← PEPE VAULT</Link>
      </div>

      <h1 className={styles.title}>VAULT YOUR ART</h1>
      <p className={styles.subtitle}>
        Upload art for your Counterparty token. Get a permanent JSON URL for the token description.
      </p>

      {promo?.promo && (
        <div className={styles.promoBanner}>
          ★ PROMO — FREE &nbsp;·&nbsp; {promoSlotsLeft} free slot{promoSlotsLeft !== 1 ? 's' : ''} remaining
        </div>
      )}
      {promo && !promo.promo && (
        <div className={styles.priceBanner}>
          Fee: 500 PEPECASH per upload
        </div>
      )}

      {status === 'done' && result?.ok ? (
        <div className={styles.success}>
          <div className={styles.successTitle}>✓ VAULTED</div>
          <div className={styles.successGrid}>
            <div className={styles.successRow}>
              <span className={styles.successLabel}>JSON URL</span>
              <div className={styles.successCopyRow}>
                <code className={styles.successVal}>{BASE}/api/vault/json/{result.hash}</code>
                <button
                  className={styles.copyBtn}
                  onClick={() => copy(`${BASE}/api/vault/json/${result.hash}`, 'json')}
                >{copied === 'json' ? '✓ copied' : 'copy'}</button>
              </div>
              <p className={styles.successHint}>
                Paste this into your Counterparty token description — wallets will display your art.
              </p>
            </div>
            <div className={styles.successRow}>
              <span className={styles.successLabel}>ART URL</span>
              <div className={styles.successCopyRow}>
                <code className={styles.successVal}>{BASE}{result.art_url}</code>
                <button
                  className={styles.copyBtn}
                  onClick={() => copy(`${BASE}${result.art_url}`, 'art')}
                >{copied === 'art' ? '✓ copied' : 'copy'}</button>
              </div>
            </div>
            <div className={styles.successRow}>
              <span className={styles.successLabel}>SHA-256 HASH</span>
              <code className={styles.successVal}>{result.hash}</code>
            </div>
          </div>
          <button className={styles.resetBtn} onClick={() => { setStatus(''); setResult(null); setFile(null); setPreview(null); setForm({ token_name:'',asset_name:'',description:'',owner_xcp:'',owner_btc:'',fee_tx:'',fee_currency:'PEPECASH'}); }}>
            Upload another
          </button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* ── File drop area ── */}
          <div
            className={`${styles.dropZone} ${file ? styles.dropZoneHasFile : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { const synth = { target: { files: [f] } }; onFileChange(synth); } }}
          >
            {preview ? (
              <img className={styles.preview} src={preview} alt="preview" />
            ) : (
              <>
                <div className={styles.dropIcon}>⬆</div>
                <div className={styles.dropText}>drop art here or click to browse</div>
                <div className={styles.dropHint}>PNG · JPG · GIF · WebP · max 1 MB</div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className={styles.fileInput}
              onChange={onFileChange}
            />
          </div>

          {/* ── Token fields ── */}
          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.label}>COUNTERPARTY TOKEN NAME *</span>
              <input
                className={styles.input}
                value={form.token_name}
                onChange={field('token_name')}
                placeholder="RAREPEPE"
                maxLength={22}
                required
              />
              <span className={styles.hint}>All-caps, letters + numbers, 3–20 chars</span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>DISPLAY NAME</span>
              <input
                className={styles.input}
                value={form.asset_name}
                onChange={field('asset_name')}
                placeholder="Rare Pepe"
                maxLength={100}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>DESCRIPTION</span>
              <textarea
                className={styles.textarea}
                value={form.description}
                onChange={field('description')}
                placeholder="Short description of this artwork…"
                maxLength={300}
                rows={3}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>YOUR XCP / COUNTERPARTY ADDRESS</span>
              <input
                className={styles.input}
                value={form.owner_xcp}
                onChange={field('owner_xcp')}
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf…"
                maxLength={100}
              />
              <span className={styles.hint}>Used for airdrop eligibility tracking</span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>BITCOIN ADDRESS (optional)</span>
              <input
                className={styles.input}
                value={form.owner_btc}
                onChange={field('owner_btc')}
                placeholder="bc1q…"
                maxLength={100}
              />
            </label>
          </div>

          {/* ── Fee fields (hidden during promo) ── */}
          {promo && !promo.promo && (
            <div className={styles.feeSection}>
              <div className={styles.feeTitle}>PAYMENT</div>
              <div className={styles.feeRow}>
                <label className={styles.field} style={{ flex: 1 }}>
                  <span className={styles.label}>FEE CURRENCY</span>
                  <select className={styles.select} value={form.fee_currency} onChange={field('fee_currency')}>
                    <option value="PEPECASH">PEPECASH (500)</option>
                    <option value="BTC">BTC</option>
                  </select>
                </label>
                <label className={styles.field} style={{ flex: 2 }}>
                  <span className={styles.label}>PAYMENT TX ID</span>
                  <input
                    className={styles.input}
                    value={form.fee_tx}
                    onChange={field('fee_tx')}
                    placeholder="transaction id on chain"
                    maxLength={100}
                    required={promo && !promo.promo}
                  />
                </label>
              </div>
            </div>
          )}

          {status === 'error' && result?.error && (
            <div className={styles.errorMsg}>{result.error}</div>
          )}

          <button className={styles.submitBtn} type="submit" disabled={status === 'uploading'}>
            {status === 'uploading' ? 'UPLOADING…' : 'VAULT THIS ART'}
          </button>
        </form>
      )}
    </main>
  );
}
