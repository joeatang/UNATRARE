import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import RarityBar from '../../components/RarityBar';
import styles from './card.module.css';
import { getDb } from '../../../lib/db';

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

  if (!token) notFound();

  // Non-approved cards get a minimal status page
  if (token.status !== 'approved') {
    return (
      <>
        <Nav />
        <main className={styles.page}>
          <div className={styles.statusPage}>
            <div className={styles.statusLabel}>{token.status === 'pending' ? 'PENDING JUDGMENT' : 'REJECTED'}</div>
            <div className={styles.statusToken}>{token.token_name}</div>
            {token.status === 'rejected' && token.rejection_reason && (
              <div className={styles.statusReason}>{token.rejection_reason}</div>
            )}
            <Link href="/directory" className={styles.backLink}>← directory</Link>
          </div>
        </main>
      </>
    );
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
  const artDisplayUrl = token.art_hash
    ? `https://unatrare.wtf/art/${token.art_hash}`
    : token.art_url?.startsWith('http') ? token.art_url : token.art_url ? `https://unatrare.wtf${token.art_url}` : null;

  return (
    <>
      <Nav />
      <main className={styles.page}>

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
              <div className={styles.cardArt}>
                {token.revealed_at && artDisplayUrl ? (
                  <img
                    src={artDisplayUrl}
                    alt={token.display_title || token.token_name}
                  />
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
              </div>
              <div className={styles.cardFooter}>
                <div className={styles.cardTitle}>{token.display_title || token.token_name}</div>
                <div className={styles.cardSubline}>
                  <span>{token.token_name}</span>
                  {token.artist_handle && <span>by @{token.artist_handle}</span>}
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

            {token.description && (
              <div
                className={styles.description}
                dangerouslySetInnerHTML={{ __html: token.description }}
              />
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
              {token.artist_address && (
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Artist</span>
                  <span className={styles.metaVal} title={token.artist_address}>
                    {token.artist_handle ? `@${token.artist_handle} ` : ''}
                    <span className={styles.addressTrunc}>
                      {token.artist_address.slice(0,8)}…{token.artist_address.slice(-6)}
                    </span>
                  </span>
                </div>
              )}
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
