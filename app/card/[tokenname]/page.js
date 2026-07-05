import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import RarityBar from '../../components/RarityBar';
import SalutePanel from '../../components/SalutePanel';
import SaluteCeremonySpotlight from '../../components/SaluteCeremonySpotlight';
import styles from './card.module.css';
import { getDb } from '../../../lib/db';
import { fmtCash, tierFor, truncateWallet } from '../../../lib/saluteDisplay';
import { resolveIdentities, displayFor } from '../../../lib/torchbearerIdentity';
import { resolveIdentityBadges } from '../../../lib/identityBadges';
import IdentityBadges from '../../components/IdentityBadges';
import { featureEnabled } from '../../../lib/features';
import { getHeraldsForCard } from '../../../lib/reach';
import HeraldShare from '../../components/HeraldShare';

function toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let out = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { out += syms[i]; n -= vals[i]; }
  }
  return out;
}

function getToken(tokenname) {
  try {
    const db = getDb();
    return db.prepare('SELECT * FROM tokens WHERE token_name = ?').get(tokenname.toUpperCase());
  } catch {
    return null;
  }
}

function getDrop(tokenName) {
  try {
    const db = getDb();
    return db.prepare(
      'SELECT id, supply_total, supply_remaining, status FROM art_drops WHERE token_name = ? LIMIT 1'
    ).get(tokenName);
  } catch {
    return null;
  }
}

