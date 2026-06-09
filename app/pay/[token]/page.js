'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { QRCodeSVG } from 'qrcode.react';
import styles from '../../submit/submit.module.css';

function buildUrl(tokenName) {
  return `https://unatrare.wtf/c/${tokenName}.json`;
}

// ── Payment form (extracted from old submit Step 5) ──────────────
function PaymentForm({ tokenData, tokenName }) {
  const [payConfig, setPayConfig] = useState(null);
  const [unatStatus, setUnatStatus] = useState(null);
  const [currency, setCurrency] = useState('NAT');
  const [txid, setTxid] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    fetch('/api/payment-config').then(r => r.json()).then(setPayConfig).catch(() => {});
    if (tokenData?.artistAddress) {
      fetch(`/api/check-unat?address=${encodeURIComponent(tokenData.artistAddress)}`)
        .then(r => r.json())
        .then(json => { if (json.ok) setUnatStatus(json); })
        .catch(() => {});
    }
  }, [tokenData]);

  if (paid) {
    return (
      <div className={styles.stepBox}>
        <div className={styles.stepEyebrow}>Payment Confirmed</div>
        <h2 className={styles.stepTitle}>ENR<span>O</span>LLED</h2>
        <p className={styles.stepDesc}>
          <strong>{tokenName}</strong> is fully enrolled in the UNATRARE directory.<br />
          Your art will appear once the directory is updated.
        </p>
        <div className={styles.urlBox} style={{borderColor:'var(--green)'}}>
          <div className={styles.urlBoxLabel}>your metadata url (live now)</div>
          <div className={styles.urlBoxValue} style={{fontSize:11}}>{buildUrl(tokenName)}</div>
        </div>
        <div style={{marginTop:24}}>
          <Link href="/" style={{
            fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
            color:'var(--text-dim)', textDecoration:'none',
            border:'1px solid var(--border)', padding:'10px 20px',
          }}>
            ← back to mempool
          </Link>
        </div>
      </div>
    );
  }

  const discount = unatStatus?.holdsUnat
    ? (payConfig?.discount ?? unatStatus.discount ?? 20)
    : 0;

  function displayAmount(c) {
    const cfg = payConfig?.[c];
    if (!cfg) return '…';
    const base = cfg.amount;
    if (discount > 0) {
      const d = base * (1 - discount / 100);
      const fmt = Number.isInteger(d) ? d : d.toFixed(8).replace(/\.?0+$/, '');
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
        body: JSON.stringify({ tokenName, txid: txid.trim(), currency }),
      });
      const json = await res.json();
      if (json.ok) {
        setPaid(true);
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
      <div className={styles.stepEyebrow}>Enrollment Fee</div>
      <h2 className={styles.stepTitle}>PAY F<span>E</span>E</h2>
      <p className={styles.stepDesc}>
        <strong>{tokenName}</strong> has been certified DANK.<br />
        Pay the one-time enrollment fee to take your place in the directory.
      </p>

      {unatStatus?.holdsUnat && (
        <div className={styles.urlBox} style={{borderColor:'var(--green)', marginBottom:20}}>
          <div className={styles.urlBoxLabel}>unat pepe holder detected</div>
          <div className={styles.urlBoxValue} style={{color:'var(--green-hot)'}}>
            {discount}% discount applied
          </div>
          <div className={styles.urlBoxMeta}>balance: {unatStatus.balance} {unatStatus.token}</div>
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
        <div style={{fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
          color:'var(--text-dim)', marginBottom:24}}>
          loading payment details...
        </div>
      ) : !addr ? (
        <div className={styles.urlBox} style={{borderColor:'var(--red)', marginBottom:24}}>
          <div className={styles.urlBoxLabel} style={{color:'var(--red)'}}>payment address not configured</div>
          <div className={styles.urlBoxMeta}>Contact us on X to arrange payment.</div>
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
          <div style={{marginTop:16, display:'flex', justifyContent:'center'}}>
            <div style={{
              background:'#fff', padding:10, display:'inline-block',
              border:'1px solid var(--border)'
            }}>
              <QRCodeSVG value={addr} size={140} bgColor="#ffffff" fgColor="#000000" level="M" />
            </div>
          </div>
          <div style={{
            marginTop:10, fontFamily:'var(--font-card)', fontSize:'8px',
            letterSpacing:'2px', color:'var(--text-dim)', textAlign:'center'
          }}>
            scan to copy address
          </div>
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

// ── Main pay page ─────────────────────────────────────────────────
export default function PayPage({ params }) {
  const [tokenName, setTokenName] = useState(null);
  const [pageState, setPageState] = useState('loading'); // loading | pending | approved | paid | rejected | notfound | error
  const [tokenData, setTokenData] = useState(null);

  useEffect(() => {
    Promise.resolve(params).then(p => {
      const name = p?.token?.toUpperCase();
      setTokenName(name);
      if (!name) { setPageState('notfound'); return; }
      fetch(`/api/token-status/${name}`)
        .then(r => r.json())
        .then(json => {
          if (!json.ok) { setPageState('notfound'); return; }
          setTokenData(json);
          if (json.paymentTxid) {
            setPageState('paid');
          } else {
            setPageState(json.status); // 'pending', 'approved', 'rejected'
          }
        })
        .catch(() => setPageState('error'));
    });
  }, [params]);

  return (
    <>
      <Nav />
      <main style={{paddingTop:80, maxWidth:600, margin:'0 auto', padding:'80px 16px 64px'}}>
        {pageState === 'loading' && (
          <div style={{fontFamily:'var(--font-card)', fontSize:'12px', letterSpacing:'4px',
            color:'var(--amber)', textAlign:'center', padding:'60px 0'}}>
            checking status...
          </div>
        )}

        {pageState === 'notfound' && (
          <div style={{fontFamily:'var(--font-card)', fontSize:'12px', letterSpacing:'3px',
            color:'var(--text-dim)', textAlign:'center', padding:'60px 0'}}>
            <div style={{fontSize:'11px', marginBottom:16}}>TOKEN NOT FOUND</div>
            <Link href="/" style={{color:'var(--amber)', textDecoration:'none'}}>← back to mempool</Link>
          </div>
        )}

        {pageState === 'error' && (
          <div style={{fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
            color:'var(--red)', textAlign:'center', padding:'60px 0'}}>
            network error — try refreshing
          </div>
        )}

        {pageState === 'pending' && (
          <div style={{fontFamily:'var(--font-card)', textAlign:'center', padding:'60px 0'}}>
            <div style={{fontSize:'11px', letterSpacing:'4px', color:'var(--amber)', marginBottom:16}}>
              AWAITING VERDICT
            </div>
            <div style={{fontSize:'40px', opacity:0.2, marginBottom:16}}>?</div>
            <div style={{fontSize:'10px', letterSpacing:'3px', color:'var(--text-dim)', lineHeight:2}}>
              {tokenName}<br />
              UNDER REVIEW BY THE SCIENTIST PANEL<br />
              YOU WILL BE CONTACTED IF CERTIFIED DANK
            </div>
            <div style={{marginTop:24}}>
              <Link href="/" style={{fontFamily:'var(--font-card)', fontSize:'10px',
                letterSpacing:'3px', color:'var(--text-dim)', textDecoration:'none',
                border:'1px solid var(--border)', padding:'8px 16px'}}>
                ← back to mempool
              </Link>
            </div>
          </div>
        )}

        {pageState === 'rejected' && (
          <div style={{fontFamily:'var(--font-card)', textAlign:'center', padding:'60px 0'}}>
            <div style={{fontSize:'11px', letterSpacing:'4px', color:'var(--red)', marginBottom:16}}>
              NOT CERTIFIED
            </div>
            <div style={{fontSize:'10px', letterSpacing:'2px', color:'var(--text-dim)',
              lineHeight:2, maxWidth:400, margin:'0 auto'}}>
              {tokenName} did not pass the UNATRARE Pepe Council.
            </div>
            {tokenData?.rejectionReason && (
              <div style={{marginTop:16, padding:'12px', border:'1px solid var(--border)',
                textAlign:'left', fontSize:'11px', color:'var(--text-dim)',
                fontFamily:'var(--font-body)', lineHeight:1.6}}>
                {tokenData.rejectionReason}
              </div>
            )}
            <div style={{marginTop:24}}>
              <Link href="/" style={{fontFamily:'var(--font-card)', fontSize:'10px',
                letterSpacing:'3px', color:'var(--text-dim)', textDecoration:'none',
                border:'1px solid var(--border)', padding:'8px 16px'}}>
                ← back to mempool
              </Link>
            </div>
          </div>
        )}

        {pageState === 'paid' && (
          <div style={{fontFamily:'var(--font-card)', textAlign:'center', padding:'60px 0'}}>
            <div style={{fontSize:'11px', letterSpacing:'4px', color:'var(--green)', marginBottom:16}}>
              FULLY ENROLLED
            </div>
            <div style={{fontSize:'10px', letterSpacing:'2px', color:'var(--text-dim)', lineHeight:2}}>
              {tokenName}<br />
              PAYMENT CONFIRMED · IN THE DIRECTORY
            </div>
            <div style={{marginTop:16, fontSize:'9px', letterSpacing:'2px', color:'var(--text-dim)'}}>
              Paid with {tokenData?.paymentCurrency}
            </div>
            <div style={{marginTop:24}}>
              <Link href="/directory" style={{fontFamily:'var(--font-card)', fontSize:'10px',
                letterSpacing:'3px', color:'var(--amber)', textDecoration:'none',
                border:'1px solid var(--amber)', padding:'8px 16px'}}>
                view directory →
              </Link>
            </div>
          </div>
        )}

        {/* Enrollment fee not yet activated. To activate: restore <PaymentForm> here. */}
        {pageState === 'approved' && (
          <div className={styles.stepBox}>
            <div className={styles.stepEyebrow}>Coming Soon</div>
            <h2 className={styles.stepTitle}>ENR<span>O</span>LLMENT</h2>
            <p className={styles.stepDesc}>
              <strong>{tokenName}</strong> is certified DANK.<br />
              Enrollment fee activation is coming soon — your spot is reserved.
            </p>
            <div style={{marginTop:24}}>
              <Link href="/" style={{
                fontFamily:'var(--font-card)', fontSize:'11px', letterSpacing:'3px',
                color:'var(--text-dim)', textDecoration:'none',
                border:'1px solid var(--border)', padding:'10px 20px',
              }}>
                ← back to mempool
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
