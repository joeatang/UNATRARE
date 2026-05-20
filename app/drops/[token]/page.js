'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../components/Nav';

// ── Shared utils ──────────────────────────────────────────────────────────
function useCountdown(ts) {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    if (!ts) return;
    const tick = () => {
      const diff = ts - Math.floor(Date.now() / 1000);
      setSecs(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ts]);
  return secs;
}

function fmtTime(s) {
  if (s === null || s < 0) return '--:--:--';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

const ROMAN = { 0: '0', 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X' };
function toRoman(n) { return ROMAN[n] || String(n); }

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const TXID_RE = /^[a-fA-F0-9]{64}$/;

const STATUS_COPY = {
  eligible:               { label: '◈ ELIGIBLE',                color: 'var(--amber)',     desc: 'Your address qualifies. Proceed to claim.' },
  claimed:                { label: '◉ CLAIM REGISTERED',        color: 'var(--amber)',     desc: 'Your claim is in the queue.' },
  awaiting_payment:       { label: '⬡ AWAITING PAYMENT',        color: 'var(--amber-hot)', desc: 'Send NAT and submit your txid to complete your claim.' },
  awaiting_distribution:  { label: '◆ AWAITING DISTRIBUTION',   color: 'var(--green)',     desc: 'Claim confirmed. Your card will be sent when the window closes.' },
  sent:                   { label: '✓ SENT',                     color: 'var(--green)',     desc: 'Your Counterparty token has been sent to your receiving address.' },
  expired:                { label: '✗ EXPIRED',                  color: 'var(--text-dim)',  desc: 'This claim window closed without completion.' },
};

// ── Shared inline styles ──────────────────────────────────────────────────
const S = {
  page:       { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '88px 24px 100px', maxWidth: 640, margin: '0 auto' },
  back:       { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', color: 'var(--text-dim)', textDecoration: 'none', display: 'inline-block', marginBottom: 40 },
  eyebrow:    { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '4px', color: 'var(--text-dim)', marginBottom: 8 },
  title:      { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 8vw, 52px)', letterSpacing: 6, lineHeight: 1, color: 'var(--text)', margin: '0 0 4px' },
  artist:     { fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '4px', color: 'var(--text-dim)', marginBottom: 28 },
  timerWrap:  { borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '18px 0', marginBottom: 40, display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' },
  timerLabel: { fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)' },
  timer:      { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 9vw, 60px)', letterSpacing: 4, color: 'var(--amber)', lineHeight: 1 },
  divider:    { border: 'none', borderTop: '1px solid var(--border)', margin: '36px 0' },
  stepLabel:  { fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '4px', color: 'var(--amber)', marginBottom: 6, textTransform: 'uppercase' },
  stepTitle:  { fontFamily: 'var(--font-card)', fontSize: '12px', letterSpacing: '3px', color: 'var(--text)', marginBottom: 10, textTransform: 'uppercase' },
  stepDesc:   { fontFamily: 'var(--font-body)', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-dim)', marginBottom: 18 },
  label:      { display: 'block', fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase' },
  input:      { width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '1px', outline: 'none', marginBottom: 8 },
  errText:    { fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: '#cc4444', marginBottom: 10 },
  btnPrimary: { padding: '12px 28px', border: '1px solid var(--amber)', background: 'transparent', color: 'var(--amber)', fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', cursor: 'pointer', textTransform: 'uppercase' },
  btnOff:     { opacity: 0.35, cursor: 'not-allowed' },
  tierGrid:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', marginBottom: 20 },
  tier:       (sel) => ({ background: sel ? 'rgba(168,144,96,0.12)' : 'var(--bg)', border: sel ? '1px solid var(--amber)' : '1px solid transparent', padding: '16px 12px', textAlign: 'center', cursor: 'pointer', outline: 'none' }),
  tierUsd:    { fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: 2, color: 'var(--text)', display: 'block' },
  tierNat:    { fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', marginTop: 4, display: 'block' },
  payBox:     { border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20, background: 'rgba(168,144,96,0.03)' },
  payLabel:   { fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 6 },
  payAddr:    { fontFamily: 'var(--font-card)', fontSize: '12px', letterSpacing: '1px', color: 'var(--amber)', wordBreak: 'break-all' },
  payAmt:     { fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: 3, color: 'var(--text)', marginTop: 12 },
  statusBox:  (c) => ({ border: `1px solid ${c}`, background: `${c}0a`, padding: '24px', marginTop: 8 }),
  statusLbl:  (c) => ({ fontFamily: 'var(--font-card)', fontSize: '11px', letterSpacing: '3px', color: c, marginBottom: 12 }),
  statusDesc: { fontFamily: 'var(--font-body)', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-dim)' },
  row:        { display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '1px', color: 'var(--text-dim)', padding: '6px 0', borderBottom: '1px solid var(--border)' },
  rowVal:     { color: 'var(--text)' },
  notice:     { border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)', padding: '18px 22px', marginBottom: 32, fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.8 },
  verifyResult: (ok) => ({ border: `1px solid ${ok ? 'var(--green)' : '#cc4444'}`, background: ok ? 'rgba(61,158,61,0.04)' : 'rgba(204,68,68,0.04)', padding: '16px 18px', marginTop: 12, marginBottom: 0 }),
};

// ─────────────────────────────────────────────────────────────────────────
export default function DropClaimPage() {
  const params    = useParams();
  const tokenName = (params?.token || '').toUpperCase();

  // Drop data
  const [drop, setDrop]           = useState(null);
  const [dropLoading, setDropLoading] = useState(true);
  const [dropErr, setDropErr]     = useState('');

  // Step machine: verify → claim → payment → done
  const [step, setStep]           = useState('verify');

  // Step 1 — verify
  const [tapAddress, setTap]      = useState('');
  const [verifyLoading, setVL]    = useState(false);
  const [verifyResult, setVR]     = useState(null);
  const [verifyErr, setVE]        = useState('');

  // Step 2 — claim form
  const [cpAddress, setCp]        = useState('');
  const [selectedTier, setTier]   = useState(null);
  const [claimLoading, setCL]     = useState(false);
  const [claimErr, setCE]         = useState('');
  const [claimResult, setCR]      = useState(null);

  // Step 3 — txid
  const [txid, setTxid]           = useState('');
  const [txidLoading, setTL]      = useState(false);
  const [txidErr, setTE]          = useState('');
  const [txidDone, setTD]         = useState(false);

  const remaining = useCountdown(drop?.window_closes_at);

  // Load drop
  useEffect(() => {
    fetch('/api/drops')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const found = (data.drops || []).find(d => d.token_name === tokenName);
          if (found) setDrop(found);
          else setDropErr('Drop not found.');
        } else {
          setDropErr('Could not load drop.');
        }
      })
      .catch(() => setDropErr('Network error.'))
      .finally(() => setDropLoading(false));
  }, [tokenName]);

  const tiers = drop?.support_tiers ? JSON.parse(drop.support_tiers) : [3, 6, 9];

  const tierNat = (usd) => {
    if (!drop?.nat_price_billion) return 'TBD';
    const n = Math.round(usd / drop.nat_price_billion * 1e9);
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B NAT`;
    if (n >= 1e6) return `${Math.round(n / 1e6)}M NAT`;
    return `${n} NAT`;
  };

  const tierNatRaw = (usd) => {
    if (!drop?.nat_price_billion) return 0;
    return Math.round(usd / drop.nat_price_billion * 1e9);
  };

  // ── Step 1: verify ──
  async function handleVerify(e) {
    e.preventDefault();
    const addr = tapAddress.trim();
    if (!ADDR_RE.test(addr)) return;
    setVL(true);
    setVE('');
    try {
      const res = await fetch('/api/drops/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, drop_id: drop?.id }),
      });
      const json = await res.json();
      if (json.ok) {
        setVR(json);
        if (json.eligible && !json.already_claimed) setStep('claim');
      } else {
        setVE(json.error || 'Verification failed');
      }
    } catch {
      setVE('Network error — try again');
    } finally {
      setVL(false);
    }
  }

  // ── Step 2: register claim ──
  async function handleClaim(e) {
    e.preventDefault();
    const cp = cpAddress.trim();
    if (!ADDR_RE.test(cp)) return;
    if (drop.claim_type === 'support' && !selectedTier) {
      setCE('Select a support tier first.');
      return;
    }
    setCL(true);
    setCE('');
    try {
      const res = await fetch('/api/drops/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drop_id: drop.id,
          tap_address: tapAddress.trim(),
          cp_address: cp,
          claim_type: drop.claim_type,
          support_tier: selectedTier || 0,
          nat_amount: selectedTier ? tierNatRaw(selectedTier) : 0,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setCR(json);
        setStep(json.status === 'awaiting_payment' ? 'payment' : 'done');
      } else {
        setCE(json.error || 'Claim failed');
      }
    } catch {
      setCE('Network error — try again');
    } finally {
      setCL(false);
    }
  }

  // ── Step 3: submit txid ──
  async function handleTxid(e) {
    e.preventDefault();
    const tx = txid.trim();
    if (!TXID_RE.test(tx)) return;
    setTL(true);
    setTE('');
    try {
      const res = await fetch('/api/drops/txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_id: drop.id, tap_address: tapAddress.trim(), txid: tx }),
      });
      const json = await res.json();
      if (json.ok) {
        setTD(true);
        setStep('done');
      } else {
        setTE(json.error || 'Could not submit txid');
      }
    } catch {
      setTE('Network error — try again');
    } finally {
      setTL(false);
    }
  }

  // ── Guards ──
  if (dropLoading) return (
    <>
      <Nav />
      <main style={S.page}>
        <div style={{ ...S.eyebrow, textAlign: 'center', marginTop: 60 }}>loading...</div>
      </main>
    </>
  );

  if (dropErr || !drop) return (
    <>
      <Nav />
      <main style={S.page}>
        <Link href="/drops" style={S.back}>← the claim chamber</Link>
        <div style={{ ...S.stepTitle, color: '#cc4444', marginTop: 20 }}>{dropErr || 'Drop not found.'}</div>
      </main>
    </>
  );

  const isActive   = drop.status === 'active';
  const finalStatus = txidDone ? 'awaiting_distribution' : claimResult?.status;
  const statusInfo  = finalStatus ? STATUS_COPY[finalStatus] : null;

  return (
    <>
      <Nav />
      <main style={S.page}>

        <Link href="/drops" style={S.back}>← the claim chamber</Link>

        {/* ── Drop header ── */}
        <div style={S.eyebrow}>
          DROP {String(drop.id).padStart(3, '0')} · SERIES {drop.series}{drop.card_number ? ` · CARD ${drop.card_number}` : ''} · PHASE {drop.phase ?? 1}
          {drop.claim_type === 'cultural'
            ? '  ·  CULTURAL CLAIM · FREE'
            : `  ·  SUPPORT CLAIM · $${tiers.join('/$')}`}
        </div>
        {drop.art_url && (
          <div style={{ marginBottom: 28 }}>
            <img
              src={drop.art_url}
              alt={drop.token_name}
              style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block', border: '1px solid var(--border)' }}
            />
          </div>
        )}
        <h1 style={S.title}>{drop.title}</h1>
        <div style={S.artist}>by {drop.artist_handle}</div>
        <div style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: 28, lineHeight: 1.8 }}>
          ◈ {drop.claims_count || 0} claimed
          {drop.unatpepe_holders > 0 && <span> · <span style={{ color: 'var(--amber)' }}>{drop.unatpepe_holders} UNATPEPE holders</span></span>}
          {' '}· {drop.supply_remaining ?? drop.supply_total} / {drop.supply_total} remaining
        </div>

        {/* ── Bonus notice ── */}
        {drop.bonus_token && drop.bonus_remaining > 0 && (
          <div style={{
            border: '1px solid var(--green)',
            borderLeft: '3px solid var(--green)',
            background: 'rgba(61,158,61,0.04)',
            padding: '12px 18px',
            marginBottom: 28,
            fontFamily: 'var(--font-card)',
            fontSize: '10px',
            letterSpacing: '2px',
            color: 'var(--green)',
          }}>
            ◈ BONUS — Every purchase includes 1 free {drop.bonus_token} · {drop.bonus_remaining} remaining
          </div>
        )}

        {/* ── Timer ── */}
        {isActive && drop.window_closes_at && (
          <div style={S.timerWrap}>
            <span style={S.timerLabel}>WINDOW CLOSES IN</span>
            <span style={S.timer}>
              {remaining !== null && remaining > 0 ? fmtTime(remaining) : 'EXPIRED'}
            </span>
          </div>
        )}

        {drop.status === 'upcoming' && (
          <div style={S.notice}>
            This drop has not opened yet. Claim window and details will be announced here.
            Make sure your wallets are ready.{' '}
            <Link href="/wallets" style={{ color: 'var(--amber)' }}>wallet setup →</Link>
          </div>
        )}

        {drop.status === 'closed' && (
          <div style={{ ...S.notice, borderLeftColor: 'var(--border)' }}>
            CLAIM WINDOW CLOSED — this drop is no longer accepting claims.
          </div>
        )}

        {/* ═══ ACTIVE CLAIM FLOW ═══ */}
        {isActive && (
          <>
            {/* ─── STEP 1: VERIFY ─── */}
            <div style={S.stepLabel}>STEP 01 · VERIFY</div>
            <div style={S.stepTitle}>
              {drop.requires_unatpepe ? 'YOUR UNATPEPE HOLDINGS' : 'YOUR BITCOIN ADDRESS'}
            </div>
            <p style={S.stepDesc}>
              {drop.requires_unatpepe
                ? 'Phase 1 is for UNATPEPE holders only. Enter your Bitcoin address — UNATPEPE must be held here.'
                : 'Enter your Bitcoin (TAP Wallet) address to check eligibility and continue to claim.'}
            </p>

            {step === 'verify' && (
              <form onSubmit={handleVerify}>
                <label style={S.label} htmlFor="tap">TAP WALLET ADDRESS</label>
                <input
                  id="tap"
                  style={S.input}
                  type="text"
                  value={tapAddress}
                  onChange={e => setTap(e.target.value.trim())}
                  placeholder="1YourBitcoinAddressHere..."
                  autoComplete="off"
                  spellCheck={false}
                  disabled={verifyLoading}
                />
                {verifyErr && <div style={S.errText}>✗ {verifyErr}</div>}
                <button
                  type="submit"
                  style={{ ...S.btnPrimary, ...(!ADDR_RE.test(tapAddress.trim()) || verifyLoading ? S.btnOff : {}) }}
                  disabled={!ADDR_RE.test(tapAddress.trim()) || verifyLoading}
                >
                  {verifyLoading ? 'verifying...' : '⬡ verify holdings →'}
                </button>
              </form>
            )}

            {verifyResult && (
              <div style={S.verifyResult(verifyResult.eligible)}>
                <div style={S.row}>
                  <span>ADDRESS</span>
                  <span style={S.rowVal}>{verifyResult.address.slice(0, 8)}…{verifyResult.address.slice(-6)}</span>
                </div>
                <div style={{ ...S.row, borderBottom: 'none' }}>
                  <span>UNATPEPE</span>
                  <span style={{ color: verifyResult.eligible ? 'var(--green)' : '#cc4444', fontWeight: 700 }}>
                    {verifyResult.eligible
                      ? `✓ ${verifyResult.unatpepe_qty} · YOU HOLD THE KEY`
                      : '✗ 0 · NOT A KEY HOLDER'}
                  </span>
                </div>
                {verifyResult.already_claimed && (
                  <p style={{ ...S.statusDesc, marginTop: 12, color: 'var(--amber)' }}>
                    This address already claimed this drop.{' '}
                    {verifyResult.existing_status && STATUS_COPY[verifyResult.existing_status]
                      ? `Status: ${STATUS_COPY[verifyResult.existing_status].label}`
                      : ''}
                  </p>
                )}
                {!verifyResult.eligible && !verifyResult.already_claimed && (
                  <p style={{ ...S.statusDesc, marginTop: 12, fontSize: '12px' }}>
                    UNATPEPE not found.{' '}
                    <a href="https://tapalytics.xyz/token/unatpepe" target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--amber)' }}>check Tapalytics →</a>
                  </p>
                )}
              </div>
            )}

            {/* ─── STEP 2: CLAIM FORM ─── */}
            {step === 'claim' && (
              <>
                <hr style={S.divider} />
                <div style={S.stepLabel}>STEP 02 · CLAIM</div>

                {drop.claim_type === 'support' && (
                  <>
                    <div style={S.stepTitle}>SELECT YOUR SUPPORT TIER</div>
                    <p style={S.stepDesc}>
                      Choose how much you want to put in.
                      Artist receives 100% of your tier. Platform adds 15% on top.
                    </p>
                    <div style={S.tierGrid}>
                      {tiers.map(t => (
                        <button
                          key={t}
                          type="button"
                          style={S.tier(selectedTier === t)}
                          onClick={() => setTier(t)}
                        >
                          <span style={S.tierUsd}>${t}</span>
                          <span style={S.tierNat}>~{tierNat(t)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {drop.claim_type === 'cultural' && (
                  <>
                    <div style={S.stepTitle}>FREE · CULTURAL CLAIM</div>
                    <p style={S.stepDesc}>
                      This drop is free for UNATPEPE holders. Provide your Counterparty
                      receiving address and your card will be sent after the window closes.
                    </p>
                  </>
                )}

                <form onSubmit={handleClaim}>
                  <label style={S.label} htmlFor="cp">COUNTERPARTY RECEIVING ADDRESS</label>
                  <p style={{ ...S.stepDesc, fontSize: '12px', marginBottom: 10 }}>
                    XCP Wallet or FreeWallet address where you want to receive the token.
                    Can be the same as your TAP address or a different wallet.
                  </p>
                  <input
                    id="cp"
                    style={S.input}
                    type="text"
                    value={cpAddress}
                    onChange={e => setCp(e.target.value.trim())}
                    placeholder="1YourCounterpartyAddressHere..."
                    autoComplete="off"
                    spellCheck={false}
                    disabled={claimLoading}
                  />
                  {claimErr && <div style={S.errText}>✗ {claimErr}</div>}
                  <button
                    type="submit"
                    style={{
                      ...S.btnPrimary,
                      ...(!ADDR_RE.test(cpAddress.trim()) || (drop.claim_type === 'support' && !selectedTier) || claimLoading
                        ? S.btnOff : {}),
                    }}
                    disabled={!ADDR_RE.test(cpAddress.trim()) || (drop.claim_type === 'support' && !selectedTier) || claimLoading}
                  >
                    {claimLoading ? 'registering...' : '◈ register claim →'}
                  </button>
                </form>
              </>
            )}

            {/* ─── STEP 3: PAYMENT ─── */}
            {step === 'payment' && !txidDone && (
              <>
                <hr style={S.divider} />
                <div style={S.stepLabel}>STEP 03 · PAYMENT</div>
                <div style={S.stepTitle}>SEND YOUR NAT</div>
                <p style={S.stepDesc}>
                  Send exactly the amount below to the drop payment address using TAP Wallet,
                  then submit your transaction ID below.
                </p>

                <div style={S.payBox}>
                  <div style={S.payLabel}>SEND TO THIS ADDRESS</div>
                  <div style={S.payAddr}>
                    {drop.nat_address || 'Payment address will be published at drop activation.'}
                  </div>
                  {selectedTier && (
                    <>
                      <div style={{ ...S.payLabel, marginTop: 16 }}>EXACT AMOUNT</div>
                      <div style={S.payAmt}>{tierNat(selectedTier)}</div>
                      <div style={{ ...S.payLabel, marginTop: 4, opacity: 0.6 }}>
                        ~${selectedTier} USD · SEND EXACT AMOUNT
                      </div>
                    </>
                  )}
                </div>

                <form onSubmit={handleTxid}>
                  <label style={S.label} htmlFor="txid">TRANSACTION ID (TXID)</label>
                  <input
                    id="txid"
                    style={S.input}
                    type="text"
                    value={txid}
                    onChange={e => setTxid(e.target.value.trim())}
                    placeholder="64-character hex transaction hash..."
                    autoComplete="off"
                    spellCheck={false}
                    disabled={txidLoading}
                  />
                  {txidErr && <div style={S.errText}>✗ {txidErr}</div>}
                  <button
                    type="submit"
                    style={{ ...S.btnPrimary, ...(!TXID_RE.test(txid.trim()) || txidLoading ? S.btnOff : {}) }}
                    disabled={!TXID_RE.test(txid.trim()) || txidLoading}
                  >
                    {txidLoading ? 'submitting...' : '◆ confirm payment →'}
                  </button>
                </form>
              </>
            )}

            {/* ─── DONE ─── */}
            {step === 'done' && statusInfo && (
              <>
                <hr style={S.divider} />
                <div style={S.statusBox(statusInfo.color)}>
                  <div style={S.statusLbl(statusInfo.color)}>{statusInfo.label}</div>
                  <p style={S.statusDesc}>{statusInfo.desc}</p>

                  {finalStatus === 'awaiting_distribution' && (
                    <>
                      {drop.art_url && (
                        <img
                          src={drop.art_url}
                          alt={drop.token_name}
                          style={{ width: '100%', maxWidth: 180, height: 'auto', display: 'block', margin: '20px auto 20px', border: '1px solid var(--border)' }}
                        />
                      )}
                      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
                      <div style={S.row}>
                        <span>TOKEN</span>
                        <span style={S.rowVal}>{drop.token_name}</span>
                      </div>
                      <div style={S.row}>
                        <span>SERIES</span>
                        <span style={S.rowVal}>Series {toRoman(drop.series)} · Card #{String(drop.card_number).padStart(3, '0')}</span>
                      </div>
                      <div style={S.row}>
                        <span>CLAIM TYPE</span>
                        <span style={S.rowVal}>
                          {drop.claim_type === 'cultural' ? 'CULTURAL · FREE' : `SUPPORT · $${selectedTier}`}
                        </span>
                      </div>
                      <div style={S.row}>
                        <span>RECEIVING</span>
                        <span style={S.rowVal}>{cpAddress.slice(0, 8)}…{cpAddress.slice(-6)}</span>
                      </div>
                      <div style={S.row}>
                        <span>HOLDER</span>
                        <span style={{ ...S.rowVal, color: 'var(--amber)' }}>#{drop.claims_count || '—'} of {drop.supply_total}</span>
                      </div>
                      {claimResult?.bonus_token && (
                        <div style={{ ...S.row, borderBottom: 'none', color: 'var(--green)' }}>
                          <span>BONUS</span>
                          <span style={{ ...S.rowVal, color: 'var(--green)' }}>
                            ◈ 1 × {claimResult.bonus_token} · INCLUDED FREE
                          </span>
                        </div>
                      )}
                      <p style={{ ...S.statusDesc, marginTop: 14, fontSize: '12px' }}>
                        No further action needed. Your card{claimResult?.bonus_token ? ` + ${claimResult.bonus_token}` : ''} will be sent to your receiving
                        address after the window closes.
                      </p>
                      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🐸 Just claimed ${drop.token_name} — Series ${toRoman(drop.series)} · Card #${String(drop.card_number).padStart(3,'0')}\nCertified by the AI Pepe Council on UNATRARE\nhttps://unatrare.wtf/drops/${drop.token_name}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block', color: 'var(--text-dim)', borderColor: 'var(--border)' }}
                        >
                          share on X →
                        </a>
                        <Link href="/drops" style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block', color: 'var(--text-dim)', borderColor: 'var(--border)' }}>
                          ← back to chamber
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

      </main>
    </>
  );
}
