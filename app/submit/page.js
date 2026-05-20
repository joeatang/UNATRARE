'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './submit.module.css';

const STEPS = [
  { num: 0, label: 'Get URL' },
  { num: 1, label: 'Verify' },
  { num: 2, label: 'Art' },
  { num: 3, label: 'Details' },
  { num: 4, label: 'Sign' },
  { num: 5, label: 'Submit' },
];

// ── Token name validator (client-side mirror of server validator) ──
function validateToken(raw) {
  if (!raw || raw.trim() === '') return { valid: false, error: '' };
  const name = raw.trim().toUpperCase();
  const RESERVED = ['BTC', 'XCP', 'BITCOIN', 'COUNTERPARTY'];
  if (RESERVED.includes(name)) return { valid: false, error: `${name} is a reserved name` };
  // Named: 4-12 uppercase A-Z
  if (/^[A-Z]{4,12}$/.test(name)) return { valid: true, normalized: name };
  // Numeric: A + 10 digits
  if (/^A\d{10}$/.test(name)) return { valid: true, normalized: name };
  // Subasset: PARENT.CHILD, total max 250 chars
  if (/^[A-Z]{4,12}\.[A-Za-z0-9._]{1,230}$/.test(name) && name.length <= 250) {
    return { valid: true, normalized: name };
  }
  if (name.length < 4) return { valid: false, error: 'Token names must be at least 4 characters' };
  if (name.length > 12 && !name.includes('.')) return { valid: false, error: 'Token names must be 4–12 uppercase letters' };
  return { valid: false, error: 'Invalid token name format — use 4-12 uppercase letters' };
}

function buildUrl(tokenName) {
  return `https://unatrare.wtf/c/${tokenName}.json`;
}

// Supply rules: minimum 16, maximum 20,016. Full supply must be intact at submission.
const MIN_SUPPLY = 16;
const MAX_SUPPLY = 20_016;

