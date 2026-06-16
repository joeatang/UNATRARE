'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import styles from './upload.module.css';

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://unatrare.wtf';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export default function VaultUploadPage() {
  const [promo,    setPromo]    = useState(null);
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [form,     setForm]     = useState({
    token_name: '', asset_name: '', description: '', owner_xcp: '', owner_btc: '',
    fee_tx: '', fee_currency: 'PEPECASH', twitter: '', telegram: '', artist_handle: '',
  });
  const [status,   setStatus]   = useState('');          // idle | uploading | done | error
  const [result,   setResult]   = useState(null);
  const [copied,     setCopied]     = useState('');
  const [previewTab, setPreviewTab] = useState('card');
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
    if (f.size > 26_214_400) {
      setStatus('error');
      setResult({ error: `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 25 MB.` });
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
    if (!form.owner_xcp.trim()) { setStatus('error'); setResult({ error: 'Your Counterparty address is required.' }); return; }

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

  // Build the preview JSON object from current form state.
  // Uses [sha256_hash] as a visible placeholder since the real hash isn't
  // known until after the file is uploaded.
  function buildPreviewJson(f, uploadedFile) {
    const HASH     = '[sha256_hash]';
    const ext      = uploadedFile
      ? (uploadedFile.type === 'image/jpeg' ? 'jpg' : uploadedFile.type.split('/')[1])
      : 'png';
    const art_url  = `${BASE}/uploads/vault/${HASH}.${ext}`;
    const icon_url = `${BASE}/uploads/vault/${HASH}_icon.png`;
    const name     = f.asset_name || f.token_name || 'YOURTOKEN';
    const descText = f.description || name;
    const social   = [];
    if (f.twitter?.trim())  social.push({ type: 'twitter',  data: f.twitter.trim() });
    if (f.telegram?.trim()) social.push({ type: 'telegram', data: f.telegram.trim() });
    const out = {
      success:               true,
      asset:                 f.token_name  || 'YOURTOKEN',
      name,
      description:           `<br /><img src="${art_url}" class="img-responsive" /><br /><div><p>${descText}</p></div>`,
      image:                 icon_url,
      image_large:           art_url,
      image_title:           name,
      website:               BASE,
      pgpsig:                f.artist_handle?.trim() || f.owner_xcp || '',

      // Social — artist's own twitter only, omitted if not provided
      ...(f.twitter?.trim() ? { website_social_twitter: f.twitter.trim() } : {}),

      ...(social.length > 0 && { social }),
      // images[] omitted — image field already carries the 48×48 icon
    };
    return out;
  }

  // Syntax-highlight a JSON string for display in the preview block.
  // Uses inline styles (not CSS module classes) so the HTML can be set via
  // dangerouslySetInnerHTML without needing hashed class names.
  function highlightJson(str) {
    const esc = str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return esc.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      m => {
        if (/^".+"\s*:$/.test(m))   return `<span style="color:#f0a020">${m}</span>`; // key
        if (/^"/.test(m))           return `<span style="color:#8bc98a">${m}</span>`; // string
        if (/true|false/.test(m))   return `<span style="color:#a78bfa">${m}</span>`; // bool
        if (/null/.test(m))         return `<span style="color:#555">${m}</span>`;    // null
        return `<span style="color:#6ba8d6">${m}</span>`;                             // number
      }
    );
  }

  function extractHandle(url, type) {
    if (!url?.trim()) return '';
    const last = url.trim().replace(/\/$/, '').split('/').pop() || url;
    return type === 'twitter' ? (last.startsWith('@') ? last : '@' + last) : last;
  }

  const promoSlotsLeft = promo ? promo.max - promo.count : null;

  return (
    <>
      <Nav />
      <main className={styles.page}>
      <div className={styles.nav}>
        <Link href="/vault" className={styles.back}>← PEPE VAULT</Link>
      </div>

      <h1 className={styles.title}>SEAL YOUR ART</h1>
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
          <div className={styles.successTitle}>✓ SEALED IN THE VAULT</div>
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
                Wallets display art when this URL is in your token description.
                <br />
                <strong>Submitting to the UNATRARE directory?</strong> Use{' '}
                <code style={{fontSize:'10px', wordBreak:'break-all'}}>https://unatrare.wtf/c/{form.token_name || 'YOURTOKEN'}.json</code>{' '}
                in your description instead — that URL is what gets certified.
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
          <button className={styles.resetBtn} onClick={() => { setStatus(''); setResult(null); setFile(null); setPreview(null); setForm({ token_name:'',asset_name:'',description:'',owner_xcp:'',owner_btc:'',fee_tx:'',fee_currency:'PEPECASH',twitter:'',telegram:'',artist_handle:''}); }}>
            Upload another
          </button>
          <Link href="/vault" style={{ display:'block', textAlign:'center', marginTop:12,
            fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
            color:'var(--text-dim)', textDecoration:'none' }}>
            ← back to the vault
          </Link>
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
                <div className={styles.dropHint}>PNG · JPG · GIF · WebP · max 10 MB</div>
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
          <p className={styles.thumbNote}>
            ★ A 48×48 thumbnail is auto-generated from your art — no extra step needed.
          </p>

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
              <span className={styles.hint}>Counterparty token name — 4–12 uppercase letters, or A + 10 digits (e.g. RAREPEPE, A12345678901)</span>
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
              <span className={styles.label}>YOUR XCP / COUNTERPARTY ADDRESS *</span>
              <input
                className={styles.input}
                value={form.owner_xcp}
                onChange={field('owner_xcp')}
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf…"
                maxLength={100}
                required
              />
              <span className={styles.hint}>Your Counterparty/Bitcoin address — shown on your vault card for provenance</span>
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

            {/* ── PGP sig / artist signature ── */}
            <label className={styles.field}>
              <span className={styles.label}>ARTIST SIGNATURE · PGPSIG (optional)</span>
              <input
                className={styles.input}
                value={form.artist_handle}
                onChange={field('artist_handle')}
                placeholder="your name, handle, or @username"
                maxLength={64}
              />
            </label>

            {/* ── Social links ── */}
            <div className={styles.socialSection}>
              <div className={styles.socialTitle}>SOCIAL LINKS · OPTIONAL</div>
              <div className={styles.socialRow}>
                <label className={styles.field}>
                  <span className={styles.label}>TWITTER / X</span>
                  <input
                    className={styles.input}
                    value={form.twitter}
                    onChange={field('twitter')}
                    placeholder="https://twitter.com/yourhandle"
                    maxLength={120}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>TELEGRAM</span>
                  <input
                    className={styles.input}
                    value={form.telegram}
                    onChange={field('telegram')}
                    placeholder="https://t.me/yourhandle"
                    maxLength={120}
                  />
                </label>
              </div>
            </div>
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

          {/* ── Card / JSON Preview ── */}
          <div className={styles.previewSection}>
            <div className={styles.previewTabs}>
              <button
                type="button"
                className={`${styles.previewTab} ${previewTab === 'card' ? styles.previewTabActive : ''}`}
                onClick={() => setPreviewTab('card')}
              >CARD PREVIEW</button>
              <button
                type="button"
                className={`${styles.previewTab} ${previewTab === 'json' ? styles.previewTabActive : ''}`}
                onClick={() => setPreviewTab('json')}
              >JSON</button>
            </div>

            {previewTab === 'card' ? (
              <div className={styles.cardWrap}>
                <div className={styles.cardPreview}>
                  <div className={styles.cardImgWrap}>
                    {preview ? (
                      <img className={styles.cardImgEl} src={preview} alt="art preview" />
                    ) : (
                      <div className={styles.cardImgPlaceholder}>
                        <span>DROP ART TO PREVIEW</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardToken}>{form.token_name || 'YOURTOKEN'}</div>
                    {form.asset_name && form.asset_name !== form.token_name && (
                      <div className={styles.cardName}>{form.asset_name}</div>
                    )}
                    {form.description && (
                      <div className={styles.cardDesc}>
                        {form.description.length > 120 ? form.description.slice(0, 120) + '…' : form.description}
                      </div>
                    )}
                    {(form.artist_handle?.trim() || form.owner_xcp?.trim()) && (
                      <div className={styles.cardSig}>
                        by {form.artist_handle?.trim() || (form.owner_xcp ? form.owner_xcp.slice(0, 10) + '…' : '')}
                      </div>
                    )}
                    {(form.twitter || form.telegram) && (
                      <div className={styles.cardSocials}>
                        {form.twitter  && <span className={styles.cardSocialBadge}>𝕏 {extractHandle(form.twitter, 'twitter')}</span>}
                        {form.telegram && <span className={styles.cardSocialBadge}>✈ {extractHandle(form.telegram, 'telegram')}</span>}
                      </div>
                    )}
                    <div className={styles.cardFooter}>
                      <span className={styles.cardBadge}>◈ PEPE VAULT</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.previewBlock}>
                <pre
                  dangerouslySetInnerHTML={{
                    __html: highlightJson(JSON.stringify(buildPreviewJson(form, file), null, 2))
                  }}
                />
              </div>
            )}

            <p className={styles.previewNote}>
              {previewTab === 'card'
                ? 'Live card preview · updates as you type · drop art to see image'
                : 'Exactly what wallets and explorers read · placeholders replaced after upload'}
            </p>
          </div>

          <button className={styles.submitBtn} type="submit" disabled={status === 'uploading'}>
            {status === 'uploading' ? 'UPLOADING…' : 'SEAL YOUR ART'}
          </button>
        </form>
      )}
    </main>
    </>
  );
}
