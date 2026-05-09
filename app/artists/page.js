import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './artists.module.css';
import { getDb } from '../../lib/db';

function getArtistArchive() {
  try {
    const db = getDb();

    // Base stats: all unique approved artists
    const stats = db.prepare(`
      SELECT
        artist_address AS btc_address,
        COUNT(*)       AS card_count,
        MAX(judged_at) AS last_active,
        MIN(submitted_at) AS first_submitted,
        MIN(CASE WHEN revealed_at IS NOT NULL AND art_url != '' THEN art_url END) AS sample_art
      FROM tokens
      WHERE status = 'approved'
        AND artist_address != ''
        AND (is_demo IS NULL OR is_demo = 0)
        AND (directory_hidden IS NULL OR directory_hidden = 0)
      GROUP BY artist_address
    `).all();

    if (stats.length === 0) return [];

    // Enrich: artist profile records
    const profiles = db.prepare('SELECT * FROM artists').all();
    const profileMap = Object.fromEntries(profiles.map(p => [p.btc_address, p]));

    // Enrich: default handle from tokens
    const handleRows = db.prepare(`
      SELECT artist_address, artist_handle FROM tokens
      WHERE artist_handle != '' AND status = 'approved'
      GROUP BY artist_address
    `).all();
    const handleMap = Object.fromEntries(handleRows.map(r => [r.artist_address, r.artist_handle]));

    // Enrich: series per artist
    const seriesRows = db.prepare(`
      SELECT DISTINCT artist_address, series FROM tokens
      WHERE status = 'approved' AND artist_address != ''
        AND (is_demo IS NULL OR is_demo = 0)
      ORDER BY series ASC
    `).all();
    const seriesMap = {};
    for (const r of seriesRows) {
      if (!seriesMap[r.artist_address]) seriesMap[r.artist_address] = [];
      seriesMap[r.artist_address].push(r.series);
    }

    const artists = stats.map(s => {
      const p = profileMap[s.btc_address];
      return {
        btc_address:   s.btc_address,
        card_count:    s.card_count,
        last_active:   s.last_active,
        first_submitted: s.first_submitted,
        sample_art:    p?.pfp_url || s.sample_art || '',
        alias:         p?.alias || handleMap[s.btc_address] || null,
        anonymous:     p?.anonymous ?? 0,
        archive_index: p?.archive_index ?? null,
        bio:           p?.bio ?? '',
        series_list:   seriesMap[s.btc_address] || [],
      };
    });

    // Sort: archive-indexed first (ascending), then by first submission date
    artists.sort((a, b) => {
      if (a.archive_index != null && b.archive_index != null) return a.archive_index - b.archive_index;
      if (a.archive_index != null) return -1;
      if (b.archive_index != null) return 1;
      return (a.first_submitted ?? 0) - (b.first_submitted ?? 0);
    });

    return artists;
  } catch (e) {
    console.error('[artist-archive]', e);
    return [];
  }
}

function fmtDate(unix) {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const revalidate = 60;

export default function ArtistsPage() {
  const artists = getArtistArchive();

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.eyebrow}>· underground index ·</div>
          <h1 className={styles.title}>ARTIST<span>S</span></h1>
          <div className={styles.sub}>
            {artists.length === 0
              ? 'no entries filed yet'
              : `${artists.length} ${artists.length === 1 ? 'entry' : 'entries'} filed in the archive`}
          </div>
        </div>

        {artists.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>ARCHIVE PENDING</div>
            <p className={styles.emptyText}>
              The first certified card opens the index.<br />
              Artists enter the archive when their work is certified.
            </p>
            <Link href="/submit" className={styles.emptyBtn}>submit your art →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {artists.map((artist, i) => {
              const displayName = artist.anonymous
                ? `ANON_${artist.btc_address.slice(0, 6).toUpperCase()}`
                : (artist.alias
                    ? artist.alias.toUpperCase()
                    : `${artist.btc_address.slice(0, 8)}…`);

              const entryNum = artist.archive_index != null
                ? `#${String(artist.archive_index).padStart(3, '0')}`
                : `#${String(i + 1).padStart(3, '0')}`;

              return (
                <Link
                  key={artist.btc_address}
                  href={`/artist/${artist.btc_address}`}
                  className={styles.entry}
                >
                  <div className={styles.entryHeader}>
                    <span className={styles.entryNum}>ENTRY {entryNum}</span>
                    {artist.last_active && (
                      <span className={styles.entryFiled}>FILED {fmtDate(artist.last_active)}</span>
                    )}
                  </div>

                  <div className={styles.entryBody}>
                    <div className={styles.entryThumb}>
                      {artist.sample_art ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artist.sample_art}
                          alt={displayName}
                          className={styles.thumbImg}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.thumbBlank}>◆</div>
                      )}
                    </div>

                    <div className={styles.entryInfo}>
                      <div className={styles.entryAlias}>{displayName}</div>
                      {artist.bio ? (
                        <div className={styles.entryBio}>
                          {artist.bio.length > 90
                            ? artist.bio.slice(0, 90) + '…'
                            : artist.bio}
                        </div>
                      ) : (
                        <div className={styles.entryBioEmpty}>no statement on file</div>
                      )}
                    </div>
                  </div>

                  <div className={styles.entryFoot}>
                    <span className={styles.cardCount}>
                      {artist.card_count} {artist.card_count === 1 ? 'card' : 'cards'}
                    </span>
                    <div className={styles.seriesList}>
                      {artist.series_list.map(s => (
                        <span key={s} className={styles.seriesBadge}>S{s}</span>
                      ))}
                    </div>
                    <span className={styles.entryArrow}>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </main>
    </>
  );
}
