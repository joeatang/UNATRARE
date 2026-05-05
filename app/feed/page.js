import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './feed.module.css';
import { getDb } from '../../lib/db.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const metadata = {
  title: 'Verdict Feed — UNATRARE',
  description: 'Every judgment. Every score. Every word from the pepai scientist panel.',
};

export const revalidate = 60;

// ── Judge persona display config ──────────────────────────────────
const JUDGE_META = {
  prof_naka_c:    { name: 'NAKAMOJO',       role: 'The Origin Signal',      sigil: '⬡' },
  dr_m_catalogus: { name: 'PROF.TG00DMAN',  role: 'The Archivist',          sigil: '⬢' },
  prof_j_looney:  { name: 'WALLETORIUS',    role: 'The Infrastructure Mind', sigil: '◈' },
  dank_shawn:     { name: 'COUNTERSHAW',    role: 'The Cultural Bridge',     sigil: '◉' },
  dj_pepai:       { name: 'DJ PEPAI',       role: 'The Culture Engine',      sigil: '◎' },
};

function getJudgeMeta(id) {
  return JUDGE_META[id] || { name: id.toUpperCase(), role: 'Judge', sigil: '○' };
}

function scoreBar(score, max = 69) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  // thresholds as % so they work for any scale
  const color = pct >= 64 ? 'var(--green-hot)' : pct >= 48 ? 'var(--amber-hot)' : 'var(--red)';
  return { pct, color };
}

function getCouncilDrops(preview = false) {
  try {
    // Try generated drops first (if fresh, < 24 hours old)
    const genPath = join(process.cwd(), 'data', 'generated_drops.json');
    let generatedDrops = null;
    if (existsSync(genPath)) {
      try {
        const gen = JSON.parse(readFileSync(genPath, 'utf8'));
        const age = Date.now() - (gen.generated_at || 0);
        if (age < 24 * 60 * 60 * 1000 && gen.drops) {
          generatedDrops = gen.drops; // { judge_id: [drop1, drop2, ...] }
        }
      } catch { /* fall through to static */ }
    }

    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'judges.config.json'), 'utf8'));
    const drops = cfg.council_drops;

    // Merge: prefer generated drops, fall back to static per judge
    const JUDGE_MAP = [
      { genKey: 'prof_naka_c',    cfgKey: 'nakamojo',     name: 'NAKAMOJO',      sigil: '⬡' },
      { genKey: 'prof_j_looney',  cfgKey: 'walletorius',  name: 'WALLETORIUS',   sigil: '◈' },
      { genKey: 'dank_shawn',     cfgKey: 'countershaw',  name: 'COUNTERSHAW',   sigil: '◉' },
      { genKey: 'dr_m_catalogus', cfgKey: 'prof_tg00dman', name: 'PROF.TG00DMAN', sigil: '⬢' },
      { genKey: 'dj_pepai',       cfgKey: 'dj_pepai',     name: 'DJ PEPAI',      sigil: '◎' },
    ];

    if (preview) {
      return JUDGE_MAP.map(j => {
        const genArr = generatedDrops?.[j.genKey];
        const text = (genArr && genArr[0]) ? genArr[0] : drops[j.cfgKey]?.[0];
        return { text, name: j.name, sigil: j.sigil };
      }).filter(d => d.text);
    }

    const all = JUDGE_MAP.flatMap(j => {
      const genArr = generatedDrops?.[j.genKey];
      const source = (genArr && genArr.length) ? genArr : (drops[j.cfgKey] || []);
      return source.map(d => ({ text: d, name: j.name, sigil: j.sigil }));
    });
    // Rotate 3x/day (every 8 hours)
    const seed = Math.floor(Date.now() / (8 * 60 * 60 * 1000));
    const picked = [];
    const used = new Set();
    for (let i = 0; i < 4; i++) {
      let idx = (seed * 7 + i * 13) % all.length;
      let tries = 0;
      while (used.has(idx) && tries < all.length) { idx = (idx + 1) % all.length; tries++; }
      used.add(idx);
      picked.push(all[idx]);
    }
    return picked;
  } catch { return []; }
}

function getFeedTokens() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT token_name, display_title, status, artist_handle, art_hash, art_url, art_mime,
             judge_score, judge_notes, judged_at, revealed_at, series, card_number,
             rejection_reason, is_demo
      FROM tokens
      WHERE status IN ('approved','rejected') AND judged_at IS NOT NULL
      ORDER BY is_demo ASC, judged_at DESC
    `).all();
    return rows.map(r => ({ ...r }));
  } catch {
    return [];
  }
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function toRoman(n) {
  const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
               [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let r = '';
  for (const [v, s] of map) { while (n >= v) { r += s; n -= v; } }
  return r;
}

function cardLabel(series, cardNumber) {
  if (!series || !cardNumber) return '';
  return `Series ${toRoman(series)} · Card #${String(cardNumber).padStart(3,'0')}`;
}

