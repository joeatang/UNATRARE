'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './vault.module.css';

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://unatrare.wtf';

function timeAgo(ms) {
  if (!ms) return '—';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function AssetCard({ asset }) {
  const ext    = MIME_EXT[asset.art_mime] ?? asset.art_mime?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const artUrl = `/uploads/vault/${asset.art_hash}.${ext}`;
  const jsonUrl = `/api/vault/json/${asset.art_hash}`;
  const [copied, setCopied] = useState(false);

  function copyJson() {
    navigator.clipboard.writeText(`${BASE}${jsonUrl}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const submitHref = `/submit?vault_hash=${asset.art_hash}&vault_mime=${encodeURIComponent(asset.art_mime || 'image/png')}`;

  return (
    <div className={styles.card}>
      <div className={styles.imgWrap}>
        <img className={styles.img} src={artUrl} alt={asset.asset_name || asset.token_name} />
        {asset.is_promo === 1 && <span className={styles.promoBadge}>PROMO</span>}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.tokenName}>{asset.token_name}</div>
        {asset.asset_name && <div className={styles.assetName}>{asset.asset_name}</div>}
        <div className={styles.uploaded}>{timeAgo(asset.uploaded_at)}</div>
        {asset.owner_xcp ? (
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '1px', color: 'var(--text-dim)', margin: '4px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={asset.owner_xcp}>
            {asset.owner_xcp.slice(0, 6)}…{asset.owner_xcp.slice(-4)}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-card)', fontSize: '9px', letterSpacing: '1px', color: 'var(--red)', margin: '4px 0 6px' }}>no address</div>
        )}
        <button className={styles.copyBtn} onClick={copyJson}>
          {copied ? '✓ copied' : 'copy JSON URL'}
        </button>
        <Link href={submitHref} className={styles.submitDirBtn}>
          submit to directory →
        </Link>
      </div>
    </div>
  );
}

export default function VaultPage() {
  const [assets,  setAssets]  = useState([]);
  const [promo,   setPromo]   = useState(null);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res  = await fetch(`/api/vault/assets?page=${page}&limit=24`);
        const json = await res.json();
        if (mounted) {
          setAssets(json.assets || []);
          setPromo(json.promo  || null);
          setTotal(json.total  || 0);
          setLoading(false);
        }
      } catch { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [page]);

  return (
    <>
      <Nav />
      <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>PEPE CRYPT</h1>
        <p className={styles.subtitle}>
          Permanent P2P storage for Counterparty art tokens on Bitcoin.
          Upload your art — get a JSON URL for your token description.
        </p>
        <Link href="/vault/upload" className={styles.uploadBtn}>+ UPLOAD YOUR ART</Link>
      </div>

      {promo?.active && (
        <div className={styles.promoBanner}>
          ★ PROMO PERIOD ACTIVE — free uploads · {promo.count} / {promo.max} slots used
        </div>
      )}

      {!promo?.active && promo && (
        <div className={styles.priceBanner}>
          500 PEPECASH per upload · BTC accepted · UNATPEPECASH holders get discount
        </div>
      )}

      {loading && <div className={styles.loader}>loading crypt…</div>}

      {!loading && assets.length === 0 && (
        <div className={styles.empty}>
          No art crypted yet.{' '}
          <Link href="/vault/upload" className={styles.emptyLink}>Be the first →</Link>
        </div>
      )}

      {!loading && assets.length > 0 && (
        <>
          <div className={styles.meta}>{total} asset{total !== 1 ? 's' : ''} in the crypt</div>
          <div className={styles.grid}>
            {assets.map(a => <AssetCard key={a.art_hash} asset={a} />)}
          </div>

          {total > 24 && (
            <div className={styles.pagination}>
              <button
                className={styles.pgBtn}
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >← prev</button>
              <span className={styles.pgInfo}>page {page} of {Math.ceil(total / 24)}</span>
              <button
                className={styles.pgBtn}
                disabled={page >= Math.ceil(total / 24)}
                onClick={() => setPage(p => p + 1)}
              >next →</button>
            </div>
          )}
        </>
      )}

      <div className={styles.infoSection}>
        <h2 className={styles.infoTitle}>HOW IT WORKS</h2>
        <ol className={styles.infoList}>
          <li>Upload your PNG, JPG, GIF, or WebP art.</li>
          <li>Your art is hashed (SHA-256) and stored permanently on the UNATRARE P2P network.</li>
          <li><strong>Crypt only:</strong> paste the JSON URL into your token description — wallets display your art immediately.</li>
          <li><strong>UNATRARE certification:</strong> use <code style={{fontFamily:'var(--font-card)',fontSize:'10px'}}>unatrare.wtf/c/YOURTOKEN.json</code> in your description instead, then click &ldquo;submit to directory&rdquo; on your vault card to go through the AI judging process.</li>
        </ol>
        <p className={styles.infoNote}>
          The Crypt JSON URL and the UNATRARE directory URL are different things — only the directory URL earns certification and UNATPEPE holder airdrops.{' '}
          <Link href="/nodes" className={styles.infoLink}>Run a node →</Link>
        </p>
      </div>
    </main>
    </>
  );
}