function getCampaignData(tokenName) {
  try {
    const db = getDb();
    const since24h = Math.floor(Date.now() / 1000) - 86400;

    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(amount_display), 0) AS total_burned,
        COUNT(*) AS burn_count,
        COUNT(DISTINCT sol_wallet) AS unique_saluters,
        COALESCE(SUM(CASE WHEN burned_at >= ? THEN amount_display ELSE 0 END), 0) AS total_24h,
        COUNT(DISTINCT CASE WHEN burned_at >= ? THEN sol_wallet END) AS saluters_24h,
        MIN(burned_at) AS first_burned_at,
        MAX(burned_at) AS last_burned_at
      FROM card_salutes
      WHERE card_name = ?
    `).get(since24h, since24h, tokenName);

    const firstSaluter = db.prepare(`
      SELECT sol_wallet, burned_at
      FROM card_salutes
      WHERE card_name = ?
      ORDER BY burned_at ASC, id ASC
      LIMIT 1
    `).get(tokenName);

    const topTorchbearers = db.prepare(`
      SELECT
        sol_wallet,
        SUM(amount_display) AS total_burned,
        COUNT(*) AS salute_count,
        MIN(burned_at) AS first_burned_at,
        MAX(burned_at) AS last_burned_at
      FROM card_salutes
      WHERE card_name = ?
      GROUP BY sol_wallet
      ORDER BY total_burned DESC, salute_count DESC, first_burned_at ASC
      LIMIT 8
    `).all(tokenName);

    const recentSalutes = db.prepare(`
      SELECT sol_wallet, amount_display, burned_at, tx_sig
      FROM card_salutes
      WHERE card_name = ?
      ORDER BY burned_at DESC, id DESC
      LIMIT 6
    `).all(tokenName);

    const artistUpdates = db.prepare(`
      SELECT body, created_at
      FROM card_updates
      WHERE card_name = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 4
    `).all(tokenName);

    // Anon-aware display labels for every wallet shown on this card.
    const idMap = resolveIdentities([
      ...topTorchbearers.map(t => t.sol_wallet),
      ...recentSalutes.map(s => s.sol_wallet),
      ...(firstSaluter ? [firstSaluter.sol_wallet] : []),
    ]);
    const labelFor = (w) => displayFor(idMap.get(w), w).label;
    // Honor "hide from leaderboards" on the ranked list, backfill to 5.
    const visibleTop = topTorchbearers
      .filter(t => !idMap.get(t.sol_wallet)?.hidden)
      .slice(0, 5);
    for (const t of visibleTop) t.label = labelFor(t.sol_wallet);
    for (const s of recentSalutes) s.label = labelFor(s.sol_wallet);

    // Colored identity badges travel with each top torchbearer on the card.
    const topTotals = new Map(visibleTop.map(t => [t.sol_wallet, Number(t.total_burned || 0)]));
    const topBadges = resolveIdentityBadges(visibleTop.map(t => t.sol_wallet), { totalsByWallet: topTotals });
    for (const t of visibleTop) t.badges = topBadges.get(t.sol_wallet) || [];

    return {
      totals: totals || {
        total_burned: 0,
        burn_count: 0,
        unique_saluters: 0,
        total_24h: 0,
        saluters_24h: 0,
        first_burned_at: null,
        last_burned_at: null,
      },
      firstSaluter: firstSaluter || null,
      firstSaluterLabel: firstSaluter ? labelFor(firstSaluter.sol_wallet) : null,
      topTorchbearers: visibleTop,
      recentSalutes,
      artistUpdates,
    };
  } catch {
    return {
      totals: {
        total_burned: 0,
        burn_count: 0,
        unique_saluters: 0,
        total_24h: 0,
        saluters_24h: 0,
        first_burned_at: null,
        last_burned_at: null,
      },
      firstSaluter: null,
      topTorchbearers: [],
      recentSalutes: [],
      artistUpdates: [],
    };
  }
}

function relTime(unixSec) {
  if (!unixSec) return '—';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(Number(unixSec) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export async function generateMetadata({ params }) {
  const { tokenname } = await params;
  const token = getToken(tokenname);
  const name = tokenname.toUpperCase();
  const ogUrl = `https://unatrare.wtf/api/og/${name}`;
  if (!token || token.status !== 'approved') {
    return {
      title: 'Card Not Found — UNATRARE',
      openGraph: { images: [ogUrl] },
    };
  }
  return {
    title: `${token.display_title || token.token_name} — UNATRARE`,
    description: `Series ${toRoman(token.series)} · Card #${String(token.card_number).padStart(3,'0')} · Certified Dank`,
    openGraph: {
      title: `${token.display_title || token.token_name} — UNATRARE`,
      description: `Series ${toRoman(token.series)} · Card #${String(token.card_number).padStart(3,'0')} · Certified Dank`,
      images: [{ url: ogUrl, width: 400, height: 560, alt: token.token_name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${token.display_title || token.token_name} — UNATRARE`,
      description: `Certified Dank · unatrare.wtf`,
      images: [ogUrl],
    },
  };
}

export const revalidate = 3600;

export default async function CardPage({ params }) {
  const { tokenname } = await params;
  const token = getToken(tokenname);
  const showCeremonySpotlight = process.env.NEXT_PUBLIC_SALUTE_CEREMONY_UI === '1';

  if (!token) notFound();

  // Non-approved cards get a status page — pending gets mystery pack style, rejected gets reason
  if (token.status !== 'approved') {
    return (
      <>
        <Nav />
        <main className={styles.page}>
          <div className={styles.statusPage}>
            {token.status === 'pending' ? (
              <>
                <div style={{
                  width:180, margin:'0 auto 24px',
                  border:'1px solid var(--amber)',
                  background:'var(--surface)',
                }}>
                  <div style={{
                    height:24, background:'var(--bg)', borderBottom:'1px solid var(--amber)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--font-card)', fontSize:'8px', letterSpacing:'3px', color:'var(--amber)',
                  }}>
                    UNATRARE · PENDING
                  </div>
                  <div style={{
                    aspectRatio:'5/7', display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', gap:10,
                    background:'repeating-linear-gradient(45deg,#1a1a1a 0px,#1a1a1a 4px,#111 4px,#111 8px)',
                  }}>
                    <span style={{fontSize:'52px', lineHeight:1}}>🐸</span>
                    <span style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'3px', color:'var(--amber)', textAlign:'center'}}>MYSTERY PACK</span>
                    <span style={{fontFamily:'var(--font-card)', fontSize:'8px', letterSpacing:'2px', color:'var(--text-dim)', textAlign:'center'}}>awaiting council judgment</span>
                  </div>
                </div>
                <div className={styles.statusLabel}>PENDING JUDGMENT</div>
                <div className={styles.statusToken}>{token.token_name}</div>
              </>
            ) : (
              <>
                <div className={styles.statusLabel}>REJECTED</div>
                <div className={styles.statusToken}>{token.token_name}</div>
                {token.rejection_reason && (
                  <div className={styles.statusReason}>{token.rejection_reason}</div>
                )}
              </>
            )}
            <Link href="/directory" className={styles.backLink}>← directory</Link>
          </div>
        </main>
      </>
    );
  }

  const drop = getDrop(token.token_name);
  const campaign = getCampaignData(token.token_name);
  const campaignTier = tierFor(campaign.totals.total_burned);

  // Heralds & Reach (Social Phase 1) — dark unless the reward_reach flag is ON.
  const reachEnabled = featureEnabled('reward_reach');
  let heralds = [];
  if (reachEnabled) {
    const raw = getHeraldsForCard(token.token_name);
    if (raw.length) {
      const ids = resolveIdentities(raw.map(h => h.wallet));
      heralds = raw.map(h => {
        const id = ids.get(h.wallet);
        return { ...h, label: id ? displayFor(id, h.wallet).label : truncateWallet(h.wallet) };
      });
    }
  }

  const xcpUrl   = `https://tokenscan.io/asset/${token.token_name}`;
  const ordUrl   = token.ord_inscription
    ? `https://ordinals.com/inscription/${token.ord_inscription}`
    : null;
  const cardUrl  = `https://unatrare.wtf/card/${token.token_name}`;
  const shareText = encodeURIComponent(
    `🐸 ${token.display_title || token.token_name} — Series ${toRoman(token.series)} Card #${String(token.card_number).padStart(3,'0')} · Certified Dank on UNATRARE\n${cardUrl}`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${shareText}`;

  // Prefer permanent hash-based art URL
  // For video, use the direct /uploads/ path — browsers need HTTP range requests
  // for video playback, and nginx handles that natively for /uploads/.
  const isVideoArt = token.art_mime?.startsWith('video/');
  const artDisplayUrl = isVideoArt
    ? (token.art_url?.startsWith('http') ? token.art_url : token.art_url ? `https://unatrare.wtf${token.art_url}` : null)
    : token.art_hash
      ? `https://unatrare.wtf/art/${token.art_hash}`
      : token.art_url?.startsWith('http') ? token.art_url
      : token.art_url ? `https://unatrare.wtf${token.art_url}` : null;

  const artCoverUrl = token.art_cover_url?.startsWith('http')
    ? token.art_cover_url
    : token.art_cover_url ? `https://unatrare.wtf${token.art_cover_url}` : null;

  const audioDisplayUrl = token.audio_url?.startsWith('http')
    ? token.audio_url
    : token.audio_url ? `https://unatrare.wtf${token.audio_url}` : null;

  const videoDisplayUrl = token.video_url?.startsWith('http')
    ? token.video_url
    : token.video_url ? `https://unatrare.wtf${token.video_url}` : null;

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {token.is_demo === 1 && (
          <div style={{
            background: 'rgba(128,128,128,0.08)',
            border: '1px solid #444',
            borderLeft: '3px solid #888',
            padding: '10px 20px',
            marginBottom: 16,
            fontFamily: 'var(--font-card)',
            fontSize: '10px',
            letterSpacing: '3px',
            color: '#888',
          }}>
            ◈ DEMO SAMPLE — this card is for testing purposes only and is not an official UNATRARE enrollment
          </div>
        )}

        <div className={styles.layout}>

          {/* ── Card frame ── */}
          <div className={styles.cardSide}>
            <div className={styles.cardFrame}>
              <div className={styles.cardHeader}>
                <span className={styles.cardHeaderText}>UNATRARE</span>
                <span className={styles.cardHeaderDot}>·</span>
                <span className={styles.cardHeaderText}>SERIES {toRoman(token.series)}</span>
                <span className={styles.cardHeaderDot}>·</span>
                <span className={styles.cardHeaderText}>#{String(token.card_number).padStart(3,'0')}</span>
              </div>
              <div className={`${styles.cardArt} ${styles.cardArtWrap}${token.council_certified === 1 ? ' ' + styles.cardArtCertified : ''}`}>
                {token.revealed_at && artDisplayUrl ? (
                  token.art_mime?.startsWith('video/') ? (
                    <video
                      src={artDisplayUrl}
                      poster={artCoverUrl || undefined}
                      autoPlay muted loop playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <img
                      src={artDisplayUrl}
                      alt={token.display_title || token.token_name}
                    />
                  )
                ) : !token.revealed_at ? (
                  /* Mystery pack — art not yet dropped */
                  <div className={styles.artPlaceholder} style={{
                    display:'flex', flexDirection:'column', alignItems:'center',
                    justifyContent:'center', gap:8,
                    background:'repeating-linear-gradient(45deg,#1a1a1a 0px,#1a1a1a 4px,#111 4px,#111 8px)'
                  }}>
                    <span style={{fontSize:'48px', lineHeight:1}}>🐸</span>
                    <span style={{fontFamily:'var(--font-card)', fontSize:'10px', letterSpacing:'3px', color:'var(--amber)', textAlign:'center'}}>MYSTERY PACK</span>
                    <span style={{fontFamily:'var(--font-card)', fontSize:'9px', letterSpacing:'2px', color:'var(--text-dim)', textAlign:'center'}}>drop pending</span>
                  </div>
                ) : (
                  <div className={styles.artPlaceholder} />
                )}
                {/* council_certified green border handled via .cardArtCertified CSS class */}
              </div>
              <div className={styles.cardFooter}>
                <div className={styles.cardTitle}>{token.display_title || token.token_name}</div>
                <div className={styles.cardSubline}>
                  <span>{token.token_name}</span>
                  {token.artist_handle && token.artist_address && (
                    <Link href={`/artist/${token.artist_address}`} className={styles.cardArtistLink}>
                      by @{token.artist_handle}
                    </Link>
                  )}
                  {token.artist_handle && !token.artist_address && (
                    <span>by @{token.artist_handle}</span>
                  )}
                </div>
                {token.supply > 0 ? (
                  <div className={styles.cardRarity}>
                    <span className={styles.cardSupply}>Supply: {token.supply.toLocaleString()}</span>
                    <span className={styles.cardRarityDot}>·</span>
                    <RarityBar supply={token.supply} compact />
                  </div>
                ) : (
                  <div className={styles.cardCertified}>CERTIFIED DANK</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Info panel ── */}
          <div className={styles.infoSide}>

            <div className={styles.infoEyebrow}>· certified dank ·</div>
            <h1 className={styles.infoTitle}>{token.display_title || token.token_name}</h1>

            {token.council_certified === 1 && (
              <div className={styles.councilBadge}>
                <span className={styles.councilBadgeFrog}>🐸</span>
                <span className={styles.councilBadgeText}>Certified by the Pepe Council</span>
              </div>
            )}

            {token.official_signal && (
              <section className={styles.signalSection}>
                <div className={styles.signalEyebrow}>official artist signal</div>
                <blockquote className={styles.signalQuote}>
                  “{token.official_signal}”
                </blockquote>
                <div className={styles.signalSub}>
                  {token.artist_handle ? `From @${token.artist_handle}` : 'From the artist'} · the line torchbearers can carry forward
                </div>
              </section>
            )}

            {/* ── UNATPEPE drop section ── */}
            {drop && (
              <div style={{
                margin: '0 0 20px',
                padding: '12px 14px',
                border: '1px solid var(--amber)',
                background: 'rgba(255,200,0,0.03)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px',
                  color: 'var(--amber)', marginBottom: 8,
                }}>
                  ★ UNATPEPE HOLDER DROP
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text)', lineHeight: 1.6 }}>
                  {drop.status === 'active' ? (
                    <>UNATPEPE holders can claim a free copy of this card.
                    {' '}<strong>{drop.supply_remaining}</strong> / {drop.supply_total} remaining.</>
                  ) : drop.status === 'complete' ? (
                    <>Drop complete. All {drop.supply_total} allocations have been claimed.
                    {' '}<span style={{ color: 'var(--text-dim)' }}>Saluting this card is always open below.</span></>
                  ) : (
                    <>Drop announced — claiming opens soon. {drop.supply_total} copies reserved for UNATPEPE holders.</>
                  )}
                </div>
                {drop.status === 'active' && (
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/drops/${token.token_name}`} style={{
                      fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px',
                      color: 'var(--amber)', textDecoration: 'none', borderBottom: '1px solid var(--amber)',
                    }}>
                      CLAIM YOUR COPY →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {showCeremonySpotlight && (
              <SaluteCeremonySpotlight cardName={token.token_name} />
            )}

            {token.council_certified === 1 && token.revealed_at ? (
              <SalutePanel cardName={token.token_name} />
            ) : (
              <div style={{
                fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '2px',
                color: 'var(--text-dim)', textAlign: 'center', padding: '24px 0',
                border: '1px dashed #2a2a2a', margin: '12px 0',
              }}>
                ○ SALUTES OPEN AFTER COUNCIL STAMPS THIS CARD
              </div>
            )}

            <section className={styles.campaignSection}>
              <div className={styles.campaignHeader}>
                <div>
                  <div className={styles.campaignEyebrow}>campaign pulse</div>
                  <h2 className={styles.campaignTitle}>Support Lives On This Page</h2>
                </div>
                <div
                  className={styles.campaignTier}
                  style={{ color: campaignTier.color, borderColor: `${campaignTier.color}55` }}
                >
                  {campaignTier.label}
                </div>
              </div>

              {reachEnabled && <HeraldShare card={token.token_name} title={token.display_title || token.token_name} />}

              <div className={styles.campaignStats}>
                <div className={styles.campaignStat}>
                  <span className={styles.campaignStatLabel}>total burned</span>
                  <span className={styles.campaignStatValue}>🔥 {fmtCash(campaign.totals.total_burned)}</span>
                  <span className={styles.campaignStatSub}>$CASH saluted into this card</span>
                </div>
                <div className={styles.campaignStat}>
                  <span className={styles.campaignStatLabel}>torchbearers</span>
                  <span className={styles.campaignStatValue}>{campaign.totals.unique_saluters}</span>
                  <span className={styles.campaignStatSub}>
                    {campaign.totals.burn_count} salute{campaign.totals.burn_count === 1 ? '' : 's'} recorded
                  </span>
                </div>
                <div className={styles.campaignStat}>
                  <span className={styles.campaignStatLabel}>last 24h</span>
                  <span className={styles.campaignStatValue}>{fmtCash(campaign.totals.total_24h)}</span>
                  <span className={styles.campaignStatSub}>
                    {campaign.totals.saluters_24h} saluter{campaign.totals.saluters_24h === 1 ? '' : 's'} active
                  </span>
                </div>
                <div className={styles.campaignStat}>
                  <span className={styles.campaignStatLabel}>latest signal</span>
                  <span className={styles.campaignStatValue}>{relTime(campaign.totals.last_burned_at)}</span>
                  <span className={styles.campaignStatSub}>
                    {campaign.firstSaluter ? `genesis by ${campaign.firstSaluterLabel}` : 'awaiting first salute'}
                  </span>
                </div>
              </div>

              <div className={styles.campaignColumns}>
                <div className={styles.campaignColumn}>
                  <div className={styles.campaignColumnLabel}>top torchbearers</div>
                  {campaign.topTorchbearers.length === 0 ? (
                    <div className={styles.campaignEmpty}>
                      No one has claimed the founding slot yet. First salute becomes the genesis mark on this card.
                    </div>
                  ) : (
                    <div className={styles.campaignList}>
                      {campaign.topTorchbearers.map((torchbearer, index) => {
                        const isGenesis = torchbearer.sol_wallet === campaign.firstSaluter?.sol_wallet;
                        return (
                          <Link key={torchbearer.sol_wallet} href={`/torchbearer/${torchbearer.sol_wallet}`} className={`${styles.campaignRow} ${styles.campaignRowLink}`}>
                            <div className={styles.campaignRowLeft}>
                              <span className={styles.campaignRank}>#{index + 1}</span>
                              <div className={styles.campaignSupporterMeta}>
                                <span className={styles.campaignWallet}>{torchbearer.label}</span>
                                <span className={styles.campaignSupporterSub}>
                                  {torchbearer.salute_count} salute{torchbearer.salute_count === 1 ? '' : 's'}
                                  {isGenesis ? ' · genesis' : ''}
                                </span>
                                <IdentityBadges badges={torchbearer.badges} size="sm" />
                              </div>
                            </div>
                            <span className={styles.campaignAmount}>🔥 {fmtCash(torchbearer.total_burned)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={styles.campaignColumn}>
                  <div className={styles.campaignColumnLabel}>recent activity</div>
                  {campaign.recentSalutes.length === 0 ? (
                    <div className={styles.campaignEmpty}>
                      This page is already the campaign home. What it needs now is its first permanent torchbearer signal.
                    </div>
                  ) : (
                    <div className={styles.campaignList}>
                      {campaign.recentSalutes.map((salute) => (
                        <Link key={salute.tx_sig} href={`/torchbearer/${salute.sol_wallet}`} className={`${styles.campaignRow} ${styles.campaignRowLink}`}>
                          <div className={styles.campaignRowLeft}>
                            <div className={styles.campaignSupporterMeta}>
                              <span className={styles.campaignWallet}>{salute.label}</span>
                              <span className={styles.campaignSupporterSub}>{relTime(salute.burned_at)}</span>
                            </div>
                          </div>
                          <span className={styles.campaignAmount}>+{fmtCash(salute.amount_display)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {reachEnabled && heralds.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div className={styles.campaignColumnLabel}>📣 heralds of this card</div>
                  <div className={styles.campaignList}>
                    {heralds.map((h, i) => (
                      <Link key={h.wallet} href={`/torchbearer/${h.wallet}`} className={`${styles.campaignRow} ${styles.campaignRowLink}`}>
                        <div className={styles.campaignRowLeft}>
                          <span className={styles.campaignRank}>#{i + 1}</span>
                          <div className={styles.campaignSupporterMeta}>
                            <span className={styles.campaignWallet}>{h.label}</span>
                            <span className={styles.campaignSupporterSub}>amplified this card</span>
                          </div>
                        </div>
                        <span className={styles.campaignAmount}>{h.reach_clicks} reached</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.campaignUpdates}>
                <div className={styles.campaignColumnLabel}>artist updates</div>
                {campaign.artistUpdates.length === 0 ? (
                  <div className={styles.campaignEmpty}>
                    No artist updates yet. This section becomes the campaign journal as the work evolves.
                  </div>
                ) : (
                  <div className={styles.updateList}>
                    {campaign.artistUpdates.map((update, index) => (
                      <div key={`${update.created_at}-${index}`} className={styles.updateRow}>
                        <div className={styles.updateMeta}>
                          <span className={styles.updateStamp}>{relTime(update.created_at)}</span>
                          <span className={styles.updateAuthor}>
                            {token.artist_handle ? `@${token.artist_handle}` : 'artist'}
                          </span>
                        </div>
                        <p className={styles.updateBody}>{update.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.campaignPaths}>
                <Link href="/directory?sort=momentum" className={styles.campaignPathLink}>
                  browse live momentum →
                </Link>
                <Link href="/burns?tab=wallets" className={styles.campaignPathLink}>
                  view top torchbearers →
                </Link>
                <Link href="/burns?tab=recent" className={styles.campaignPathLink}>
                  watch recent salutes →
                </Link>
              </div>
            </section>

            {token.description && (
              <div className={styles.description}>
                {token.description}
              </div>
            )}

            {/* ── Supplemental media ── */}
            {token.revealed_at && videoDisplayUrl && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>VIDEO</div>
                <video
                  controls loop playsInline
                  src={videoDisplayUrl}
                  style={{ width: '100%', maxWidth: 400, display: 'block', border: '1px solid var(--border)' }}
                />
              </div>
            )}
            {token.revealed_at && audioDisplayUrl && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '3px', color: 'var(--text-dim)', marginBottom: 8 }}>AUDIO</div>
                <audio controls src={audioDisplayUrl} style={{ width: '100%', maxWidth: 400 }} />
              </div>
            )}

            <div className={styles.metaGrid}>
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Token</span>
                <span className={styles.metaVal}>{token.token_name}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Series</span>
                <span className={styles.metaVal}>Series {toRoman(token.series)}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Card #</span>
                <span className={styles.metaVal}>#{String(token.card_number).padStart(3,'0')}</span>
              </div>
              {token.ord_inscription && (
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Inscription</span>
                  <span className={styles.metaVal}>
                    {token.ord_inscription.slice(0,12)}…
                  </span>
                </div>
              )}
              {token.supply > 0 && (
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Supply</span>
                  <span className={styles.metaVal}>{token.supply.toLocaleString()}</span>
                </div>
              )}
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Rarity</span>
                <span className={styles.metaVal}>
                  {token.supply > 0
                    ? <RarityBar supply={token.supply} />
                    : <span style={{color:'var(--text-dim)'}}>—</span>
                  }
                </span>
              </div>
              {token.cp_version === 2 && (
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Protocol</span>
                  <span className={styles.metaVal} style={{color:'var(--orange)',fontFamily:"'VT323',monospace",fontSize:'18px',letterSpacing:'0.08em'}}>
                    COUNTERPARTY 2.0
                  </span>
                </div>
              )}
              {token.dispenser_address && (
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Buy / Trade</span>
                  <a
                    href={`https://xchain.io/dispensers/${token.dispenser_address}`}
                    target="_blank" rel="noopener noreferrer"
                    className={styles.metaVal}
                    style={{ color: 'var(--green)', textDecoration: 'none' }}
                    title={token.dispenser_address}
                  >
                    dispenser ↗
                  </a>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className={styles.actionBtn}>
                share on X →
              </a>
              <a href={xcpUrl} target="_blank" rel="noopener noreferrer" className={styles.actionBtn}>
                view on tokenscan.io →
              </a>
              {ordUrl && (
                <a href={ordUrl} target="_blank" rel="noopener noreferrer" className={styles.actionBtn}>
                  view inscription →
                </a>
              )}
              <Link href={`/c/${token.token_name}.json`} className={styles.actionBtnSecondary}>
                metadata json →
              </Link>
              <Link href={`/studio/update/${token.token_name}`} className={styles.actionBtnSecondary}>
                artist: update card →
              </Link>
              <Link href={`/studio?token=${token.token_name}`} className={styles.actionBtnSecondary}>
                artist: open studio →
              </Link>
            </div>

            <div className={styles.backRow}>
              <Link href="/directory" className={styles.backLink}>← back to directory</Link>
            </div>

          </div>
        </div>

      </main>
    </>
  );
}