export default function FeedPage({ searchParams }) {
  const tokens = getFeedTokens();
  const preview = searchParams?.preview === '1';
  const drops = getCouncilDrops(preview);

  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>PEPE COUNCIL · ALL VERDICTS</div>
          <h1 className={styles.title}>VERDICT F<span>E</span>ED</h1>
          <p className={styles.subtitle}>
            Every submission judged. Every score recorded.
            Permanent on Bitcoin.
          </p>
          <div className={styles.headerStats}>
            <span>{tokens.filter(t => t.status === 'approved' && !t.is_demo).length} certified</span>
            <span className={styles.statDivider}>·</span>
            <span>{tokens.filter(t => t.status === 'rejected' && !t.is_demo).length} rejected</span>
            <span className={styles.statDivider}>·</span>
            <span>{tokens.filter(t => !t.is_demo).length} total verdicts</span>
          </div>
        </header>

        {/* ── Council Signal drops ── */}
        {drops.length > 0 && (
          <div className={styles.councilDrops}>
            <div className={styles.councilDropsLabel}>⬡ COUNCIL SIGNAL</div>
            <div className={styles.councilDropsGrid}>
              {drops.map((d, i) => (
                <div key={i} className={styles.councilDrop}>
                  <span className={styles.councilDropSigil}>{d.sigil}</span>
                  <span className={styles.councilDropText}>&ldquo;{d.text}&rdquo;</span>
                  <span className={styles.councilDropName}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tokens.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyGlyph}>?</div>
            <div className={styles.emptyText}>the panel is deliberating</div>
            <div className={styles.emptySubtext}>no verdicts recorded yet</div>
          </div>
        )}

        <div className={styles.feed}>
          {tokens.map(token => {
            let judges = [];
            try { judges = JSON.parse(token.judge_notes || '[]'); } catch { /* no-op */ }
            const avgScore = token.judge_score || 0;
            const bar = scoreBar(avgScore);
            const isApproved = token.status === 'approved';
            const isRevealed = !!token.revealed_at;
            const isDemo = !!token.is_demo;
            const artUrl = token.art_hash
              ? `https://unatrare.wtf/art/${token.art_hash}`
              : (token.art_url || null);

            return (
              <article key={token.token_name} className={`${styles.verdict}${isDemo ? ` ${styles.verdictDemo}` : ''}`}>

                {/* ── Verdict header ── */}
                <div className={styles.verdictHeader}>
                  <div className={styles.verdictLeft}>
                    {/* Thumbnail */}
                    <div className={styles.thumb}>
                      {(isApproved && isRevealed && artUrl) ? (
                        <img src={artUrl} alt={token.token_name}
                          className={styles.thumbImg} />
                      ) : (
                        <div className={styles.thumbPlaceholder}>
                          {isApproved ? '🔒' : '✗'}
                        </div>
                      )}
                    </div>

                    <div className={styles.verdictMeta}>
                      <div className={styles.verdictToken}>
                        <Link href={`/card/${token.token_name}`} className={styles.tokenLink}>
                          {token.token_name}
                        </Link>
                        {isDemo && (
                          <span className={`${styles.verdictBadge} ${styles.sample}`}>SAMPLE</span>
                        )}
                        <span className={`${styles.verdictBadge} ${isApproved ? styles.certified : styles.rejected}`}>
                          {isApproved ? 'CERTIFIED DANK' : 'REJECTED'}
                        </span>
                      </div>
                      {token.series && token.card_number && (
                        <div className={styles.cardLabel}>{cardLabel(token.series, token.card_number)}</div>
                      )}
                      {token.artist_handle && (
                        <div className={styles.artistHandle}>by @{token.artist_handle}</div>
                      )}
                      <div className={styles.verdictDate}>{formatDate(token.judged_at)}</div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className={styles.scoreBlock}>
                    <div className={styles.scoreNum} style={{color: bar.color}}>
                      {avgScore.toFixed(1)}
                    </div>
                    <div className={styles.scoreLabel}>/ 69</div>
                    <div className={styles.scoreBar}>
                      <div className={styles.scoreBarFill}
                        style={{width: `${bar.pct}%`, background: bar.color}} />
                    </div>
                  </div>
                </div>

                {/* ── Judge breakdown ── */}
                {judges.length > 0 && (
                  <div className={styles.judgeGrid}>
                    {judges.map((j) => {
                      const meta = getJudgeMeta(j.judge_id);
                      const jBar = scoreBar(j.raw_score, 45);
                      return (
                        <div key={j.judge_id} className={styles.judgeCard}>
                          <div className={styles.judgeHeader}>
                            <span className={styles.judgeSigil}>{meta.sigil}</span>
                            <div>
                              <div className={styles.judgeName}>{meta.name}</div>
                              <div className={styles.judgeRole}>{meta.role}</div>
                            </div>
                            <div className={styles.judgeScore} style={{color: jBar.color}}>
                              {j.raw_score.toFixed(0)}
                            </div>
                          </div>
                          {j.scores && (
                            <div className={styles.judgeCats}>
                              {Object.entries(j.scores).map(([cat, val]) => (
                                <span key={cat} className={styles.judgeCat}>
                                  <span className={styles.judgeCatLabel}>{cat.slice(0,4).toUpperCase()}</span>
                                  <span className={styles.judgeCatVal}>{val}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {j.reasoning && (
                            <p className={styles.judgeReason}>&ldquo;{j.reasoning}&rdquo;</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rejection reason */}
                {!isApproved && token.rejection_reason && (
                  <div className={styles.rejectionNote}>
                    <span className={styles.rejectionLabel}>PANEL NOTES</span>
                    {token.rejection_reason}
                  </div>
                )}

              </article>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className={styles.bottomCta}>
          <Link href="/submit" className={styles.ctaButton}>
            submit your art →
          </Link>
          <Link href="/terms" className={styles.ctaSecondary}>
            read enrollment rules →
          </Link>
        </div>

      </main>
    </>
  );
}
