'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './submit.module.css';

const STEPS = [
  { num: 0, label: 'Get URL' },
  { num: 1, label: 'Verify' },
  { num: 2, label: 'Upload Art' },
  { num: 3, label: 'Details' },
  { num: 4, label: 'Sign' },
  { num: 5, label: 'Pay Fee' },
  { num: 6, label: 'Done' },
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

// ─────────────────────────────────────────────────────────────────
//  Step 0 — Get Your Metadata URL
// ─────────────────────────────────────────────────────────────────
function Step0({ onNext }) {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

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
      <div className={styles.stepEyebrow}>Step 0 of 6</div>
      <h2 className={styles.stepTitle}>GET Y<span>O</span>UR URL</h2>
      <p className={styles.stepDesc}>
        <strong>Before you create your Counterparty token</strong>, you need your metadata URL.<br />
        Enter the token name you plan to register below. Copy the URL.<br />
        Then go to Counterparty and paste it into the <strong>description field</strong> of your token.
        <br /><br />
        <strong>If you create the token before getting this URL, your art will not be visible in wallets.</strong>
      </p>

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
            <div className={styles.warningTitle}>⚠ important — read before creating token</div>
            <div className={styles.warningText}>
              1. Copy the URL above.<br />
              2. Go to Counterparty (Freewallet, Rarepepewallet, etc.).<br />
              3. Create your token with <strong>name exactly: {result.normalized}</strong><br />
              4. Paste the URL into the <strong>Description</strong> field.<br />
              5. Set supply between <strong>1–21,000</strong>. Non-divisible. Locked.<br />
              6. Return here and click Continue to submit your art.
            </div>
          </div>

          <button
            className={styles.nextBtn}
            onClick={() => onNext({ tokenName: result.normalized })}
          >
            i created the token → continue
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 1 — Verify Token on Counterparty
// ─────────────────────────────────────────────────────────────────
function Step1({ data, onNext }) {
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
      <div className={styles.stepEyebrow}>Step 1 of 6</div>
      <h2 className={styles.stepTitle}>VERIF<span>Y</span> TOKEN</h2>
      <p className={styles.stepDesc}>
        We check that <strong>{data.tokenName}</strong> exists on Counterparty,
        is locked, non-divisible, and has a supply between 1 and 21,000.
      </p>

      {status === 'idle' && (
        <button className={styles.nextBtn} onClick={verify}>
          verify {data.tokenName} →
        </button>
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

      {status === 'ok' && result && (
        <>
          <div className={styles.urlBox} style={{borderColor:'var(--green)'}}>
            <div className={styles.urlBoxLabel}>token confirmed</div>
            <div className={styles.urlBoxValue}>{data.tokenName}</div>
            <div className={styles.urlBoxMeta}>
              Supply: {result.supply} · Owner: {result.owner?.slice(0,12)}…
            </div>
          </div>
          <button className={styles.nextBtn} onClick={() => onNext({ ...data, owner: result.owner, supply: result.supply })}>
            continue → upload art
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 2 — Upload Art + Card Preview
// ─────────────────────────────────────────────────────────────────
function Step2({ data, onNext }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const fileRef = useRef();

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['image/png','image/jpeg','image/gif','image/webp'];
    if (!allowed.includes(f.type)) {
      setErrMsg('File must be PNG, JPG, GIF, or WebP');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg('File must be under 10 MB');
      return;
    }
    setErrMsg('');
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
      const json = await res.json();
      if (json.ok) {
        onNext({ ...data, artUrl: json.url, artMime: file.type });
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
      <div className={styles.stepEyebrow}>Step 2 of 6</div>
      <h2 className={styles.stepTitle}>UPL<span>O</span>AD ART</h2>
      <p className={styles.stepDesc}>
        Upload the art for <strong>{data.tokenName}</strong>.<br />
        PNG, JPG, GIF, or WebP. Max 10 MB.<br />
        Recommended: 400×560px (trading card ratio) or square.
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
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp"
            style={{display:'none'}} onChange={handleFile} />

          {errMsg && <div className={styles.inputError}>{errMsg}</div>}

          {file && !uploading && (
            <button className={styles.nextBtn} onClick={handleUpload}>
              upload + continue →
            </button>
          )}
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
function Step3({ data, onNext }) {
  const [handle, setHandle] = useState('');
  const [desc, setDesc] = useState('');
  const [inscription, setInscription] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const INSC_RE = /^[0-9a-fA-F]{64}$/;

  function handleContinue() {
    if (inscription && !INSC_RE.test(inscription.trim())) {
      setErrMsg('Inscription ID must be 64 hex characters (the reveal txid)');
      return;
    }
    onNext({
      ...data,
      artistHandle:   handle.trim().replace(/^@/, '').slice(0, 64),
      description:    desc.trim().slice(0, 280),
      ordInscription: inscription.trim() || '',
    });
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 3 of 6</div>
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

      <button className={styles.nextBtn} onClick={handleContinue}>
        continue → prove ownership
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 4 — Sign Message (prove ownership)
// ─────────────────────────────────────────────────────────────────
function Step4({ data, onNext }) {
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
      <div className={styles.stepEyebrow}>Step 4 of 6</div>
      <h2 className={styles.stepTitle}>PR<span>O</span>VE OWNERSHIP</h2>
      <p className={styles.stepDesc}>
        Sign the message below with <strong>{data.owner?.slice(0,16)}…</strong><br />
        using your Bitcoin wallet (Electrum, etc.) to prove you own this address.
      </p>

      <div className={styles.urlBox} style={{marginBottom:24}}>
        <div className={styles.urlBoxLabel}>message to sign</div>
        <div className={styles.urlBoxValue} style={{fontSize:12, letterSpacing:1}}>{challenge}</div>
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

      <button className={styles.nextBtn} disabled={verifying} onClick={handleVerify}>
        {verifying ? 'verifying...' : 'verify signature →'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 5 — Pay Submission Fee
// ─────────────────────────────────────────────────────────────────
function Step5({ data, onNext }) {
  const [txid, setTxid] = useState('');
  const [currency, setCurrency] = useState('NAT');
  const [confirming, setConfirming] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [unatStatus, setUnatStatus] = useState(null);
  const [payConfig, setPayConfig] = useState(null); // from /api/payment-config

  // Load payment config (addresses + amounts from server env)
  useEffect(() => {
    fetch('/api/payment-config')
      .then(r => r.json())
      .then(json => setPayConfig(json))
      .catch(() => {});
  }, []);

  // Check UNAT holdings
  useEffect(() => {
    if (!data.owner) return;
    fetch(`/api/check-unat?address=${encodeURIComponent(data.owner)}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setUnatStatus(json); })
      .catch(() => {});
  }, [data.owner]);

  const discount = unatStatus?.holdsUnat
    ? (payConfig?.discount ?? unatStatus.discount ?? 20)
    : 0;

  function displayAmount(c) {
    const cfg = payConfig?.[c];
    if (!cfg) return '…';
    const base = cfg.amount;
    if (discount > 0) {
      const discounted = base * (1 - discount / 100);
      const fmt = Number.isInteger(discounted)
        ? discounted
        : discounted.toFixed(8).replace(/\.?0+$/, '');
      return `${fmt} ${cfg.unit}`;
    }
    return `${base} ${cfg.unit}`;
  }

  function addressFor(c) {
    return payConfig?.[c]?.address || null;
  }

  async function handleConfirm() {
    if (!txid.trim()) { setErrMsg('Paste your transaction ID'); return; }
    setConfirming(true);
    setErrMsg('');
    try {
      const res = await fetch('/api/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenName: data.tokenName, txid: txid.trim(), currency }),
      });
      const json = await res.json();
      if (json.ok) {
        onNext({ ...data, txid: txid.trim(), currency });
      } else {
        setErrMsg(json.error || 'Payment not confirmed');
        setConfirming(false);
      }
    } catch {
      setErrMsg('Network error — please try again');
      setConfirming(false);
    }
  }

  const addr = addressFor(currency);
  const loading = !payConfig;

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Step 5 of 6</div>
      <h2 className={styles.stepTitle}>PAY F<span>E</span>E</h2>
      <p className={styles.stepDesc}>
        One-time submission fee. Choose your currency.
      </p>

      {/* UNAT holder discount badge */}
      {unatStatus?.holdsUnat && (
        <div className={styles.urlBox} style={{borderColor:'var(--green)', marginBottom:20}}>
          <div className={styles.urlBoxLabel}>unat pepe holder detected</div>
          <div className={styles.urlBoxValue} style={{color:'var(--green-hot)'}}>
            {discount}% discount applied
          </div>
          <div className={styles.urlBoxMeta}>
            balance: {unatStatus.balance} {unatStatus.token}
          </div>
        </div>
      )}

      <div style={{display:'flex', gap:8, marginBottom:24}}>
        {['NAT','PEPECASH','BTC'].map(c => (
          <button key={c}
            onClick={() => setCurrency(c)}
            style={{
              fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'3px',
              padding:'8px 16px', border:`1px solid ${currency === c ? 'var(--amber)' : 'var(--border)'}`,
              background: currency === c ? 'rgba(139,115,85,0.1)' : 'var(--bg)',
              color: currency === c ? 'var(--amber)' : 'var(--text-dim)', cursor:'pointer',
            }}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px', color:'var(--text-dim)', marginBottom:24}}>
          loading payment details...
        </div>
      ) : !addr ? (
        <div className={styles.urlBox} style={{borderColor:'var(--red)', marginBottom:24}}>
          <div className={styles.urlBoxLabel} style={{color:'var(--red)'}}>payment address not configured</div>
          <div className={styles.urlBoxMeta}>The site operator has not set up a payment address yet. Check back soon or contact us on Twitter.</div>
        </div>
      ) : (
        <div className={styles.urlBox} style={{marginBottom:24}}>
          <div className={styles.urlBoxLabel}>send exactly</div>
          <div className={styles.urlBoxValue}>{displayAmount(currency)}</div>
          {discount > 0 && (
            <div className={styles.urlBoxMeta} style={{color:'var(--green)'}}>
              {discount}% holder discount applied
            </div>
          )}
          <div className={styles.urlBoxLabel} style={{marginTop:8}}>to address</div>
          <div className={styles.urlBoxValue} style={{fontSize:11}}>{addr}</div>
        </div>
      )}

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel} htmlFor="txid">Transaction ID</label>
        <input
          id="txid"
          className={styles.tokenInput}
          style={{fontSize:'12px', letterSpacing:'1px', textTransform:'none'}}
          type="text"
          value={txid}
          onChange={e => { setTxid(e.target.value.trim()); setErrMsg(''); }}
          placeholder="paste txid here"
          autoComplete="off"
          spellCheck={false}
        />
        {errMsg && <div className={styles.inputError}>{errMsg}</div>}
      </div>

      <button className={styles.nextBtn} disabled={confirming || !addr} onClick={handleConfirm}>
        {confirming ? 'confirming...' : 'confirm payment →'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Step 6 — Confirmation (writes to DB via /api/submit)
// ─────────────────────────────────────────────────────────────────
function Step6({ data }) {
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
            signature:      data.signature,
            txid:           data.txid,
            currency:       data.currency,
            artistHandle:   data.artistHandle   || '',
            description:    data.description    || '',
            ordInscription: data.ordInscription || '',
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.ok) {
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

  if (submitState === 'loading') {
    return (
      <div className={styles.stepBox}>
        <div className={styles.stepEyebrow}>Finalising</div>
        <div style={{fontFamily:'var(--font-card)', fontSize:'14px', letterSpacing:'4px', color:'var(--amber)', padding:'24px 0'}}>
          submitting to the scientist panel...
        </div>
      </div>
    );
  }

  if (submitState === 'error') {
    return (
      <div className={styles.stepBox}>
        <div className={styles.stepEyebrow}>Error</div>
        <div style={{fontFamily:'var(--font-body)', fontSize:'13px', color:'var(--red)', marginBottom:16}}>
          {errMsg}
        </div>
        <button className={styles.nextBtn} onClick={() => setSubmitState('idle')}>
          try again →
        </button>
      </div>
    );
  }

  return (
    <div className={styles.stepBox}>
      <div className={styles.stepEyebrow}>Submission Complete</div>
      <h2 className={styles.stepTitle}>SUBM<span>I</span>TTED</h2>
      <p className={styles.stepDesc}>
        <strong>{data.tokenName}</strong> is now in the Pepe Mempool.<br />
        The scientist panel will review your submission.<br />
        Results are final. There is no appeal.
      </p>

      <div className={styles.urlBox} style={{borderColor:'var(--green)'}}>
        <div className={styles.urlBoxLabel}>your metadata url (live now)</div>
        <div className={styles.urlBoxValue}>{buildUrl(data.tokenName)}</div>
        <div className={styles.urlBoxMeta}>returns {`{"status":"pending"}`} until judgment</div>
      </div>

      <div style={{marginTop:24, display:'flex', gap:16}}>
        <Link href="/" style={{
          fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
          color:'var(--text-dim)', textDecoration:'none',
          border:'1px solid var(--border)', padding:'10px 20px',
        }}>
          ← back to mempool
        </Link>
        <Link href="/directory" style={{
          fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
          color:'var(--text-dim)', textDecoration:'none',
          border:'1px solid var(--border)', padding:'10px 20px',
        }}>
          view directory →
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Main wizard
// ─────────────────────────────────────────────────────────────────
export default function SubmitPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});

  function handleNext(newData) {
    setFormData(prev => ({ ...prev, ...newData }));
    setCurrentStep(s => s + 1);
  }

  return (
    <>
      <Nav />
      <main className={styles.page} style={{paddingTop:80}}>

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
        {currentStep === 0 && <Step0 onNext={handleNext} />}
        {currentStep === 1 && <Step1 data={formData} onNext={handleNext} />}
        {currentStep === 2 && <Step2 data={formData} onNext={handleNext} />}
        {currentStep === 3 && <Step3 data={formData} onNext={handleNext} />}
        {currentStep === 4 && <Step4 data={formData} onNext={handleNext} />}
        {currentStep === 5 && <Step5 data={formData} onNext={handleNext} />}
        {currentStep === 6 && <Step6 data={formData} />}

      </main>
    </>
  );
}
