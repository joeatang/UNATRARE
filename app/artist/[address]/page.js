import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import styles from './artist.module.css';
import { getDb } from '../../../lib/db';

const SITE_URL = 'https://unatrare.wtf';

function absoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let out = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { out += syms[i]; n -= vals[i]; }
  }
  return out;
}

function getArtistData(address) {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT token_name, display_title, status, submitted_at, judged_at,
             judge_score, rejection_reason, art_url, art_hash, art_mime,
             artist_handle, description, series, card_number, supply, revealed_at,
             council_certified
      FROM tokens
      WHERE artist_address = ? OR owner_address = ?
      ORDER BY submitted_at DESC
    `).all(address, address).map(r => ({ ...r }));

    const holder = db.prepare(
      'SELECT tap_balance, discount, registered_at FROM holders WHERE btc_address = ?'
    ).get(address);

    const profile = db.prepare('SELECT * FROM artists WHERE btc_address = ?').get(address);

    const handle = profile?.alias ||
      rows.find(r => r.artist_handle)?.artist_handle || null;

    let drops = [];
    if (handle) {
      const bare = handle.replace(/^@/, '');
      drops = db.prepare(`
        SELECT id, token_name, title, artist_handle, description,
               status, supply_total, supply_remaining, window_opens_at,
               window_closes_at, series, card_number, created_at
        FROM art_drops
        WHERE artist_handle = ? OR artist_handle = ?
        ORDER BY created_at DESC
      `).all(bare, '@' + bare).map(r => ({ ...r }));
    }

    return { rows, holder: holder ? { ...holder } : null, profile: profile ? { ...profile } : null, drops };
  } catch {
    return { rows: [], holder: null, profile: null, drops: [] };
  }
}

export async function generateMetadata({ params }) {
  const addr = decodeURIComponent((await params).address);
  try {
    const db = getDb();
    const p = db.prepare('SELECT alias FROM artists WHERE btc_address = ?').get(addr);
    const h = db.prepare(
      "SELECT artist_handle FROM tokens WHERE artist_address = ? AND artist_handle != '' LIMIT 1"
    ).get(addr);
    const name = p?.alias || h?.artist_handle || addr.slice(0, 8) + '\u2026';
    return {
      title: `${name} \u2014 Artist Archive \u2014 UNATRARE`,
      description: `Certified art by ${name} on UNATRARE. Permanent on Bitcoin.`,
    };
  } catch {
    return {
      title: `${addr.slice(0, 8)}\u2026 \u2014 Artist \u2014 UNATRARE`,
      description: `Certified art by Bitcoin address ${addr} on UNATRARE`,
    };
  }
}

export const revalidate = 60;

export default async function ArtistPage({ params }) {
  const address = decodeURIComponent((await params).address);

  const validAddress = /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
  if (!validAddress) notFound();

  const { rows: tokens, holder, profile, drops } = getArtistData(address);
  const approved = tokens.filter(t => t.status === 'approved');
  const pending  = tokens.filter(t => t.status === 'pending');
  const rejected = tokens.filter(t => t.status === 'rejected');

  const handle      = profile?.alias || tokens.find(t => t.artist_handle)?.artist_handle || null;
  const isAnon      = profile?.anonymous === 1;
  const displayName = isAnon
    ? `ANON_${address.slice(0, 6).toUpperCase()}`
    : (handle ? handle.toUpperCase() : null);

  const archiveIndex = profile?.archive_index;

  let cpCollections = [];
  try { cpCollections = JSON.parse(profile?.cp_collections || '[]'); } catch { /* */ }

  const pastProjects = profile?.past_projects
    ? profile.past_projects.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  const seriesSet = [...new Set(approved.map(t => t.series).filter(Boolean))].sort();

  return (
    <>
      <Nav />
      <main className={styles.main}>

        <Link href="/artists" className={styles.backLink}>← artist archive</Link>

        <header className={styles.header}>
          {archiveIndex != null && (
            <div className={styles.archiveStamp}>
              ARCHIVE ENTRY #{String(archiveIndex).padStart(3, '0')}
            </div>
          )}

          <div className={styles.identityRow}>
            {profile?.pfp_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.pfp_url} alt={displayName || address} className={styles.pfp} />
            )}
            <div className={styles.identityInfo}>
              <div className={styles.eyebrow}>
                {isAnon ? '\u00b7 classified \u00b7' : '\u00b7 artist profile \u00b7'}
              </div>
              {displayName && <div className={styles.handle}>{displayName}</div>}
              <h1 className={styles.address}>{address}</h1>
            </div>
          </div>

          <div className={styles.statsRow}>
            <span className={styles.stat} data-color="green">
              <span className={styles.dot} data-color="green" />
              {approved.length} certified
            </span>
            {pending.length > 0 && (
              <span className={styles.stat} data-color="amber">
                <span className={styles.dot} data-color="amber" />
                {pending.length} pending
              </span>
            )}
            {rejected.length > 0 && (
              <span className={styles.stat} data-color="red">
                <span className={styles.dot} data-color="red" />
                {rejected.length} rejected
              </span>
            )}
            {holder && (
              <span className={styles.stat} data-color="green">
                <span className={styles.dot} data-color="green" />
                {holder.tap_balance > 0
                  ? `${holder.tap_balance} UNATPEPE \u00b7 ${holder.discount}% off`
                  : 'registered holder'}
              </span>
            )}
          </div>

          {seriesSet.length > 0 && (
            <div className={styles.seriesRow}>
              <span className={styles.seriesLabel}>CLASSIFIED UNDER</span>
              {seriesSet.map(s => (
                <span key={s} className={styles.seriesBadge}>SERIES {toRoman(s)}</span>
              ))}
            </div>
          )}
        </header>

        {!profile && tokens.length > 0 && (
          <section className={styles.section}>
            <div className={styles.claimBanner}>
              <div className={styles.claimText}>This your work? Set up your artist profile.</div>
              <Link href={`/profile?address=${encodeURIComponent(address)}`} className={styles.claimBtn}>
                CLAIM PROFILE →
              </Link>
            </div>
          </section>
        )}

        {profile?.bio && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>ARTIST STATEMENT</div>
            <div className={styles.bioText}>{profile.bio}</div>
          </section>
        )}

        {(profile?.website || profile?.twitter_handle || cpCollections.length > 0) && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>EXTERNAL REFERENCES</div>
            <div className={styles.linksList}>
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className={styles.extLink}>
                  <span className={styles.extLinkType}>PORTFOLIO</span>
                  <span className={styles.extLinkUrl}>{domainOf(profile.website)}</span>
                  <span className={styles.extLinkArrow}>↗</span>
                </a>
              )}
              {profile.twitter_handle && (
                <a
                  href={`https://x.com/${profile.twitter_handle.replace(/^@/, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className={styles.extLink}
                >
                  <span className={styles.extLinkType}>X / TWITTER</span>
                  <span className={styles.extLinkUrl}>@{profile.twitter_handle.replace(/^@/, '')}</span>
                  <span className={styles.extLinkArrow}>↗</span>
                </a>
              )}
              {cpCollections.map((col, i) => (
                <a key={i} href={col.url} target="_blank" rel="noopener noreferrer" className={styles.extLink}>
                  <span className={styles.extLinkType}>COUNTERPARTY</span>
                  <span className={styles.extLinkUrl}>{col.name}</span>
                  {col.description && <span className={styles.extLinkDesc}>{col.description}</span>}
                  <span className={styles.extLinkArrow}>↗</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {pastProjects.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>PREVIOUS WORK</div>
            <ul className={styles.projectsList}>
              {pastProjects.map((p, i) => (
                <li key={i} className={styles.projectItem}>
                  <span className={styles.projectDot}>·</span>{p}
                </li>
              ))}
            </ul>
          </section>
        )}

        {drops.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>UNATRARE DROPS</div>
            <div className={styles.dropsList}>
              {drops.map(drop => (
                <Link key={drop.id} href={`/drops/${drop.token_name}`} className={styles.dropRow}>
                  <div className={styles.dropMeta}>
                    <span className={styles.dropName}>{drop.token_name}</span>
                    {drop.title && drop.title !== drop.token_name && (
                      <span className={styles.dropTitle}>{drop.title}</span>
                    )}
                  </div>
                  <div className={styles.dropStatus} data-status={drop.status}>
                    {drop.status.toUpperCase()}
                  </div>
                  {drop.supply_total > 0 && (
                    <div className={styles.dropSupply}>
                      {drop.supply_total - drop.supply_remaining}/{drop.supply_total}
                    </div>
                  )}
                  <span className={styles.dropArrow}>→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {tokens.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>NO SUBMISSIONS</div>
            <p className={styles.emptyText}>No tokens submitted from this address yet.</p>
            <Link href="/submit" className={styles.emptyBtn}>submit your first card →</Link>
          </div>
        )}

        {approved.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>
              WORKS IN ARCHIVE<span className={styles.sectionCount}>{approved.length}</span>
            </div>
            <div className={styles.grid}>
              {approved.map(token => (
                <CardThumb
                  key={token.token_name}
                  token={token}
                  artUrl={token.art_hash ? `${SITE_URL}/art/${token.art_hash}` : absoluteUrl(token.art_url)}
                />
              ))}
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>
              PENDING JUDGMENT<span className={styles.sectionCount}>{pending.length}</span>
            </div>
            <div className={styles.grid}>
              {pending.map(token => (
                <CardThumb key={token.token_name} token={token} artUrl={absoluteUrl(token.art_url)} />
              ))}
            </div>
          </section>
        )}

        {rejected.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel} style={{ opacity: 0.4 }}>
              NOT CERTIFIED<span className={styles.sectionCount}>{rejected.length}</span>
            </div>
            <div className={styles.grid}>
              {rejected.map(token => (
                <CardThumb key={token.token_name} token={token} artUrl={absoluteUrl(token.art_url)} />
              ))}
            </div>
          </section>
        )}

      </main>
    </>
  );
}

function CardThumb({ token, artUrl }) {
  const isPending  = token.status === 'pending';
  const isRejected = token.status === 'rejected';
  const isRevealed = !!token.revealed_at;
  const showArt    = !isPending && isRevealed && artUrl;

  return (
    <Link href={`/card/${token.token_name}`} className={styles.card}>
      <div className={styles.cardArt}>
        {showArt ? (
          token.art_mime?.startsWith('video/')
            ? <video src={artUrl} autoPlay muted loop playsInline className={styles.cardImg} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={artUrl} alt={token.token_name} className={styles.cardImg} />
        ) : (
          <div className={styles.cardImgPlaceholder} />
        )}
        {isPending  && <div className={styles.cardPendingLabel}>PENDING</div>}
        {isRejected && <div className={styles.cardRejectedLabel}>REJECTED</div>}
        {!isPending && !isRejected && !isRevealed && (
          <div className={styles.cardPendingLabel}>UNREVEALED</div>
        )}
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardName}>{token.token_name}</div>
        {token.card_number && token.series && (
          <div className={styles.cardNum}>
            #{String(token.card_number).padStart(4, '0')} · S{toRoman(token.series)}
          </div>
        )}
      </div>
    </Link>
  );
}
