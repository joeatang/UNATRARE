import Link from 'next/link';
import Nav from '../components/Nav';
import RarityBar from '../components/RarityBar';
import styles from './directory.module.css';
import { getDb } from '../../lib/db';
import { getSalutesByCardBatch, tierFor, fmtCash } from '../../lib/saluteDisplay';

function toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let out = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { out += syms[i]; n -= vals[i]; }
  }
  return out;
}

function getApproved(series, sort) {
  try {
    const db = getDb();
    const orderBy = sort === 'rarity'
      ? 'supply ASC, card_number ASC'   // supply ASC = rarest first (supply 1 before 21000)
      : 'series ASC, card_number ASC';
    let rows;
    if (series) {
      rows = db.prepare(
        `SELECT * FROM tokens WHERE status='approved' AND series=? AND (is_demo IS NULL OR is_demo=0) AND (directory_hidden IS NULL OR directory_hidden=0) ORDER BY ${orderBy}`
      ).all(Number(series));
    } else {
      rows = db.prepare(
        `SELECT * FROM tokens WHERE status='approved' AND (is_demo IS NULL OR is_demo=0) AND (directory_hidden IS NULL OR directory_hidden=0) ORDER BY ${orderBy}`
      ).all();
    }
    // Group by series
    const grouped = {};
    for (const row of rows) {
      const s = row.series ?? 1;
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(row);
    }
    return { grouped, total: rows.length };
  } catch {
    return { grouped: {}, total: 0 };
  }
}

function getDirectoryStats() {
  try {
    const db = getDb();
    const pending  = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='pending' AND (is_demo IS NULL OR is_demo=0)").get().n;
    const approved = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='approved' AND (is_demo IS NULL OR is_demo=0)").get().n;
    const rejected = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='rejected' AND (is_demo IS NULL OR is_demo=0)").get().n;
    return { pending, approved, rejected };
  } catch { return { pending: 0, approved: 0, rejected: 0 }; }
}

export const revalidate = 60;

