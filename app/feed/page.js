import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './feed.module.css';
import { getDb } from '../../lib/db.js';

export const metadata = {
  title: 'Verdict Feed — UNATRARE',
  description: 'Every judgment. Every score. Every word from the pepai scientist panel.',
};

export const revalidate = 60;

// ── Judge persona display config ──────────────────────────────────
const JUDGE_META = {
  prof_naka_c:    { name: 'PROF NAKA C',     role: 'Chief Scientist',       sigil: '⬡' },
  dr_m_catalogus: { name: 'DR. M. CATALOGUS', role: 'Cultural Archivist',    sigil: '⬢' },
  prof_j_looney:  { name: 'PROF. J. LOONEY',  role: 'Craft Inspector',       sigil: '◈' },
  dank_shawn:     { name: 'DANK SHAWN',        role: 'Spirit Assessor',       sigil: '◉' },
  dj_pepai:       { name: 'DJ PEPAI',          role: 'Vibe Verification',     sigil: '◎' },
};

function getJudgeMeta(id) {
  return JUDGE_META[id] || { name: id.toUpperCase(), role: 'Judge', sigil: '○' };
}

function scoreBar(score, max = 40) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = score >= 32 ? 'var(--green-hot)' : score >= 25 ? 'var(--amber-hot)' : 'var(--red)';
  return { pct, color };
}

function getFeedTokens() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT token_name, display_title, status, artist_handle, art_hash, art_mime,
             judge_score, judge_notes, judged_at, revealed_at, series, card_number,
             rejection_reason
      FROM tokens
      WHERE status IN ('approved','rejected') AND judged_at IS NOT NULL
      ORDER BY judged_at DESC
      LIMIT 50
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

export default function FeedPage() {
  const tokens = getFeedTokens();

  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>SCIENTIST PANEL · ALL VERDICTS</div>
          <h1 className={styles.title}>VERDICT F<span>E</span>ED</h1>
          <p className={styles.subtitle}>
            Every submission judged. Every score recorded.
            Permanent on Bitcoin.
          </p>
          <div className={styles.headerStats}>
            <span>{tokens.filter(t => t.status === 'approved').length} certified</span>
            <span className={styles.statDivider}>·</span>
            <span>{tokens.filter(t => t.status === 'rejected').length} rejected</span>
            <span className={styles.statDivider}>·</span>
            <span>{tokens.length} total verdicts</span>
          </div>
        </header>

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
            const artUrl = token.art_hash
              ? `https://unatrare.wtf/art/${token.art_hash}`
              : null;

            return (
              <article key={token.token_name} className={styles.verdict}>

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
                    <div className={styles.scoreLabel}>/ 40</div>
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
                      const jBar = scoreBar(j.raw_score);
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
