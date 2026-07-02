import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import styles from './torchbearer.module.css';
import { getDb } from '../../../lib/db';
import { fmtCash, tierFor, truncateWallet } from '../../../lib/saluteDisplay';
import { getTorchbearer, displayFor } from '../../../lib/torchbearerIdentity';
import { getSignalWeight, signalTier } from '../../../lib/signalWeight';
import { getCosignsForTorchbearer } from '../../../lib/artistCosign';
import { getIdentityBadges } from '../../../lib/identityBadges';
import CosignButton from './CosignButton';
import BlockShare from '../../components/BlockShare';
import IdentityBadges from '../../components/IdentityBadges';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function relTime(unixSec) {
  if (!unixSec) return '—';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(Number(unixSec) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getTorchbearerData(wallet) {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT
        COALESCE(SUM(amount_display), 0) AS total_burned,
        COALESCE(SUM(artist_amount_display), 0) AS total_artist,
        COALESCE(SUM(node_amount_display), 0) AS total_node,
        COUNT(*) AS salute_count,
        COUNT(DISTINCT card_name) AS cards_supported,
        COUNT(DISTINCT CASE WHEN t.artist_address != '' THEN t.artist_address END) AS artists_supported,
        MIN(cs.burned_at) AS first_burn_at,
        MAX(cs.burned_at) AS last_burn_at
      FROM card_salutes cs
      LEFT JOIN tokens t ON t.token_name = cs.card_name
      WHERE cs.sol_wallet = ?
    `).get(wallet);

    const topCards = db.prepare(`
      SELECT
        cs.card_name,
        COALESCE(t.display_title, cs.card_name) AS display_title,
        COALESCE(t.artist_handle, '') AS artist_handle,
        t.art_url,
        t.art_mime,
        t.art_cover_url,
        SUM(cs.amount_display) AS total_burned,
        COUNT(*) AS salute_count,
        MIN(cs.burned_at) AS first_burn_at,
        MAX(cs.burned_at) AS last_burn_at
      FROM card_salutes cs
      LEFT JOIN tokens t ON t.token_name = cs.card_name
      WHERE cs.sol_wallet = ?
      GROUP BY cs.card_name
      ORDER BY total_burned DESC, salute_count DESC, first_burn_at ASC
      LIMIT 12
    `).all(wallet);

    const recent = db.prepare(`
      SELECT
        cs.card_name,
        COALESCE(t.display_title, cs.card_name) AS display_title,
        COALESCE(t.artist_handle, '') AS artist_handle,
        cs.amount_display,
        cs.tx_sig,
        cs.burned_at
      FROM card_salutes cs
      LEFT JOIN tokens t ON t.token_name = cs.card_name
      WHERE cs.sol_wallet = ?
      ORDER BY cs.burned_at DESC, cs.id DESC
      LIMIT 20
    `).all(wallet);

    const genesis = db.prepare(`
      SELECT COUNT(*) AS n
      FROM card_salutes cs
      WHERE cs.sol_wallet = ?
        AND cs.id IN (
          SELECT first_row.id
          FROM (
            SELECT id, card_name
            FROM card_salutes
            ORDER BY burned_at ASC, id ASC
          ) first_row
          GROUP BY first_row.card_name
        )
    `).get(wallet);

    return {
      stats: stats || null,
      topCards,
      recent,
      genesisCount: Number(genesis?.n || 0),
    };
  } catch {
    return { stats: null, topCards: [], recent: [], genesisCount: 0 };
  }
}

export async function generateMetadata({ params }) {
  const wallet = decodeURIComponent((await params).wallet);
  const identity = SOL_ADDR_RE.test(wallet) ? getTorchbearer(wallet) : null;
  const disp = identity ? displayFor(identity, wallet) : null;
  const hasBlock = disp && disp.block != null;
  const title = `${truncateWallet(wallet)} — Torchbearer — UNATRARE`;
  const description = hasBlock
    ? `${disp.label} holds Bitcoin Block #${disp.block.toLocaleString()} on UNATRARE — certified Counterparty art, on Bitcoin.`
    : `Salute history and campaign fire record for ${wallet} on UNATRARE.`;
  return {
    title,
    description,
    openGraph: hasBlock
      ? {
          title,
          description,
          images: [{ url: `/api/og/block/${wallet}`, width: 1200, height: 630 }],
        }
      : { title, description },
    twitter: hasBlock
      ? { card: 'summary_large_image', title, description, images: [`/api/og/block/${wallet}`] }
      : undefined,
  };
}

export const revalidate = 60;

export default async function TorchbearerPage({ params }) {
  const wallet = decodeURIComponent((await params).wallet);
  if (!SOL_ADDR_RE.test(wallet)) notFound();

  const data = getTorchbearerData(wallet);
  if (!data.stats || Number(data.stats.salute_count || 0) === 0) notFound();

  const tier = tierFor(data.stats.total_burned);
  const identity = getTorchbearer(wallet);
  const disp = displayFor(identity, wallet);
  const signal = getSignalWeight(wallet);
  const sigTier = signal ? signalTier(signal.score) : null;
  const cosigns = getCosignsForTorchbearer(wallet);
  const badges = getIdentityBadges(wallet);

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <Link href="/burns?tab=wallets" className={styles.backLink}>← back to top torchbearers</Link>

        <header className={styles.header}>
          <div className={styles.eyebrow}>torchbearer ledger</div>
          {disp.avatar && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={disp.avatar} alt={disp.label} className={styles.avatar} loading="lazy" />
          )}
          <h1 className={styles.title}>{disp.label}</h1>
          {disp.handle && disp.name && <div className={styles.displayName}>{disp.name}</div>}
          {disp.showWallet ? (
            <div className={styles.wallet}>{wallet}</div>
          ) : (
            <div className={styles.wallet}>{truncateWallet(wallet)} · <span className={styles.anonTag}>anon</span></div>
          )}
          {disp.block != null && (
            <BlockShare
              variant="pill"
              wallet={wallet}
              block={disp.block}
              subtitle={disp.handle ? `@${disp.handle}` : disp.label}
            />
          )}
          {disp.bio && <p className={styles.bio}>{disp.bio}</p>}
          {(disp.twitter || disp.website) && (
            <div className={styles.socials}>
              {disp.twitter && <a href={`https://x.com/${disp.twitter}`} target="_blank" rel="noopener noreferrer">@{disp.twitter}</a>}
              {disp.website && <a href={disp.website} target="_blank" rel="noopener noreferrer">website ↗</a>}
            </div>
          )}
          <div className={styles.tier} style={{ color: tier.color, borderColor: `${tier.color}55` }}>
            {tier.label}
          </div>
          <IdentityBadges badges={badges} />
          <div className={styles.claimHint}>
            <Link href="/torchbearer/claim">{disp.claimed ? 'this is you? edit your profile →' : 'this is you? claim your handle →'}</Link>
          </div>
        </header>

        {signal && (
          <section className={styles.signalBanner} style={{ borderColor: `${sigTier.color}55` }}>
            <div className={styles.signalMain}>
              <div className={styles.signalLabel}>signal weight</div>
              <div className={styles.signalScore} style={{ color: sigTier.color }}>
                {Math.round(signal.score).toLocaleString()}
              </div>
              <div className={styles.signalTier} style={{ color: sigTier.color, borderColor: `${sigTier.color}55` }}>
                {sigTier.label}
              </div>
            </div>
            <div className={styles.signalParts}>
              <div className={styles.signalPart}>
                <span className={styles.signalPartValue}>{signal.early_salutes}</span>
                <span className={styles.signalPartLabel}>early backs</span>
              </div>
              <div className={styles.signalPart}>
                <span className={styles.signalPartValue}>{signal.artists}</span>
                <span className={styles.signalPartLabel}>artists backed</span>
              </div>
              <div className={styles.signalPart}>
                <span className={styles.signalPartValue}>{signal.active_days}</span>
                <span className={styles.signalPartLabel}>active days</span>
              </div>
              {signal.founder > 0 && (
                <div className={styles.signalPart}>
                  <span className={styles.signalPartValue}>⛓</span>
                  <span className={styles.signalPartLabel}>founder</span>
                </div>
              )}
              {Number(signal.cosign_count || 0) > 0 && (
                <div className={styles.signalPart}>
                  <span className={styles.signalPartValue}>{signal.cosign_count}</span>
                  <span className={styles.signalPartLabel}>artist co-sign{signal.cosign_count === 1 ? '' : 's'}</span>
                </div>
              )}
            </div>
            <div className={styles.signalNote}>
              Earned by backing art <strong>early</strong> (before the Council certifies),
              <strong> broadly</strong> and <strong>consistently</strong> — not by any single big burn.
            </div>
          </section>
        )}

        {/* ── Artist co-signs (Phase 7) ────────────────────────────── */}
        <section className={styles.cosigns}>
          <div className={styles.cosignsHead}>
            <div className={styles.cosignsTitle}>
              artist co-signs
              {cosigns.length > 0 && <span className={styles.cosignsCount}>{cosigns.length}</span>}
            </div>
            <CosignButton torchbearerWallet={wallet} torchbearerLabel={disp.label} />
          </div>
          {cosigns.length > 0 ? (
            <ul className={styles.cosignsList}>
              {cosigns.map((c, i) => (
                <li key={i} className={styles.cosignItem}>
                  <span className={styles.cosignArtist}>
                    {c.artist_handle ? `@${c.artist_handle}` : truncateWallet(c.artist_sol_address)}
                  </span>
                  {c.note && <span className={styles.cosignNote}>“{c.note}”</span>}
                  <span className={styles.cosignWhen}>{relTime(c.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.cosignsEmpty}>
              No co-signs yet. A verified artist can vouch for this torchbearer — a
              cryptographic endorsement that lifts their Signal Weight.
            </p>
          )}
        </section>


        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>total burned</div>
            <div className={styles.statValue}>🔥 {fmtCash(data.stats.total_burned)}</div>
            <div className={styles.statSub}>direct salute fire carried by this wallet</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>cards saluted</div>
            <div className={styles.statValue}>{data.stats.cards_supported}</div>
            <div className={styles.statSub}>{data.stats.salute_count} salute{data.stats.salute_count === 1 ? '' : 's'} recorded</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>artists honored</div>
            <div className={styles.statValue}>{data.stats.artists_supported}</div>
            <div className={styles.statSub}>unique artist addresses reached</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>genesis marks</div>
            <div className={styles.statValue}>{data.genesisCount}</div>
            <div className={styles.statSub}>cards first ignited by this wallet</div>
          </div>
        </section>

        <section className={styles.metaStrip}>
          <span>first salute {relTime(data.stats.first_burn_at)}</span>
          <span className={styles.metaSep}>·</span>
          <span>latest salute {relTime(data.stats.last_burn_at)}</span>
          {(Number(data.stats.total_artist || 0) > 0 || Number(data.stats.total_node || 0) > 0) && (
            <>
              <span className={styles.metaSep}>·</span>
              <span>{fmtCash(data.stats.total_artist || 0)} routed to artists</span>
            </>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>strongest fires</div>
          <div className={styles.list}>
            {data.topCards.map((row, index) => {
              const thumb = row.art_mime?.startsWith('video/') ? row.art_cover_url : row.art_url;
              return (
                <Link key={row.card_name} href={`/card/${row.card_name}`} className={styles.cardRow}>
                  <div className={styles.rank}>{index + 1}</div>
                  <div className={styles.thumb}>
                    {thumb ? <img src={thumb} alt={row.display_title} loading="lazy" /> : <div className={styles.thumbBlank}>🐸</div>}
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardTitle}>{row.display_title}</div>
                    <div className={styles.cardSub}>
                      {row.artist_handle ? `@${row.artist_handle}` : row.card_name}
                      {' · '}{row.salute_count} salute{row.salute_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className={styles.amount}>🔥 {fmtCash(row.total_burned)}</div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>recent fire trail</div>
          <div className={styles.list}>
            {data.recent.map((row) => (
              <Link key={row.tx_sig} href={`/card/${row.card_name}`} className={styles.cardRow}>
                <div className={styles.rank}>🔥</div>
                <div className={styles.cardMeta}>
                  <div className={styles.cardTitle}>{row.display_title}</div>
                  <div className={styles.cardSub}>
                    {row.artist_handle ? `@${row.artist_handle}` : row.card_name}
                    {' · '}{relTime(row.burned_at)}
                    {' · '}
                    <a
                      href={`https://solscan.io/tx/${row.tx_sig}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.solscan}
                    >
                      proof ↗
                    </a>
                  </div>
                </div>
                <div className={styles.amount}>{fmtCash(row.amount_display)}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}