export default function DirectoryPage({ searchParams }) {
  const seriesFilter = searchParams?.series ? Number(searchParams.series) : null;
  const sortMode = searchParams?.sort === 'rarity' ? 'rarity' : 'card';
  const { grouped, total } = getApproved(seriesFilter, sortMode);
  const stats = getDirectoryStats();
  const seriesNumbers = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  // One batched query for salute summaries across every visible card.
  let saluteByCard = new Map();
  try {
    const allCardNames = [];
    for (const arr of Object.values(grouped)) for (const t of arr) allCardNames.push(t.token_name);
    if (allCardNames.length) saluteByCard = getSalutesByCardBatch(getDb(), allCardNames);
  } catch { /* directory still renders if salutes lookup fails */ }

  // Build series list for filter buttons
  let allSeries = [];
  try {
    const db = getDb();
    allSeries = db.prepare(
      "SELECT DISTINCT series FROM tokens WHERE status='approved' AND (directory_hidden IS NULL OR directory_hidden=0) ORDER BY series ASC"
    ).all().map(r => r.series);
  } catch { /* empty */ }

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.eyebrow}>· certified dank art ·</div>
            <h1 className={styles.title}>DIRECT<span>O</span>RY</h1>
            <div className={styles.totalCount}>{total} certified card{total !== 1 ? 's' : ''}</div>
            <div className={styles.dirStats}>
              <span className={styles.dirStatPending}>{stats.pending} pending</span>
              <span className={styles.dirStatSep}>·</span>
              <span className={styles.dirStatApproved}>{stats.approved} certified</span>
              <span className={styles.dirStatSep}>·</span>
              <span className={styles.dirStatRejected}>{stats.rejected} rejected</span>
            </div>
          </div>
          <Link href="/submit" className={styles.submitCta}>
            submit your token →
          </Link>
        </div>

        {/* ── Series filter + Sort ── */}
        <div className={styles.filterBar}>
          <span className={styles.filterLabel}>series</span>
          <Link
            href={`/directory${sortMode === 'rarity' ? '?sort=rarity' : ''}`}
            className={`${styles.filterBtn} ${!seriesFilter ? styles.active : ''}`}
          >
            all
          </Link>
          {allSeries.map(s => (
            <Link
              key={s}
              href={`/directory?series=${s}${sortMode === 'rarity' ? '&sort=rarity' : ''}`}
              className={`${styles.filterBtn} ${seriesFilter === s ? styles.active : ''}`}
            >
              {toRoman(s)}
            </Link>
          ))}
          <span className={styles.filterSep}>·</span>
          <span className={styles.filterLabel}>sort</span>
          <Link
            href={`/directory${seriesFilter ? `?series=${seriesFilter}` : ''}`}
            className={`${styles.filterBtn} ${sortMode === 'card' ? styles.active : ''}`}
          >
            card #
          </Link>
          <Link
            href={`/directory?${seriesFilter ? `series=${seriesFilter}&` : ''}sort=rarity`}
            className={`${styles.filterBtn} ${sortMode === 'rarity' ? styles.active : ''}`}
          >
            rarity
          </Link>
        </div>

        {/* ── Cards ── */}
        {total === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>NO CARDS YET</div>
            <div className={styles.emptyText}>
              the council has not yet certified any submissions.<br />
              the directory opens when the first card is approved.
            </div>
            <Link href="/submit" className={styles.emptyBtn}>
              submit your art →
            </Link>
          </div>
        ) : (
          seriesNumbers.map(seriesNum => (
            <div key={seriesNum}>
              <div className={styles.seriesHeader}>
                <div className={styles.seriesLabel}>
                  SERIES <span>{toRoman(seriesNum)}</span>
                </div>
              </div>
              <div className={styles.grid}>
                {grouped[seriesNum].map(token => (
                  <Link
                    key={token.token_name}
                    href={`/card/${token.token_name}`}
                    className={styles.card}
                  >
                    <div className={styles.cardArt}>
                      {token.revealed_at && token.art_url ? (
                        token.art_mime?.startsWith('video/') ? (
                          token.art_cover_url
                            ? <img src={token.art_cover_url} alt={token.display_title || token.token_name} loading="lazy" />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', fontSize: 28 }}>▶</div>
                        ) : (
                          <img
                            src={token.art_url}
                            alt={token.display_title || token.token_name}
                            loading="lazy"
                          />
                        )
                      ) : !token.revealed_at ? (
                        /* Mystery pack — drop pending */
                        <div style={{
                          width:'100%', height:'100%',
                          background:'repeating-linear-gradient(45deg,#1a1a1a 0,#1a1a1a 4px,#111 4px,#111 8px)',
                          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4
                        }}>
                          <span style={{fontSize:'24px', lineHeight:1}}>🐸</span>
                          <span style={{fontFamily:'var(--font-card)', fontSize:'7px', letterSpacing:'2px', color:'var(--amber)'}}>MYSTERY</span>
                        </div>
                      ) : (
                        <div style={{
                          width:'100%', height:'100%',
                          background:'repeating-linear-gradient(45deg,#111 0,#111 3px,#0d0d0d 3px,#0d0d0d 7px)'
                        }} />
                      )}
                    </div>
                    <div className={styles.cardFooter}>
                      <div className={styles.cardName}>
                        {token.revealed_at ? (token.display_title || token.token_name) : '???'}
                      </div>
                      <div className={styles.cardMeta}>
                        S{toRoman(token.series)} · #{String(token.card_number).padStart(3,'0')}
                      </div>
                      {token.supply > 0 && (
                        <div className={styles.cardRarity}>
                          <RarityBar supply={token.supply} compact />
                        </div>
                      )}
                      {(() => {
                        const sum = saluteByCard.get(token.token_name);
                        const total = Number(sum?.total_burned || 0);
                        const today = Number(sum?.total_24h || 0);
                        const tier = tierFor(total);
                        if (total <= 0) {
                          return (
                            <div className={styles.cardSalute} style={{ color: '#8f8f8f', borderColor: '#222' }}>
                              <span style={{ opacity: 0.7 }}>○</span> AWAITING SALUTE
                            </div>
                          );
                        }
                        const burnersTxt = sum.unique_burners === 1 ? '1 saluter' : `${sum.unique_burners} saluters`;
                        const trending = today > 0;
                        return (
                          <div
                            className={styles.cardSalute}
                            style={{
                              color: tier.color,
                              borderColor: trending ? tier.color : '#222',
                              boxShadow: trending ? `0 0 8px ${tier.color}33` : 'none',
                            }}
                          >
                            <span>🔥</span> {fmtCash(total)} $CASH · {burnersTxt}
                            {trending && (
                              <span style={{ display: 'block', fontSize: 9, color: tier.color, opacity: 0.85, marginTop: 2 }}>
                                +{fmtCash(today)} today
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}

      </main>
    </>
  );
}
