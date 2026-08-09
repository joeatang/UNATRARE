import Link from 'next/link';
import Nav from '../components/Nav';
import RarityBar from '../components/RarityBar';
import styles from './directory.module.css';
import { getDb } from '../../lib/db';
import { getSalutesByCardBatch, tierFor, fmtCash } from '../../lib/saluteDisplay';
import { getCardMomentumBatch } from '../../lib/signalWeight';
import {
  HONORARY_SERIES,
  HONORARY_CAP,
  ART_SERIES_CAP,
  ART_SERIES_COUNT,
  LAST_ART_SERIES,
  TOTAL_CAP,
  isHonorary,
  capForSeries,
  seriesLabel,
} from '../../lib/seriesConfig';

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
    if (series !== null && series !== undefined) {
      // Explicit series filter — 0 (Honorary) counts as a valid filter.
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
  const rawSeries = searchParams?.series;
  const seriesFilter = (rawSeries === undefined || rawSeries === '')
    ? null
    : Number(rawSeries);
  const sortMode = ['rarity', 'momentum'].includes(searchParams?.sort) ? searchParams.sort : 'card';
  const { grouped, total } = getApproved(seriesFilter, sortMode);
  const stats = getDirectoryStats();

  // One batched query for salute summaries across every visible card.
  let saluteByCard = new Map();
  // Signal-weighted momentum — a salute from a trusted backer counts for more.
  let momentumByCard = new Map();
  try {
    const allCardNames = [];
    for (const arr of Object.values(grouped)) for (const t of arr) allCardNames.push(t.token_name);
    if (allCardNames.length) {
      const db = getDb();
      saluteByCard = getSalutesByCardBatch(db, allCardNames);
      momentumByCard = getCardMomentumBatch(db, allCardNames);
    }
  } catch { /* directory still renders if salutes lookup fails */ }

  if (sortMode === 'momentum') {
    for (const arr of Object.values(grouped)) {
      arr.sort((a, b) => {
        const ma = momentumByCard.get(a.token_name);
        const mb = momentumByCard.get(b.token_name);
        const aw = Number(ma?.weighted || 0);
        const bw = Number(mb?.weighted || 0);
        if (bw !== aw) return bw - aw;
        const at = Number(saluteByCard.get(a.token_name)?.total_burned || 0);
        const bt = Number(saluteByCard.get(b.token_name)?.total_burned || 0);
        if (bt !== at) return bt - at;
        const ab = Number(ma?.backers || 0);
        const bb = Number(mb?.backers || 0);
        if (bb !== ab) return bb - ab;
        return (a.card_number || 0) - (b.card_number || 0);
      });
    }
  }

  const momentumCards = [];
  for (const arr of Object.values(grouped)) {
    for (const token of arr) {
      const mom = momentumByCard.get(token.token_name);
      const sum = saluteByCard.get(token.token_name);
      momentumCards.push({
        token,
        weighted:       Number(mom?.weighted || 0),
        rawWindow:      Number(mom?.raw_window || 0),
        total24h:       Number(mom?.total_24h || 0),
        backers:        Number(mom?.backers || 0),
        trustedBackers: Number(mom?.trusted_backers || 0),
        totalBurned:    Number(sum?.total_burned || 0),
      });
    }
  }
  momentumCards.sort((a, b) => {
    if (b.weighted !== a.weighted) return b.weighted - a.weighted;
    if (b.total24h !== a.total24h) return b.total24h - a.total24h;
    if (b.totalBurned !== a.totalBurned) return b.totalBurned - a.totalBurned;
    return (a.token.card_number || 0) - (b.token.card_number || 0);
  });
  const topMomentum = momentumCards.filter(row => row.weighted > 0).slice(0, 3);

  // Build series list for filter buttons
  let allSeries = [];
  try {
    const db = getDb();
    allSeries = db.prepare(
      "SELECT DISTINCT series FROM tokens WHERE status='approved' AND (directory_hidden IS NULL OR directory_hidden=0) ORDER BY series ASC"
    ).all().map(r => r.series);
  } catch { /* empty */ }

  // Approved fill per series (used for progress + sealed badges + global counter).
  // Always show all six art series in the header even if empty, so users see
  // the structure. Honorary is only shown if it has cards.
  const fillBySeries = new Map();
  for (const s of [HONORARY_SERIES, 1, 2, 3, 4, 5, 6]) {
    const arr = grouped[s] || [];
    fillBySeries.set(s, arr.length);
  }
  const honoraryFill = fillBySeries.get(HONORARY_SERIES) || 0;
  const totalArtFilled = [1,2,3,4,5,6].reduce((a,s) => a + (fillBySeries.get(s) || 0), 0);
  const totalFilled = honoraryFill + totalArtFilled;
  const totalRemaining = Math.max(0, TOTAL_CAP - totalFilled);

  // Ensure Series 0 (Honorary) is rendered FIRST when present.
  const seriesNumbers = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

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
            {/* Global project progress — Series 0 + 6 art series × 69 = 420 total */}
            <div className={styles.projectProgress}>
              <span className={styles.projectProgressLabel}>project</span>
              <span className={styles.projectProgressCount}>
                {totalFilled}<span className={styles.projectProgressSlash}> / </span>{TOTAL_CAP}
              </span>
              <span className={styles.projectProgressSep}>·</span>
              <span className={styles.projectProgressRemain}>
                {totalRemaining} slot{totalRemaining === 1 ? '' : 's'} remain
              </span>
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
            href={`/directory${sortMode !== 'card' ? `?sort=${sortMode}` : ''}`}
            className={`${styles.filterBtn} ${!seriesFilter && seriesFilter !== 0 ? styles.active : ''}`}
          >
            all
          </Link>
          {allSeries.map(s => {
            const hon = isHonorary(s);
            const active = seriesFilter === s;
            const chipClass = `${styles.filterBtn} ${active ? styles.active : ''} ${hon ? styles.honoraryChip : ''}`;
            return (
              <Link
                key={s}
                href={`/directory?series=${s}${sortMode !== 'card' ? `&sort=${sortMode}` : ''}`}
                className={chipClass}
              >
                {hon ? 'Honorary' : toRoman(s)}
              </Link>
            );
          })}
          <span className={styles.filterSep}>·</span>
          <span className={styles.filterLabel}>sort</span>
          <Link
            href={`/directory${seriesFilter || seriesFilter === 0 ? `?series=${seriesFilter}` : ''}`}
            className={`${styles.filterBtn} ${sortMode === 'card' ? styles.active : ''}`}
          >
            card #
          </Link>
          <Link
            href={`/directory?${seriesFilter || seriesFilter === 0 ? `series=${seriesFilter}&` : ''}sort=rarity`}
            className={`${styles.filterBtn} ${sortMode === 'rarity' ? styles.active : ''}`}
          >
            rarity
          </Link>
          <Link
            href={`/directory?${seriesFilter || seriesFilter === 0 ? `series=${seriesFilter}&` : ''}sort=momentum`}
            className={`${styles.filterBtn} ${sortMode === 'momentum' ? styles.active : ''}`}
          >
            momentum
          </Link>
        </div>

        {topMomentum.length > 0 && (
          <div className={styles.momentumStrip}>
            <div className={styles.momentumHeader}>
              <span className={styles.momentumEyebrow}>gaining momentum</span>
              <span className={styles.momentumSub}>weighted by how trusted each recent backer is</span>
            </div>
            <div className={styles.momentumGrid}>
              {topMomentum.map(({ token, rawWindow, totalBurned, backers, trustedBackers }) => {
                const tier = tierFor(totalBurned);
                const thumb = token.art_mime?.startsWith('video/') ? token.art_cover_url : token.art_url;
                const whyNow = trustedBackers > 0
                  ? `${trustedBackers} trusted torchbearer${trustedBackers === 1 ? '' : 's'}`
                  : `${backers} backer${backers === 1 ? '' : 's'} this week`;
                return (
                  <Link key={token.token_name} href={`/card/${token.token_name}`} className={styles.momentumCard}>
                    <div className={styles.momentumThumb}>
                      {thumb ? <img src={thumb} alt={token.display_title || token.token_name} loading="lazy" /> : <div className={styles.momentumThumbBlank}>🐸</div>}
                    </div>
                    <div className={styles.momentumMeta}>
                      <div className={styles.momentumName}>{token.display_title || token.token_name}</div>
                      {token.artist_handle && (
                        <div className={styles.momentumArtist}>by @{token.artist_handle}</div>
                      )}
                      <div className={styles.momentumWhy}>{whyNow}</div>
                    </div>
                    <div className={styles.momentumFire} style={{ color: tier.color }}>
                      <div className={styles.momentumFireNow}>+{fmtCash(rawWindow)}</div>
                      <div className={styles.momentumFireLabel}>past 7 days</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

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
          seriesNumbers.map(seriesNum => {
            const hon = isHonorary(seriesNum);
            const filled = fillBySeries.get(seriesNum) ?? (grouped[seriesNum]?.length || 0);
            const cap = capForSeries(seriesNum);
            const sealed = filled >= cap;
            const pct = Math.min(100, Math.round((filled / cap) * 100));
            const label = hon ? 'HONORARY' : `SERIES ${toRoman(seriesNum)}`;
            const blockClass = `${styles.seriesHeader} ${hon ? styles.seriesHeaderHonorary : ''}`;
            return (
            <div key={seriesNum}>
              <div className={blockClass}>
                <div className={styles.seriesLabelRow}>
                  <div className={styles.seriesLabel}>
                    {hon
                      ? <>SERIES <span>0</span> · <em>HONORARY</em></>
                      : <>SERIES <span>{toRoman(seriesNum)}</span></>}
                  </div>
                  <div className={styles.seriesMeta}>
                    {hon ? (
                      <span className={styles.seriesCount}>
                        {filled}<span className={styles.seriesSlash}> / </span>{cap} curated
                      </span>
                    ) : sealed ? (
                      <span className={styles.seriesSealed}>SEALED · {filled} / {cap}</span>
                    ) : (
                      <span className={styles.seriesCount}>
                        {filled}<span className={styles.seriesSlash}> / </span>{cap}
                        <span className={styles.seriesRemain}> · {cap - filled} slot{cap - filled === 1 ? '' : 's'} left</span>
                      </span>
                    )}
                  </div>
                </div>
                {!hon && (
                  <div className={styles.seriesProgress} aria-hidden="true">
                    <div className={styles.seriesProgressFill} style={{ width: `${pct}%` }} />
                  </div>
                )}
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
                      {token.revealed_at && token.artist_handle && (
                        <div className={styles.cardArtist}>by @{token.artist_handle}</div>
                      )}
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
            );
          })
        )}

      </main>
    </>
  );
}
