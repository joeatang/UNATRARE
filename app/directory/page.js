import Link from 'next/link';
import Nav from '../components/Nav';
import RarityBar from '../components/RarityBar';
import styles from './directory.module.css';
import { getDb } from '../../lib/db';

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

export const revalidate = 60;

export default function DirectoryPage({ searchParams }) {
  const seriesFilter = searchParams?.series ? Number(searchParams.series) : null;
  const sortMode = searchParams?.sort === 'rarity' ? 'rarity' : 'card';
  const { grouped, total } = getApproved(seriesFilter, sortMode);
  const seriesNumbers = Object.keys(grouped).map(Number).sort((a, b) => a - b);

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
          </div>
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
                        <img
                          src={token.art_url}
                          alt={token.display_title || token.token_name}
                          loading="lazy"
                        />
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
