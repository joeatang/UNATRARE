// The Feed — council verdicts, certified art, and cultural dispatches.
// Moved here from / when the universal landing page was added to /.
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './home.module.css';
import feedStyles from './feed.module.css';
import archiveStyles from '../archive/archive.module.css';
import { getDb } from '../../lib/db';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'The Feed — UNATRARE',
  description: 'Council verdicts, certified art, and cultural dispatches from the Pepe Council of 8.',
};

// ── Judge persona display config ─────────────────────────
const JUDGE_META = {
  prof_naka_c:    { name: 'NAKAMOJO',        role: 'The Origin Signal',        sigil: '⬡' },
  dr_m_catalogus: { name: 'M.CATALOGUS',     role: 'The Anonymous Archivist',  sigil: '⬢' },
  prof_j_looney:  { name: 'RARELOONEY',      role: 'The Infrastructure Mind',  sigil: '◈' },
  dank_shawn:     { name: 'DANKSHAWN',       role: 'The Cultural Bridge',      sigil: '◉' },
  theo_goodman:   { name: 'PROF.TG00DMAN',   role: 'The Bitcoin Comedian',     sigil: '◆' },
  dj_pepai:       { name: 'DJ PEPAI',        role: 'The Culture Engine',       sigil: '◎' },
  chiguiripepe:   { name: 'CHIGUIRIPEPE',    role: 'The Venezuelan Ghost',     sigil: '⬟' },
  j_frog:         { name: 'J.FROG',          role: 'The Infrastructure Frog',  sigil: '▧' },
};

function getJudgeMeta(id) {
  return JUDGE_META[id] || { name: id.toUpperCase(), role: 'Judge', sigil: '○' };
}

function scoreBar(score, max = 69) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = pct >= 64 ? 'var(--green-hot)' : pct >= 48 ? 'var(--amber-hot)' : 'var(--red)';
  return { pct, color };
}

function getDropsHistory() {
  try {
    const histPath = join(process.cwd(), 'data', 'drops_history.json');
    if (existsSync(histPath)) {
      const { drops } = JSON.parse(readFileSync(histPath, 'utf8'));
      if (Array.isArray(drops) && drops.length) return drops;
    }
    // Fallback: legacy generated_drops.json → flatten to entries with ts=0 (appear at bottom)
    const legPath = join(process.cwd(), 'data', 'generated_drops.json');
    if (existsSync(legPath)) {
      const gen = JSON.parse(readFileSync(legPath, 'utf8'));
      const age = Date.now() - (gen.generated_at || 0);
      if (age < 24 * 60 * 60 * 1000 && gen.drops) {
        const JUDGE_META_MAP = {
          prof_naka_c:    { name: 'NAKAMOJO',      sigil: '⬡' },
          prof_j_looney:  { name: 'RARELOONEY',    sigil: '◈' },
          dank_shawn:     { name: 'DANKSHAWN',      sigil: '◉' },
          dr_m_catalogus: { name: 'M.CATALOGUS',   sigil: '⬢' },
          theo_goodman:   { name: 'PROF.TG00DMAN', sigil: '◆' },
          dj_pepai:       { name: 'DJ PEPAI',       sigil: '◎' },
        };
        const ts = Math.floor((gen.generated_at || Date.now()) / 1000);
        return Object.entries(gen.drops).flatMap(([judgeId, texts]) => {
          const meta = JUDGE_META_MAP[judgeId] || { name: judgeId.toUpperCase(), sigil: '○' };
          return texts.map((text, i) => ({
            id: `legacy_${judgeId}_${i}`, judge_id: judgeId,
            judge_name: meta.name, sigil: meta.sigil, text, ts,
          }));
        });
      }
    }
    return [];
  } catch { return []; }
}

function getArchiveSummary() {
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT COUNT(*) as n FROM archived_tokens WHERE fetch_status = 'fetched'"
    ).get();
    const total = row?.n ?? 0;
    const recent = db.prepare(
      "SELECT asset_name, collection, art_hash, art_mime FROM archived_tokens WHERE fetch_status='fetched' ORDER BY scraped_at DESC LIMIT 6"
    ).all();
    return { total, recent };
  } catch { return { total: 0, recent: [] }; }
}