// ─────────────────────────────────────────────────────────────────
//  Step 0 — Get Your Metadata URL
// ─────────────────────────────────────────────────────────────────
function Step0({ onNext, isVault }) {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  function handleChange(e) {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '');
    setRaw(v);
    setCopied(false);
    if (v.length >= 1) {
      setResult(validateToken(v));
    } else {
      setResult(null);
    }
  }

  async function handleCopy() {
    if (!result?.valid) return;
    const url = buildUrl(result.normalized);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const url = result?.valid ? buildUrl(result.normalized) : null;
  const inputState = !result ? '' : result.valid ? styles.valid : styles.invalid;

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 1 of 6</div>
      <h2 className={styles.stepTitle}>GET Y<span>O</span>UR URL</h2>
      {isVault ? (
        <p className={styles.stepDesc}>
          Your art is already stored in the Pepe Vault.<br /><br />
          To appear in wallets when your token is certified, your Counterparty token&apos;s
          description field must contain your <strong>UNATRARE directory URL</strong> —
          not the Vault JSON URL.<br /><br />
          Enter your token name below to generate it.
          If you&apos;ve already created the token, just enter the name and click Continue.
        </p>
      ) : (
        <p className={styles.stepDesc}>
          <strong>Before you create your Counterparty token</strong>, you need your metadata URL.<br />
          Enter the token name you plan to register below. Copy the URL.<br />
          Then go to Counterparty and paste it into the <strong>description field</strong> of your token.
          <br /><br />
          <strong>If you create the token before getting this URL, your art will not be visible in wallets.</strong>
        </p>
      )}

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="tokenname">Token Name</label>
        <input
          id="tokenname"
          className={`${styles.tokenInput} ${inputState}`}
          type="text"
          value={raw}
          onChange={handleChange}
          placeholder="YOURTOKEN"
          autoComplete="off"
          spellCheck={false}
          maxLength={250}
        />
        <div className={styles.inputError}>
          {result && !result.valid && result.error ? result.error : '\u00A0'}
        </div>
        <div className={styles.inputHint}>
          Named: 4-12 uppercase letters (e.g. RAREPEPE) · Numeric: A + 10 digits · Subasset: PARENT.CHILD
        </div>
      </div>

      {url && (
        <>
          <div className={styles.urlBox}>
            <div className={styles.urlBoxLabel}>your metadata url</div>
            <div className={styles.urlBoxValue}>{url}</div>
            <div className={styles.urlBoxMeta}>
              {url.length} bytes · safe for all Counterparty wallets
            </div>
            <button
              className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
              onClick={handleCopy}
            >
              {copied ? 'copied ✓' : 'copy url →'}
            </button>
          </div>

          <div className={styles.warningBox}>
            {isVault ? (
              <>
                <div className={styles.warningTitle}>◈ vault submission checklist</div>
                <div className={styles.warningText}>
                  1. Copy the URL above.<br />
                  2. If your token <strong>already exists</strong>: update its Description field with this URL in Freewallet/Rarepepewallet.<br />
                  3. If your token <strong>doesn&apos;t exist yet</strong>: create it with <strong>name: {result.normalized}</strong>, paste this URL into Description, supply 16–20,016, non-divisible, locked, full supply intact in your wallet.<br />
                  4. Click Continue — your vault art will be used automatically.
                </div>
              </>
            ) : (
              <>
                <div className={styles.warningTitle}>⚠ important — read before creating token</div>
                <div className={styles.warningText}>
                  1. Copy the URL above.<br />
                  2. Go to Counterparty (Freewallet, Rarepepewallet, etc.).<br />
                  3. Create your token with <strong>name exactly: {result.normalized}</strong><br />
                  4. Paste the URL into the <strong>Description</strong> field.<br />
                  5. Set supply between <strong>16 and 20,016</strong>. Non-divisible. Locked.<br />
                  6. <strong>Do not distribute any supply</strong> before submitting — your full issuance must remain in your wallet.<br />
                  7. Return here and click Continue to submit your art.
                </div>
              </>
            )}
          </div>

          {/* Optional Series 0 invite code — collapsed by default */}
          <div style={{marginTop:20}}>
            {!showInvite ? (
              <button
                onClick={() => setShowInvite(true)}
                style={{
                  background:'none', border:'none', cursor:'pointer', padding:0,
                  fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px',
                  color:'var(--text-dim)', textDecoration:'underline',
                }}
              >
                have a series 0 invite code?
              </button>
            ) : (
              <div style={{padding:'14px 16px', border:'1px solid var(--border-dim)', background:'rgba(255,200,0,0.03)'}}>
                <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px', color:'var(--amber)', marginBottom:8}}>
                  ★ SERIES 0 INVITE CODE
                </div>
                <div style={{fontFamily:'var(--font-body)', fontSize:'12px', color:'var(--text-dim)', marginBottom:10, lineHeight:1.5}}>
                  <strong>Only for artists who received a personal invite.</strong><br />
                  If you weren&apos;t given a code, leave this blank and continue — it won&apos;t affect your submission.
                </div>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))}
                  placeholder="S0-XXXXXX"
                  style={{
                    width:'100%', boxSizing:'border-box', padding:'8px 12px',
                    background:'var(--bg)', border:'1px solid var(--border)',
                    color:'var(--text)', fontFamily:'var(--font-card)', fontSize:'12px',
                    letterSpacing:'3px',
                  }}
                />
              </div>
            )}
          </div>

          <button
            className={styles.nextBtn}
            onClick={() => onNext({ tokenName: result.normalized, inviteCode: inviteCode.trim().toUpperCase() || '' })}
          >
            {isVault ? 'my token is ready → continue' : 'i created the token → continue'}
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 1 — Verify Token on Counterparty
// ─────────────────────────────────────────────────────────────────
function Step1({ data, onNext, onBack }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  async function verify() {
    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch(`/api/verify-token?name=${encodeURIComponent(data.tokenName)}`);
      const json = await res.json();
      if (json.ok) {
        setResult(json);
        setStatus('ok');
      } else {
        setErrMsg(json.error || 'Token verification failed');
        setStatus('error');
      }
    } catch (e) {
      setErrMsg('Network error — please try again');
      setStatus('error');
    }
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 2 of 6</div>
      <h2 className={styles.stepTitle}>VERIF<span>Y</span> TOKEN</h2>
      <p className={styles.stepDesc}>
        We check that <strong>{data.tokenName}</strong> exists on Counterparty,
        is locked, non-divisible, and has a supply between <strong>16 and 20,016</strong>.
        Your full supply must be intact in your issuing address — tokens already distributed
        will route to manual review (approval bin) rather than the live pepempool.
      </p>

      {status === 'idle' && (
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <button className={styles.backBtn} onClick={onBack}>← back</button>
          <button className={styles.nextBtn} onClick={verify}>verify {data.tokenName} →</button>
        </div>
      )}

      {status === 'loading' && (
        <div style={{fontFamily:'var(--font-card)', fontSize:'12px', letterSpacing:'3px', color:'var(--amber)'}}>
          checking counterparty...
        </div>
      )}

      {status === 'error' && (
        <>
          <div style={{fontFamily:'var(--font-body)', fontSize:'13px', color:'var(--red)', marginBottom:16}}>
            {errMsg}
          </div>
          <button className={styles.nextBtn} onClick={verify}>
            try again →
          </button>
        </>
      )}

      {status === 'ok' && result && (() => {
        const belowMin  = result.supply < MIN_SUPPLY;
        const aboveMax  = result.supply > MAX_SUPPLY;
        const outOfRange = belowMin || aboveMax;
        return (
          <>
            <div className={styles.urlBox} style={{borderColor: outOfRange ? 'var(--red)' : 'var(--green)'}}>
              <div className={styles.urlBoxLabel}>{outOfRange ? '⚠ supply out of range' : 'token confirmed'}</div>
              <div className={styles.urlBoxValue}>{data.tokenName}</div>
              <div className={styles.urlBoxMeta}>
                Supply: {result.supply} · Owner: {result.owner?.slice(0,12)}…
                {outOfRange && ` · allowed range: 16–20,016`}
              </div>
            </div>
            {belowMin && (
              <div className={styles.warningBox} style={{borderColor:'var(--red)', marginBottom:16}}>
                <div className={styles.warningTitle} style={{color:'var(--red)'}}>supply too low</div>
                <div className={styles.warningText}>
                  Your token has a supply of <strong>{result.supply}</strong>. UNATRARE requires
                  a minimum of <strong>16</strong> and a maximum of <strong>20,016</strong>.<br /><br />
                  Issue additional supply on Counterparty to bring it into range, then return here.
                </div>
              </div>
            )}
            {aboveMax && (
              <div className={styles.warningBox} style={{borderColor:'var(--red)', marginBottom:16}}>
                <div className={styles.warningTitle} style={{color:'var(--red)'}}>supply exceeds maximum</div>
                <div className={styles.warningText}>
                  Your token has a supply of <strong>{result.supply.toLocaleString()}</strong>.
                  UNATRARE&apos;s maximum issuance is <strong>20,016</strong>.<br /><br />
                  Tokens above this threshold are not eligible for submission.
                  This limit preserves the scarcity that makes UNATRARE certification meaningful.
                </div>
              </div>
            )}
            {!outOfRange && (
              <div className={styles.warningBox} style={{borderColor:'var(--amber)', marginBottom:16, background:'rgba(255,200,0,0.03)'}}>
                <div className={styles.warningTitle} style={{color:'var(--amber)'}}>⚠ full supply check</div>
                <div className={styles.warningText}>
                  Confirmed: <strong>{result.supply.toLocaleString()}</strong> tokens — within the 16–20,016 range.<br /><br />
                  UNATRARE also requires that your <strong>full supply is still held by your issuing address</strong>.
                  If any tokens have already been sent to other wallets, your submission will be routed to the
                  <strong> approval bin</strong> for manual review instead of entering the live pepempool.
                  Hold your full supply until after certification.
                </div>
              </div>
            )}
            <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
              <button className={styles.backBtn} onClick={onBack}>← back</button>
              {!outOfRange && (
                <button className={styles.nextBtn} onClick={() => onNext({ ...data, owner: result.owner, supply: result.supply })}>continue → upload art</button>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 2 — Upload Art + Card Preview
// ─────────────────────────────────────────────────────────────────
function Step2({ data, onNext, onBack }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [useVault, setUseVault] = useState(true);
  const fileRef = useRef();

  // ── Vault bypass: art already stored ─────────────────────────
  if (data.vaultHash && data.vaultMime && useVault) {
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' })[data.vaultMime] ?? 'png';
    const artUrl = `/uploads/vault/${data.vaultHash}.${ext}`;
    return (
      <div className={styles.stepBox}>
        <div className={styles.stepEyebrow}>Step 3 of 6</div>
        <h2 className={styles.stepTitle}>UPL<span>O</span>AD ART</h2>
        <div style={{ border: '1px solid var(--green)', borderLeft: '3px solid var(--green)', padding: '14px 18px', marginBottom: 24, fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--green)', background: 'rgba(61,158,61,0.04)' }}>
          ◈ ART LOADED FROM PEPE VAULT — no upload needed
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
          <img src={artUrl} alt={data.tokenName} style={{ maxWidth: 180, maxHeight: 220, border: '1px solid var(--border)', objectFit: 'contain' }} />
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--text-dim)', lineHeight: 2 }}>
            <div>TOKEN: <span style={{ color: 'var(--text)' }}>{data.tokenName}</span></div>
            <div>FORMAT: <span style={{ color: 'var(--text)' }}>{data.vaultMime}</span></div>
            <div style={{ marginTop: 8, fontFamily: 'var(--font-body)', fontSize: '12px', letterSpacing: 0, lineHeight: 1.6 }}>
              This art was already uploaded to the Pepe Vault.<br />
              It will be used for your directory submission.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={styles.backBtn} onClick={onBack}>← back</button>
          <button className={styles.nextBtn} onClick={() => onNext({ ...data, artUrl, artMime: data.vaultMime, artHash: data.vaultHash })}>
            use this art →
          </button>
          <button
            onClick={() => setUseVault(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            upload a different file instead
          </button>
        </div>
      </div>
    );
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['image/png','image/jpeg','image/gif','image/webp','image/svg+xml','text/html'];
    if (!allowed.includes(f.type)) {
      setErrMsg('File must be PNG, JPG, GIF, WebP, SVG, or HTML');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg('File must be under 10 MB');
      return;
    }
    // Soft warning — not a block
    if (f.size > 1 * 1024 * 1024) {
      setErrMsg(`⚠️ Large file (${(f.size/1024/1024).toFixed(1)} MB) — images over 1 MB load slowly in wallets. Consider compressing before uploading.`);
    } else {
      setErrMsg('');
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setErrMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('tokenName', data.tokenName);
      const res = await fetch('/api/upload-art', { method: 'POST', body: form });
      // Read body as text first so we can handle non-JSON error pages gracefully
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch {
        setErrMsg(`Upload failed (HTTP ${res.status}) — try a smaller file or PNG`);
        setUploading(false);
        return;
      }
      if (json.ok) {
        onNext({ ...data, artUrl: json.url, artMime: file.type, artHash: json.hash || '' });
      } else {
        setErrMsg(json.error || 'Upload failed');
        setUploading(false);
      }
    } catch {
      setErrMsg('Network error — please try again');
      setUploading(false);
    }
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 3 of 6</div>
      <h2 className={styles.stepTitle}>UPL<span>O</span>AD ART</h2>
      <p className={styles.stepDesc}>
        Upload the art for <strong>{data.tokenName}</strong>.<br />
        PNG, JPG, GIF, WebP, SVG, or HTML. Max 3 MB.<br />
        Recommended: 400×560px (trading card ratio) or square.<br />
        A wallet-optimised thumbnail is generated automatically — full art displays in UNATRARE and wallets that support it.
      </p>

      {/* Two-column when preview exists */}
      <div style={{display:'flex', gap:32, alignItems:'flex-start', flexWrap:'wrap'}}>

        {/* Upload drop zone */}
        <div style={{flex:1, minWidth:200}}>
          <div
            style={{border:'1px solid var(--border)', padding:'32px', textAlign:'center',
              cursor:'pointer', marginBottom:16, background:'var(--bg)', minHeight:120,
              display:'flex', alignItems:'center', justifyContent:'center'}}
            onClick={() => fileRef.current?.click()}
          >
            <span style={{fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px', color:'var(--text-dim)'}}>
              {file ? file.name : 'click to select file'}
            </span>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,text/html"
            style={{display:'none'}} onChange={handleFile} />

          {errMsg && (
            <div className={styles.inputError} style={errMsg.startsWith('⚠️') ? {color:'var(--amber)'} : undefined}>
              {errMsg}
            </div>
          )}

          <div style={{display:'flex', gap:12, flexWrap:'wrap', marginTop: file ? 0 : 8}}>
            <button className={styles.backBtn} onClick={onBack}>← back</button>
            {file && !uploading && (
              <button className={styles.nextBtn} onClick={handleUpload}>upload + continue →</button>
            )}
          </div>
          {uploading && (
            <div style={{fontFamily:'var(--font-card)', fontSize:'12px', letterSpacing:'3px', color:'var(--amber)'}}>
              uploading...
            </div>
          )}
        </div>

        {/* Card frame preview */}
        {preview && (
          <div style={{flexShrink:0, width:160}}>
            <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px',
              color:'var(--text-dim)', marginBottom:8, textTransform:'uppercase'}}>
              card preview
            </div>
            <div style={{border:'1px solid var(--amber)', background:'var(--surface)'}}>
              {/* Card header strip */}
              <div style={{height:22, borderBottom:'1px solid var(--amber)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                <span style={{fontFamily:'var(--font-card)', fontSize:'7px', letterSpacing:'2px', color:'var(--amber)'}}>
                  UNATRARE
                </span>
                <span style={{color:'var(--text-dim)', fontSize:'8px'}}>·</span>
                <span style={{fontFamily:'var(--font-card)', fontSize:'7px', letterSpacing:'2px', color:'var(--amber)'}}>
                  PENDING
                </span>
              </div>
              {/* Art area — 5:7 ratio */}
              <div style={{width:'100%', aspectRatio:'5/7', overflow:'hidden',
                background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <img src={preview} alt="preview"
                  style={{width:'100%', height:'100%', objectFit:'contain', display:'block'}} />
              </div>
              {/* Footer */}
              <div style={{padding:'6px 8px', borderTop:'1px solid var(--border-dim)'}}>
                <div style={{fontFamily:'var(--font-card)', fontSize:'8px', letterSpacing:'1px',
                  color:'var(--text)', textTransform:'uppercase', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {data.tokenName}
                </div>
              </div>
            </div>
            <div style={{fontFamily:'var(--font-body)', fontSize:'10px', color:'var(--text-dim)',
              marginTop:6, lineHeight:1.5}}>
              actual display in wallets
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 3 — Artist Details (optional metadata)
// ─────────────────────────────────────────────────────────────────
function Step3({ data, onNext, onBack }) {
  const [handle, setHandle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [inscription, setInscription] = useState('');
  const [unatAgreement, setUnatAgreement] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const [audioResult, setAudioResult]     = useState(null); // {url, hash, mime}
  const [audioErr, setAudioErr]           = useState('');
  const [audioUploading, setAudioUploading] = useState(false);
  const audioRef = useRef();

  const [videoResult, setVideoResult]     = useState(null); // {url, hash, mime}
  const [videoErr, setVideoErr]           = useState('');
  const [videoUploading, setVideoUploading] = useState(false);
  const videoRef = useRef();

  const INSC_RE = /^[0-9a-fA-F]{64}$/;

  async function handleAudioUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const AUDIO_OK = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4'];
    if (!AUDIO_OK.includes(f.type)) { setAudioErr('Must be MP3, WAV, OGG, FLAC, or M4A'); return; }
    if (f.size > 15 * 1024 * 1024) { setAudioErr('Audio must be under 15 MB'); return; }
    setAudioUploading(true); setAudioErr('');
    try {
      const form = new FormData();
      form.append('file', f);
      form.append('tokenName', data.tokenName);
      const res  = await fetch('/api/upload-art', { method: 'POST', body: form });
      const json = await res.json();
      if (json.ok) setAudioResult({ url: json.url, hash: json.hash || '', mime: f.type });
      else         setAudioErr(json.error || 'Upload failed');
    } catch { setAudioErr('Network error — please try again'); }
    setAudioUploading(false);
  }

  async function handleVideoUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const VIDEO_OK = ['video/mp4', 'video/webm'];
    if (!VIDEO_OK.includes(f.type)) { setVideoErr('Must be MP4 or WebM'); return; }
    if (f.size > 25 * 1024 * 1024) { setVideoErr('Video must be under 25 MB'); return; }
    setVideoUploading(true); setVideoErr('');
    try {
      const form = new FormData();
      form.append('file', f);
      form.append('tokenName', data.tokenName);
      const res  = await fetch('/api/upload-art', { method: 'POST', body: form });
      const json = await res.json();
      if (json.ok) setVideoResult({ url: json.url, hash: json.hash || '', mime: f.type });
      else         setVideoErr(json.error || 'Upload failed');
    } catch { setVideoErr('Network error — please try again'); }
    setVideoUploading(false);
  }

  function handleContinue() {
    if (!unatAgreement) {
      setErrMsg('You must agree to the UNATPEPE holder allocation before continuing.');
      return;
    }
    if (inscription && !INSC_RE.test(inscription.trim())) {
      setErrMsg('Inscription ID must be 64 hex characters (the reveal txid)');
      return;
    }
    onNext({
      ...data,
      artistHandle:   handle.trim().replace(/^@/, '').slice(0, 64),
      description:    desc.trim().slice(0, 280),
      category:       category.trim().slice(0, 64),
      subcategory:    subcategory.trim().slice(0, 64),
      ordInscription: inscription.trim() || '',
      audioUrl:       audioResult?.url  || '',
      audioMime:      audioResult?.mime || '',
      audioHash:      audioResult?.hash || '',
      videoUrl:       videoResult?.url  || '',
      videoMime:      videoResult?.mime || '',
      videoHash:      videoResult?.hash || '',
    });
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 4 of 6</div>
      <h2 className={styles.stepTitle}>ART D<span>E</span>TAILS</h2>
      <p className={styles.stepDesc}>
        Optional. These appear in wallets and the directory.<br />
        Leave blank to skip.
      </p>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="handle">X/Twitter Handle (optional)</label>
        <input
          id="handle"
          className={styles.tokenInput}
          style={{fontSize:'13px', letterSpacing:'1px', textTransform:'none'}}
          type="text"
          value={handle}
          onChange={e => { setHandle(e.target.value); setErrMsg(''); }}
          placeholder="@yourhandle"
          maxLength={65}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="desc">Description (optional, max 280 chars)</label>
        <textarea
          id="desc"
          value={desc}
          onChange={e => { setDesc(e.target.value.slice(0, 280)); setErrMsg(''); }}
          placeholder="describe your art..."
          rows={3}
          maxLength={280}
          style={{
            fontFamily:'var(--font-body)', fontSize:'12px', padding:'12px', letterSpacing:'0.5px',
            border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)',
            resize:'vertical', width:'100%', boxSizing:'border-box',
          }}
        />
        <div style={{fontFamily:'var(--font-body)', fontSize:'10px', color:'var(--text-dim)', textAlign:'right', marginTop:2}}>
          {desc.length}/280
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="category">Category (optional)</label>
        <input
          id="category"
          className={styles.tokenInput}
          style={{fontSize:'13px', letterSpacing:'1px', textTransform:'none'}}
          type="text"
          value={category}
          onChange={e => { setCategory(e.target.value.slice(0, 64)); setErrMsg(''); }}
          placeholder="e.g. Art"
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="subcategory">Subcategory (optional)</label>
        <input
          id="subcategory"
          className={styles.tokenInput}
          style={{fontSize:'13px', letterSpacing:'1px', textTransform:'none'}}
          type="text"
          value={subcategory}
          onChange={e => { setSubcategory(e.target.value.slice(0, 64)); setErrMsg(''); }}
          placeholder="e.g. Rare Pepe"
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="insc">Ordinals Inscription ID (optional)</label>
        <input
          id="insc"
          className={styles.tokenInput}
          style={{fontSize:'11px', letterSpacing:'1px', textTransform:'lowercase'}}
          type="text"
          value={inscription}
          onChange={e => { setInscription(e.target.value.trim()); setErrMsg(''); }}
          placeholder="64-char hex txid of the Ordinals inscription reveal"
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
        />
        <div className={styles.inputHint}>
          If your art is inscribed on Bitcoin Ordinals, paste the reveal txid here.
        </div>
        {errMsg && <div className={styles.inputError}>{errMsg}</div>}
      </div>

      {/* ── Optional: Audio upload ── */}
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Audio Track — optional (MP3, WAV, OGG · max 15 MB)</label>
        <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
          <button
            type="button"
            className={styles.backBtn}
            style={{margin:0}}
            onClick={() => audioRef.current?.click()}
            disabled={audioUploading}
          >
            {audioUploading ? 'uploading...' : audioResult ? 'change file' : 'select audio'}
          </button>
          {audioResult && !audioUploading && (
            <span style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px', color:'var(--green)'}}>✓ uploaded</span>
          )}
        </div>
        <input ref={audioRef} type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/mp4"
          style={{display:'none'}} onChange={handleAudioUpload} />
        {audioErr && <div className={styles.inputError}>{audioErr}</div>}
        {audioResult && (
          <audio controls src={audioResult.url} style={{marginTop:10, width:'100%', maxWidth:340}} />
        )}
        <div className={styles.inputHint}>
          Stored on the UNATRARE network · appears in wallets that support audio cards (like GHOSTFAKE)
        </div>
      </div>

      {/* ── Optional: Video upload ── */}
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Video — optional (MP4, WebM · max 25 MB)</label>
        <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
          <button
            type="button"
            className={styles.backBtn}
            style={{margin:0}}
            onClick={() => videoRef.current?.click()}
            disabled={videoUploading}
          >
            {videoUploading ? 'uploading...' : videoResult ? 'change file' : 'select video'}
          </button>
          {videoResult && !videoUploading && (
            <span style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px', color:'var(--green)'}}>✓ uploaded</span>
          )}
        </div>
        <input ref={videoRef} type="file" accept="video/mp4,video/webm"
          style={{display:'none'}} onChange={handleVideoUpload} />
        {videoErr && <div className={styles.inputError}>{videoErr}</div>}
        {videoResult && (
          <video controls loop playsInline src={videoResult.url}
            style={{marginTop:10, width:'100%', maxWidth:340, maxHeight:200, display:'block', border:'1px solid var(--border)'}} />
        )}
        <div className={styles.inputHint}>
          Stored on the UNATRARE network · appears in wallets that support video cards (like PEPELEVANDAL)
        </div>
      </div>

      {/* ── UNATPEPE holder agreement ── */}
      <div style={{
        marginTop: 8, marginBottom: 20,
        padding: '14px 16px',
        border: `1px solid ${unatAgreement ? 'var(--green)' : 'var(--amber)'}`,
        background: unatAgreement ? 'rgba(61,158,61,0.04)' : 'rgba(255,200,0,0.03)',
        transition: 'border-color 0.2s, background 0.2s',
      }}>
        <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px',
          color: unatAgreement ? 'var(--green)' : 'var(--amber)', marginBottom:10}}>
          ★ UNATPEPE HOLDER AGREEMENT
        </div>
        <label style={{display:'flex', gap:12, alignItems:'flex-start', cursor:'pointer'}}>
          <input
            type="checkbox"
            checked={unatAgreement}
            onChange={e => { setUnatAgreement(e.target.checked); setErrMsg(''); }}
            style={{marginTop:3, accentColor:'var(--amber)', width:16, height:16, flexShrink:0, cursor:'pointer'}}
          />
          <span style={{fontFamily:'var(--font-body)', fontSize:'12px', color:'var(--text)', lineHeight:1.7}}>
            I understand that registered <strong>UNATPEPE holders</strong> will each receive one free
            allocation of <strong>{data.tokenName}</strong> before this card is publicly distributed.
            I agree to honor this allocation as a condition of UNATRARE certification.
          </span>
        </label>
      </div>

      <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
        <button className={styles.backBtn} onClick={onBack}>← back</button>
        <button className={styles.nextBtn} onClick={handleContinue}>continue → prove ownership</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 4 — Sign Message (prove ownership)
// ─────────────────────────────────────────────────────────────────
function Step4({ data, onNext, onBack }) {
  const [sig, setSig] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [verifying, setVerifying] = useState(false);

  const challenge = `UNATRARE:${data.tokenName}:${data.owner}`;

  async function handleVerify() {
    if (!sig.trim()) { setErrMsg('Paste your signature'); return; }
    setVerifying(true);
    setErrMsg('');
    try {
      const res = await fetch('/api/verify-sig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: data.owner, message: challenge, signature: sig.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        onNext({ ...data, signature: sig.trim() });
      } else {
        setErrMsg(json.error || 'Signature verification failed');
        setVerifying(false);
      }
    } catch {
      setErrMsg('Network error — please try again');
      setVerifying(false);
    }
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 5 of 6</div>
      <h2 className={styles.stepTitle}>PR<span>O</span>VE OWNERSHIP</h2>
      <p className={styles.stepDesc}>
        Sign the message below with <strong>{data.owner?.slice(0,16)}…</strong><br />
        using your Bitcoin wallet (Electrum, etc.) to prove you own this address.
      </p>

      <div className={styles.urlBox} style={{marginBottom:24}}>
        <div className={styles.urlBoxLabel}>message to sign</div>
        <div className={styles.urlBoxValue} style={{fontSize:12, letterSpacing:1}}>{challenge}</div>
      </div>

      <div style={{marginBottom:20, padding:'12px 16px', border:'1px solid var(--border-dim)', background:'rgba(90,191,90,0.04)'}}>
        <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px', color:'var(--text)', marginBottom:6}}>
          ⚡ HOW TO SIGN IN FREEWALLET
        </div>
        <div style={{fontFamily:'var(--font-body)', fontSize:'12px', color:'var(--text-dim)', lineHeight:1.6}}>
          Menu → Advanced → Sign Message<br />
          Paste the message above → Sign → Copy the result
        </div>
      </div>
      <div style={{marginBottom:20, padding:'12px 16px', border:'1px solid var(--border-dim)', background:'rgba(90,191,90,0.04)'}}>
        <div style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'3px', color:'var(--text)', marginBottom:6}}>
          ⚡ HOW TO SIGN IN ELECTRUM
        </div>
        <div style={{fontFamily:'var(--font-body)', fontSize:'12px', color:'var(--text-dim)', lineHeight:1.6}}>
          Tools → Sign / Verify Message<br />
          Enter your address → paste the message → Sign
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="sig">Your Signature</label>
        <textarea
          id="sig"
          value={sig}
          onChange={e => { setSig(e.target.value); setErrMsg(''); }}
          placeholder="paste base64 signature here"
          rows={4}
          style={{
            fontFamily:'var(--font-card)', fontSize:'11px', padding:'12px', letterSpacing:'1px',
            border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)',
            resize:'vertical', width:'100%', boxSizing:'border-box',
          }}
        />
        {errMsg && <div className={styles.inputError}>{errMsg}</div>}
      </div>

      <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
        <button className={styles.backBtn} onClick={onBack} disabled={verifying}>← back</button>
        <button className={styles.nextBtn} disabled={verifying} onClick={handleVerify}>{verifying ? 'verifying...' : 'verify signature →'}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 5 — Submitted to the Pepempool
// ─────────────────────────────────────────────────────────────────
function Step5({ data }) {
  const [submitState, setSubmitState] = useState('idle'); // idle | loading | ok | error
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function doSubmit() {
      setSubmitState('loading');
      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenName:      data.tokenName,
            owner:          data.owner,
            supply:         data.supply,
            cpVersion:      data.cpVersion || 1,
            artUrl:         data.artUrl,
            artMime:        data.artMime,
            artHash:        data.artHash || '',
            signature:      data.signature,
            artistHandle:   data.artistHandle   || '',
            description:    data.description    || '',
            category:       data.category       || '',
            subcategory:    data.subcategory     || '',
            ordInscription: data.ordInscription || '',
            inviteCode:     data.inviteCode     || '',
            audioUrl:       data.audioUrl       || '',
            audioMime:      data.audioMime      || '',
            audioHash:      data.audioHash      || '',
            videoUrl:       data.videoUrl       || '',
            videoMime:      data.videoMime      || '',
            videoHash:      data.videoHash      || '',
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        // 409 = already submitted — still show success
        if (json.ok || res.status === 409) {
          setSubmitState('ok');
        } else {
          setErrMsg(json.error || 'Submission failed');
          setSubmitState('error');
        }
      } catch {
        if (!cancelled) {
          setErrMsg('Network error — please try again');
          setSubmitState('error');
        }
      }
    }
    doSubmit();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (submitState === 'loading' || submitState === 'idle') {
    return (
      <div className={styles.stepBox}>
        <div className={styles.stepEyebrow}>Entering Pepempool</div>
        <div style={{fontFamily:'var(--font-card)', fontSize:'14px', letterSpacing:'4px',
          color:'var(--amber)', padding:'40px 0', textAlign:'center'}}>
          entering the pepempool...
        </div>
      </div>
    );
  }

  if (submitState === 'error') {
    const isEarlyAccess = errMsg === 'EARLY_ACCESS';
    return (
      <div className={styles.stepBox}>
        <div className={styles.stepEyebrow}>{isEarlyAccess ? 'Holders Only' : 'Error'}</div>
        {isEarlyAccess ? (
          <>
            <h2 className={styles.stepTitle}>EARLY<span> </span>ACCESS</h2>
            <p className={styles.stepDesc}>
              Submissions are currently open to <strong>UNATPEPE holders only</strong>.<br />
              Register your address to unlock early access + a {parseInt(process.env.NEXT_PUBLIC_UNAT_DISCOUNT || '20')}% discount on every drop.
            </p>
            <a href="/register" className={styles.nextBtn} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 12 }}>
              register as holder →
            </a>
            <a href="https://tap3.link" target="_blank" rel="noopener noreferrer" className={styles.nextBtn}
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: 'var(--surface)', color: 'var(--amber)', border: '1px solid var(--amber)' }}>
              get unatpepe at tap3.link ↗
            </a>
          </>
        ) : (
          <>
            <div style={{fontFamily:'var(--font-body)', fontSize:'13px', color:'var(--red)', marginBottom:16}}>
              {errMsg}
            </div>
            <button className={styles.nextBtn} onClick={() => setSubmitState('idle')}>
              try again →
            </button>
          </>
        )}
      </div>
    );
  }

  // 'ok' — in the pepempool
  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>You Are In The Pepempool</div>
      <h2 className={styles.stepTitle}>SUBM<span>I</span>TTED</h2>

      {/* Mystery card */}
      <div style={{border:'1px solid var(--amber)', background:'var(--surface)', width:160, margin:'24px auto'}}>
        <div style={{height:22, borderBottom:'1px solid var(--amber)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
          <span style={{fontFamily:'var(--font-card)', fontSize:'7px', letterSpacing:'2px', color:'var(--amber)'}}>UNATRARE</span>
          <span style={{color:'var(--text-dim)', fontSize:'8px'}}>·</span>
          <span style={{fontFamily:'var(--font-card)', fontSize:'7px', letterSpacing:'2px', color:'var(--text-dim)'}}>UNDER REVIEW</span>
        </div>
        <div style={{width:'100%', aspectRatio:'5/7', background:'var(--bg)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8}}>
          <div style={{fontSize:48, opacity:0.25}}>?</div>
          <div style={{fontFamily:'var(--font-card)', fontSize:'8px', letterSpacing:'2px',
            color:'var(--text-dim)', textAlign:'center', padding:'0 8px', lineHeight:1.6}}>
            ART HIDDEN<br/>UNTIL VERDICT
          </div>
        </div>
        <div style={{padding:'6px 8px', borderTop:'1px solid var(--border-dim)'}}>
          <div style={{fontFamily:'var(--font-card)', fontSize:'8px', letterSpacing:'1px',
            color:'var(--text)', textTransform:'uppercase', overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {data.tokenName}
          </div>
        </div>
      </div>

      <p className={styles.stepDesc}>
        <strong>{data.tokenName}</strong> is now in the Pepempool.<br />
        The 6-judge council is evaluating your art against five criteria:<br />
        <span style={{fontFamily:'var(--font-card)',fontSize:'10px',letterSpacing:'2px',color:'var(--amber)',display:'block',marginTop:8,lineHeight:2}}>
          INEVITABILITY · MEMETIC DENSITY · CRAFT · CULTURAL CONTINUITY · ARCHIVAL VALUE
        </span>
        <span style={{display:'block',marginTop:8}}>Threshold: 42/69 to certify. Results appear live on the <Link href="/" style={{color:'var(--amber)',textDecoration:'none'}}>verdict feed →</Link></span>
      </p>

      <div className={styles.urlBox}>
        <div className={styles.urlBoxLabel}>your status url</div>
        <div className={styles.urlBoxValue} style={{fontSize:11}}>{buildUrl(data.tokenName)}</div>
        <div className={styles.urlBoxMeta}>returns pending until verdict · art hidden until approved</div>
      </div>

      <div style={{marginTop:24, display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center'}}>
        <Link href="/" style={{
          fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
          color:'var(--text-dim)', textDecoration:'none',
          border:'1px solid var(--border)', padding:'10px 20px',
        }}>
          ← back to pepempool
        </Link>
        <Link href={`/status?token=${encodeURIComponent(data.tokenName)}`} style={{
          fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
          color:'var(--amber)', textDecoration:'none',
          border:'1px solid var(--amber)', padding:'10px 20px',
        }}>
          check status →
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Main wizard
// ─────────────────────────────────────────────────────────────────
function SubmitWizard() {
  const searchParams = useSearchParams();
  const vaultHash = searchParams.get('vault_hash') || '';
  const vaultMime = searchParams.get('vault_mime') || '';

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(
    vaultHash ? { vaultHash, vaultMime } : {}
  );

  function handleNext(newData) {
    setFormData(prev => ({ ...prev, ...newData }));
    setCurrentStep(s => s + 1);
  }

  function handleBack() {
    setCurrentStep(s => Math.max(0, s - 1));
  }

  return (
    <>
      <Nav />
      <main className={styles.page} style={{paddingTop:80}}>
        {/* Pepe Wizard header */}
        <div style={{textAlign:'center', paddingTop:16, paddingBottom:4}}>
          <div style={{fontFamily:'var(--font-display)', fontSize:22, letterSpacing:6, color:'var(--amber)'}}>PEPE WIZARD</div>
        </div>
        {/* Progress bar */}
        <nav className={styles.progress} aria-label="submission steps">
          {STEPS.map((s, i) => (
            <div key={s.num} style={{display:'flex', alignItems:'center', flex:1}}>
              <div className={styles.step}>
                <div className={`${styles.stepNum} ${
                  currentStep === s.num ? styles.active :
                  currentStep > s.num ? styles.done : ''
                }`}>
                  {currentStep > s.num ? '✓' : s.num}
                </div>
                <div className={`${styles.stepLabel} ${
                  currentStep === s.num ? styles.active :
                  currentStep > s.num ? styles.done : ''
                }`}>{s.label}</div>
              </div>
              {i < STEPS.length - 1 && <div className={styles.stepConnector} />}
            </div>
          ))}
        </nav>

        {/* Step components */}
        {currentStep === 0 && <Step0 onNext={handleNext} isVault={!!formData.vaultHash} />}
        {currentStep === 1 && <Step1 data={formData} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 2 && <Step2 data={formData} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 3 && <Step3 data={formData} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 4 && <Step4 data={formData} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 5 && <Step5 data={formData} />}

      </main>
    </>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitWizard />
    </Suspense>
  );
}
