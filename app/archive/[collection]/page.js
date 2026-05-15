'use client';

/**
 * /archive/[collection] — browse a specific collection
 *
 * Client-side paginated gallery.
 * Filters: series selector, search by name.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import styles from '../archive.module.css';

const SITE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : 'https://unatrare.wtf';

function mimeToExt(mime) {
  if (!mime) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif'))  return 'gif';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('svg'))  return 'svg';
  return 'png';
}

function artUrl(asset) {
  if (!asset.art_hash) return null;
  const ext = mimeToExt(asset.art_mime);
  return `/uploads/archive/${asset.collection}/${asset.art_hash}.${ext}`;
}

function truncateAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 7)}…${addr.slice(-5)}`;
}

function CardTile({ asset, color }) {
  const url = artUrl(asset);
  const [imgErr, setImgErr] = useState(false);
  const label = asset.series_number && asset.card_number
    ? `S${asset.series_number} · C${String(asset.card_number).padStart(3,'0')}`
    : null;
  const artistShort = asset.artist_address ? truncateAddr(asset.artist_address) : null;

  return (
    <div className={styles.cardTile} style={{ '--col-color': color }}>
      <div className={styles.cardImgWrap}>
        {url && !imgErr ? (
          <img
            className={styles.cardImg}
            src={url}
            alt={asset.display_title || asset.asset_name}
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        ) : (
          <div className={styles.cardImgPlaceholder}>?</div>
        )}
        <div className={styles.cardOverlay}>
          <div className={styles.cardOverlayName}>{asset.asset_name}</div>
          {label && <div className={styles.cardOverlayLabel}>{label}</div>}
          {asset.artist_address && (
            <div className={styles.cardOverlayArtist} title={asset.artist_address}>
              {truncateAddr(asset.artist_address)}
            </div>
          )}
          <a
            className={styles.cardOverlayCip}
            href={`/c/${asset.asset_name}.json`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          >
            CIP-25 JSON →
          </a>
        </div>
      </div>
      <div className={styles.cardName}>{asset.display_title || asset.asset_name}</div>
      {label && <div className={styles.cardSeries}>{label}</div>}
      {artistShort && <div className={styles.cardArtist}>{artistShort}</div>}
    </div>
  );
}

export default function CollectionPage({ params }) {
  const { collection } = params;

  const [assets,      setAssets]      = useState([]);
  const [collInfo,    setCollInfo]    = useState(null);
  const [seriesList,  setSeriesList]  = useState([]);
  const [stats,       setStats]       = useState(null);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [seriesFilter,setSeriesFilter]= useState('');
  const [query,       setQuery]       = useState('');
  const [debouncedQ,  setDebouncedQ]  = useState('');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [seriesFilter, debouncedQ]);

  // Fetch collection info + series list once
  useEffect(() => {
    fetch(`/api/archive/status?collection=${collection}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setCollInfo(d.meta);
          setStats(d.stats);
        }
      })
      .catch(() => {});
  }, [collection]);

  // Fetch assets
  const fetchAssets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      collection,
      page:  String(page),
      limit: '60',
      ...(seriesFilter && { series: seriesFilter }),
      ...(debouncedQ  && { q: debouncedQ }),
    });
    fetch(`/api/archive/assets?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setAssets(d.assets || []);
          setTotalPages(d.totalPages || 1);
          setTotal(d.total || 0);
          if (d.seriesList?.length) setSeriesList(d.seriesList);
        } else {
          setError(d.error || 'Failed to load');
        }
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [collection, page, seriesFilter, debouncedQ]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const color = collInfo?.color || '#b4ff6f';
  const name  = collInfo?.name  || collection.toUpperCase();

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* Header */}
        <header className={styles.collHeader}>
          <Link href="/archive" className={styles.backLink}>← Archive</Link>
          <h1 className={styles.collTitle} style={{ color }}>
            {name.toUpperCase()}
          </h1>
          {stats && (
            <div className={styles.collStats}>
              <span style={{ color }}>{stats.fetched.toLocaleString()}</span> preserved
              {collInfo?.totalExpected && (
                <> · <span>{collInfo.totalExpected.toLocaleString()}</span> total</>
              )}
            </div>
          )}
        </header>

        {/* Filters */}
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="search by name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className={styles.seriesButtons}>
            <button
              className={`${styles.seriesBtn} ${!seriesFilter ? styles.seriesBtnActive : ''}`}
              style={!seriesFilter ? { borderColor: color, color } : {}}
              onClick={() => setSeriesFilter('')}
            >
              ALL
            </button>
            {seriesList.map(s => (
              <button
                key={s}
                className={`${styles.seriesBtn} ${seriesFilter === String(s) ? styles.seriesBtnActive : ''}`}
                style={seriesFilter === String(s) ? { borderColor: color, color } : {}}
                onClick={() => setSeriesFilter(String(s))}
              >
                S{s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {error && <div className={styles.errorMsg}>{error}</div>}

        {!loading && assets.length === 0 && !error && (
          <div className={styles.emptyState}>
            <div className={styles.emptyGlyph}>?</div>
            <div className={styles.emptyText}>
              {stats?.total === 0
                ? 'No assets imported yet. Check back soon.'
                : 'No results for this filter.'}
            </div>
          </div>
        )}

        <div className={`${styles.cardGrid} ${loading ? styles.cardGridLoading : ''}`}>
          {assets.map(asset => (
            <CardTile key={asset.asset_name} asset={asset} color={color} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← prev
            </button>
            <span className={styles.pageInfo}>
              page {page} / {totalPages}
              <span className={styles.pageTotalLabel}> ({total} cards)</span>
            </span>
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              next →
            </button>
          </div>
        )}

        {/* How to use */}
        {stats?.fetched > 0 && (
          <section className={styles.howToUse}>
            <div className={styles.howToTitle}>USE THIS ARCHIVE FOR YOUR TOKEN</div>
            <p className={styles.howToText}>
              If your Counterparty token has a broken image link, point your token
              description to UNATRARE. Update your token&apos;s description field on
              Counterparty to:
            </p>
            <code className={styles.howToCode}>
              https://unatrare.wtf/c/YOURTOKENNAME.json
            </code>
            <p className={styles.howToText}>
              Wallets that support Counterparty Enhanced Asset Info (CIP-25) will
              immediately display your preserved image. No Arweave. No IPFS. Just
              Bitcoin-hosted, permanent, free to use.
            </p>
          </section>
        )}

      </main>
    </>
  );
}