function getPageData() {
  try {
    const db = getDb();
    const feedTokens = db.prepare(`
      SELECT token_name, display_title, status, artist_handle, art_hash, art_url, art_mime,
             judge_score, judge_notes, judged_at, revealed_at, series, card_number,
             rejection_reason, is_demo
      FROM tokens
      WHERE status IN ('approved','rejected') AND judged_at IS NOT NULL
      ORDER BY is_demo ASC, judged_at DESC
    `).all();
    const vaultCount  = db.prepare("SELECT COUNT(*) as n FROM vault_assets").get().n;
    const vaultRecent = db.prepare(
      "SELECT art_hash, art_mime, token_name FROM vault_assets ORDER BY uploaded_at DESC LIMIT 4"
    ).all();
    return {
      feedTokens: feedTokens.map(r => ({ ...r })),
      drops:      getDropsHistory(),
      vaultCount,
      vaultRecent: vaultRecent.map(r => ({ ...r })),
    };
  } catch {
    return { feedTokens: [], drops: [], vaultCount: 0, vaultRecent: [] };
  }
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toRoman(n) {
  const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
               [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  return map.reduce((s,[v,r]) => { while(n>=v){s+=r;n-=v;} return s; }, '');
}

function cardLabel(series, cardNumber) {
  if (!series || !cardNumber) return '';
  return `Series ${toRoman(series)} · Card #${String(cardNumber).padStart(3,'0')}`;
}

export default function FeedPage() {
  const { feedTokens, drops, vaultCount, vaultRecent } = getPageData();
  const { total: archiveTotal, recent: archiveRecent } = getArchiveSummary();
  const nonDemo = feedTokens.filter(t => !t.is_demo);
  const showcaseTokens = feedTokens
    .filter(t => t.status === 'approved' && t.revealed_at && t.art_hash && !t.is_demo)
    .slice(0, 6);

  function archiveArtUrl(a) {
    if (!a?.art_hash) return null;
    const ext = a.art_mime?.includes('gif') ? 'gif' : a.art_mime?.includes('jpg') || a.art_mime?.includes('jpeg') ? 'jpg' : 'png';
    return `/uploads/archive/${a.collection}/${a.art_hash}.${ext}`;
  }

  function vaultArtUrl(a) {
    if (!a?.art_hash) return null;
    const ext = a.art_mime?.includes('gif') ? 'gif' : a.art_mime?.includes('jpg') || a.art_mime?.includes('jpeg') ? 'jpg' : a.art_mime?.includes('webp') ? 'webp' : 'png';
    return `/uploads/vault/${a.art_hash}.${ext}`;
  }

  // Unified chronological timeline — verdicts + signal drops interleaved by timestamp
  const timeline = [
    ...feedTokens.map(t => ({ _type: 'verdict', _ts: t.judged_at || 0, ...t })),
    ...drops.map(d => ({ _type: 'drop', _ts: d.ts || 0, ...d })),
  ].sort((a, b) => b._ts - a._ts);

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          <div className={styles.eyebrow}>· bitcoin · counterparty · dmt-nat ·</div>
          <h1 className={styles.heroTitle}>THE DIRECT<span>O</span>RY</h1>
          <div className={styles.heroSub}>The curated registry of Counterparty art on Bitcoin.</div>
          <p className={styles.heroExplainer}>
            Every submission judged by the Pepe Council. Only the best get listed — permanently, on Bitcoin.
            The art is Counterparty. The currency is NAT. The Council is the filter.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/directory" className={styles.heroCtaPrimary}>browse the directory →</Link>
            <Link href="/submit" className={styles.heroCtaSecondary}>submit your token →</Link>
          </div>
        </section>

        {/* ── RECENTLY CERTIFIED ── */}
        {showcaseTokens.length > 0 && (
          <section className={styles.showcaseSection}>
            <div className={styles.sectionLabel}>recently certified</div>
            <div className={styles.showcaseRow}>
              {showcaseTokens.map(t => (
                <Link key={t.token_name} href={`/card/${t.token_name}`} className={styles.showcaseCard}>
                  <div className={styles.showcaseImg}>
                    <img src={`https://unatrare.wtf/art/${t.art_hash}`} alt={t.token_name} />
                  </div>
                  <div className={styles.showcaseToken}>{t.token_name}</div>
                  {t.display_title && <div className={styles.showcaseName}>{t.display_title}</div>}
                </Link>
              ))}
            </div>
            <div className={styles.showcaseFooter}>
              <Link href="/directory" className={styles.showcaseAll}>browse all certified →</Link>
            </div>
          </section>
        )}

        {/* ── Unified Timeline: Verdicts + Council Signal drops ── */}
        <div className={styles.feedBlock}>
        <div className={feedStyles.header} style={{ marginTop: 48 }}>
          <div className={feedStyles.eyebrow}>THE COUNCIL · LIVE</div>
          <h2 className={feedStyles.title}>THE F<span>E</span>ED</h2>
          <p className={feedStyles.subtitle}>
            Verdicts, council commentary, and cultural dispatches — all in one place.
          </p>
          <div className={feedStyles.headerStats}>
            <span>{nonDemo.filter(t => t.status === 'approved').length} certified</span>
            <span className={feedStyles.statDivider}>·</span>
            <span>{nonDemo.filter(t => t.status === 'rejected').length} rejected</span>
            <span className={feedStyles.statDivider}>·</span>
            <span>{nonDemo.length} total verdicts</span>
            {drops.length > 0 && (<>
              <span className={feedStyles.statDivider}>·</span>
              <span>{drops.length} council posts</span>
            </>)}
          </div>
        </div>

        {timeline.length === 0 && (
          <div className={feedStyles.emptyState}>
            <div className={feedStyles.emptyGlyph}>?</div>
            <div className={feedStyles.emptyText}>the panel is deliberating</div>
            <div className={feedStyles.emptySubtext}>no verdicts recorded yet</div>
          </div>
        )}

        <div className={feedStyles.feed}>
          {timeline.map((item, idx) => {
            if (item._type === 'drop') {
              return (
                <div key={item.id || `drop-${idx}`} className={feedStyles.signalPost}>
                  <div className={feedStyles.signalPostHeader}>
                    <span className={feedStyles.signalPostSigil}>{item.sigil}</span>
                    <div>
                      <div className={feedStyles.signalPostName}>{item.judge_name}</div>
                    </div>
                    {item.ts > 0 && (
                      <span className={feedStyles.signalPostTime}>{formatDate(item.ts)}</span>
                    )}
                  </div>
                  <p className={feedStyles.signalPostText}>&ldquo;{item.text}&rdquo;</p>
                </div>
              );
            }

            // Verdict card
            const token = item;
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
              <article key={token.token_name} className={`${feedStyles.verdict}${isDemo ? ` ${feedStyles.verdictDemo}` : ''}`}>
                <div className={feedStyles.verdictHeader}>
                  <div className={feedStyles.verdictLeft}>
                    <div className={feedStyles.thumb}>
                      {(isApproved && isRevealed && artUrl) ? (
                        <img src={artUrl} alt={token.token_name} className={feedStyles.thumbImg} />
                      ) : (
                        <div className={feedStyles.thumbPlaceholder}>{isApproved ? '🔒' : '✗'}</div>
                      )}
                    </div>
                    <div className={feedStyles.verdictMeta}>
                      <div className={feedStyles.verdictToken}>
                        <Link href={`/card/${token.token_name}`} className={feedStyles.tokenLink}>
                          {token.token_name}
                        </Link>
                        {isDemo && <span className={`${feedStyles.verdictBadge} ${feedStyles.sample}`}>SAMPLE</span>}
                        <span className={`${feedStyles.verdictBadge} ${isApproved ? feedStyles.certified : feedStyles.rejected}`}>
                          {isApproved ? 'CERTIFIED DANK' : 'REJECTED'}
                        </span>
                      </div>
                      {token.series && token.card_number && (
                        <div className={feedStyles.cardLabel}>{cardLabel(token.series, token.card_number)}</div>
                      )}
                      {token.artist_handle && (
                        <div className={feedStyles.artistHandle}>by @{token.artist_handle}</div>
                      )}
                      <div className={feedStyles.verdictDate}>{formatDate(token.judged_at)}</div>
                    </div>
                  </div>
                  <div className={feedStyles.scoreBlock}>
                    <div className={feedStyles.scoreNum} style={{ color: bar.color }}>{avgScore.toFixed(1)}</div>
                    <div className={feedStyles.scoreLabel}>/ 69</div>
                    <div className={feedStyles.scoreBar}>
                      <div className={feedStyles.scoreBarFill} style={{ width: `${bar.pct}%`, background: bar.color }} />
                    </div>
                  </div>
                </div>

                {judges.length > 0 && (
                  <div className={feedStyles.judgeGrid}>
                    {judges.map((j) => {
                      const meta = getJudgeMeta(j.judge_id);
                      const jBar = scoreBar(j.raw_score, 45);
                      return (
                        <div key={j.judge_id} className={feedStyles.judgeCard}>
                          <div className={feedStyles.judgeHeader}>
                            <span className={feedStyles.judgeSigil}>{meta.sigil}</span>
                            <div>
                              <div className={feedStyles.judgeName}>{meta.name}</div>
                              <div className={feedStyles.judgeRole}>{meta.role}</div>
                            </div>
                            <div className={feedStyles.judgeScore} style={{ color: jBar.color }}>
                              {j.raw_score.toFixed(0)}
                            </div>
                          </div>
                          {j.scores && (
                            <div className={feedStyles.judgeCats}>
                              {Object.entries(j.scores).map(([cat, val]) => (
                                <span key={cat} className={feedStyles.judgeCat}>
                                  <span className={feedStyles.judgeCatLabel}>{cat.slice(0,4).toUpperCase()}</span>
                                  <span className={feedStyles.judgeCatVal}>{val}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {j.reasoning && <p className={feedStyles.judgeReason}>&ldquo;{j.reasoning}&rdquo;</p>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isApproved && token.rejection_reason && (
                  <div className={feedStyles.rejectionNote}>
                    <span className={feedStyles.rejectionLabel}>PANEL NOTES</span>
                    {token.rejection_reason}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        </div>{/* end feedBlock */}

        {/* ── ARCHIVE BANNER ── */}
        <section className={styles.archiveBanner}>
          <div className={styles.archiveBannerInner}>
            <div className={styles.archiveBannerLeft}>
              <div className={styles.archiveBannerEyebrow}>· the archive ·</div>
              <div className={styles.archiveBannerTitle}>
                THE PERMANENT HOME FOR COUNTERPARTY ART HISTORY
              </div>
              <div className={styles.archiveBannerSub}>
                Rare Pepe Series 1–38 · broken Arweave links · dead IPFS nodes ·
                every card, hashed and served forever from Bitcoin&apos;s oldest art protocol.
              </div>
              <div className={styles.archiveBannerStats}>
                {archiveTotal > 0 ? (
                  <><span className={styles.archiveBannerCount}>{archiveTotal.toLocaleString()}</span> cards preserved</>
                ) : (
                  <span className={styles.archiveBannerCount}>seeding...</span>
                )}
              </div>
              <Link href="/archive" className={styles.archiveBannerCta}>
                explore the archive →
              </Link>
            </div>
            {archiveRecent.length > 0 && (
              <div className={styles.archiveBannerPreviews}>
                {archiveRecent.slice(0, 4).map(a => {
                  const url = archiveArtUrl(a);
                  return url ? (
                    <div key={a.asset_name} className={styles.archiveBannerThumb}>
                      <img src={url} alt={a.asset_name} />
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── PEPE VAULT ── */}
        {vaultCount > 0 && (
          <section className={styles.vaultBanner}>
            <div className={styles.vaultBannerInner}>
              <div className={styles.vaultBannerLeft}>
                <div className={styles.vaultBannerEyebrow}>· pepe vault ·</div>
                <div className={styles.vaultBannerTitle}>
                  COUNTERPARTY ART, STORED ON THE UNATRARE NETWORK
                </div>
                <div className={styles.vaultBannerSub}>
                  Artists store their Counterparty token art directly on UNATRARE infrastructure —
                  permanent, Bitcoin-native, no Arweave required.
                </div>
                <div className={styles.vaultBannerStats}>
                  <span className={styles.vaultBannerCount}>{vaultCount}</span>
                  {vaultCount === 1 ? 'Counterparty token sealed in the vault' : 'Counterparty tokens sealed in the vault'}
                </div>
                <Link href="/vault" className={styles.vaultBannerCta}>
                  explore the vault →
                </Link>
              </div>
              {vaultRecent.length > 0 && (
                <div className={styles.vaultBannerThumbs}>
                  {vaultRecent.map(a => {
                    const url = vaultArtUrl(a);
                    return url ? (
                      <div key={a.token_name} className={styles.vaultBannerThumb}>
                        <img src={url} alt={a.token_name} />
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <div className={styles.ctaStrip}>
          <div className={styles.ctaTitle}>IS YOUR ART DANK ENOUGH?</div>
          <div className={styles.ctaSub}>
            get your submission URL first.<br />
            then create your counterparty token.<br />
            then submit to the pepe council.
          </div>
          <Link href="/submit" className={styles.ctaButton}>submit your token →</Link>
          <div style={{ marginTop: 16 }}>
            <Link href="/terms" style={{ fontFamily: 'var(--font-card)', fontSize: '10px', letterSpacing: '3px', color: 'var(--text-dim)', textDecoration: 'none' }}>
              read enrollment rules →
            </Link>
          </div>
        </div>

        <div className={styles.holderStrip}>
          <div className={styles.holderLeft}>
            <div className={styles.holderTitle}>✦ UNATPEPE HOLDER?</div>
            <div className={styles.holderSub}>Holding UNATPEPE is the key to UNATRARE drops — certified Counterparty art, priced in DMT-NAT, open to you before anyone else.</div>
          </div>
          <Link href="/register" className={styles.holderBtn}>register now →</Link>
        </div>

      </main>
    </>
  );
}
