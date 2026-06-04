'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './CeremonyRail.module.css';

// Theme palette mirrors SalutePanel — server randomizes theme_key per activation.
const THEME_PALETTE = {
  ember:     { color: '#ffb347', label: 'EMBER',     glyph: '🪵' },
  flame:     { color: '#ff7a3d', label: 'FLAME',     glyph: '🔥' },
  inferno:   { color: '#ff3d3d', label: 'INFERNO',   glyph: '🌋' },
  legendary: { color: '#d4af37', label: 'LEGENDARY', glyph: '👑' },
  frost:     { color: '#7adfff', label: 'FROST',     glyph: '❄️' },
  neon:      { color: '#b4ff6f', label: 'NEON',      glyph: '⚡' },
  void:      { color: '#b87aff', label: 'VOID',      glyph: '🌌' },
  gold:      { color: '#ffd24a', label: 'GOLD',      glyph: '✨' },
};

function countdown(endsAt, now) {
  if (!endsAt) return null;
  const diff = endsAt - now;
  if (diff <= 0) return 'closing';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function CeremonyRail({ variant = 'home' }) {
  const [ceremonies, setCeremonies] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch('/api/salute/ceremonies/active', { cache: 'no-store' });
        if (!r.ok) throw new Error('failed');
        const j = await r.json();
        if (!alive) return;
        setCeremonies(Array.isArray(j.ceremonies) ? j.ceremonies : []);
        setLoaded(true);
      } catch {
        if (alive) setLoaded(true);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => { alive = false; clearInterval(t); clearInterval(tick); };
  }, []);

  // Render nothing until loaded AND when there are zero active ceremonies.
  // Restraint = 5-star UI. Empty rails are noise.
  if (!loaded || ceremonies.length === 0) return null;

  return (
    <section className={`${styles.rail} ${variant === 'archive' ? styles.railArchive : ''}`}>
      <div className={styles.head}>
        <div className={styles.eyebrow}>
          <span className={styles.dot} aria-hidden /> LIVE CEREMONIES
        </div>
        <div className={styles.sub}>
          The platform is pointing the cameras here. Salute to support — and, where the artist allows, to receive.
        </div>
      </div>

      <div className={styles.track} role="list">
        {ceremonies.map((c) => {
          const theme = THEME_PALETTE[c.themeKey] || THEME_PALETTE.ember;
          const cd = countdown(c.endsAt, now);
          const hasDistribution = c.distributionMode && c.distributionMode !== 'none';
          return (
            <Link
              key={c.card}
              href={`/card/${c.card}`}
              className={styles.tile}
              role="listitem"
              style={{
                '--theme': theme.color,
                '--themeGlow': `${theme.color}33`,
              }}
            >
              <div className={styles.tileArt}>
                {c.artUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.artUrl} alt={c.displayTitle} loading="lazy" />
                ) : (
                  <div className={styles.tileArtPlaceholder}>·</div>
                )}
                <span className={styles.themePill}>
                  <span aria-hidden>{theme.glyph}</span> {theme.label}
                </span>
              </div>

              <div className={styles.tileBody}>
                <div className={styles.tileTitle}>{c.displayTitle}</div>
                {c.headline && c.headline !== 'Burn to Salute' && (
                  <div className={styles.tileHeadline}>{c.headline}</div>
                )}
                <div className={styles.tileMeta}>
                  <span className={styles.metaSplit}>
                    {c.burnPct}/{c.artistPct}{c.nodePct ? `/${c.nodePct}` : ''}
                  </span>
                  {hasDistribution && (
                    <span className={styles.metaDist}>· drop active</span>
                  )}
                  {cd && <span className={styles.metaCountdown}>· {cd}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
