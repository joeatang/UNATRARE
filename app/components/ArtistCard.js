'use client';

import styles from './ArtistCard.module.css';

// Deterministic "element" from first char of token name
function tokenElement(name) {
  const elems = ['FIRE', 'RARE', 'DANK', 'VOID', 'PEPE', 'DARK', 'GOLD', 'FROG'];
  const code = name?.charCodeAt(0) ?? 70;
  return elems[code % elems.length];
}

// Power level stars (out of 5)
function powerStars(score) {
  if (!score) return '○○○○○';
  const max = 37.5;
  const filled = Math.round((score / max) * 5);
  return '★'.repeat(filled) + '○'.repeat(5 - filled);
}

// Rarity badge from judge score
function rarityLabel(score) {
  if (!score) return 'RARE';
  const pct = score / 37.5;
  if (pct >= 0.92) return 'MYTHIC';
  if (pct >= 0.80) return 'LEGENDARY';
  if (pct >= 0.70) return 'RARE';
  return 'UNCOMMON';
}

// Card accent colour
function rarityColor(score) {
  const pct = (score ?? 0) / 37.5;
  if (pct >= 0.92) return '#e040fb'; // mythic purple
  if (pct >= 0.80) return '#ffab40'; // legendary orange
  if (pct >= 0.70) return '#C9A84C'; // rare gold
  return '#78909c';                  // uncommon silver
}

export default function ArtistCard({ token }) {
  const {
    token_name,
    artist_handle,
    artist_address,
    art_url,
    art_mime,
    judge_score,
    series,
    card_number,
  } = token;

  const element  = tokenElement(token_name);
  const stars    = powerStars(judge_score);
  const rarity   = rarityLabel(judge_score);
  const accent   = rarityColor(judge_score);
  const handle   = artist_handle || (artist_address ? artist_address.slice(0, 8) + '…' : 'ANON');
  const cardNum  = card_number ? String(card_number).padStart(3, '0') : '???';
  const seriesLbl = series ? `S${series}` : 'S1';

  return (
    <div className={styles.card} style={{ '--accent': accent }}>
      {/* Card frame top border — double line retro */}
      <div className={styles.frameTop} />

      {/* Header bar */}
      <div className={styles.header}>
        <span className={styles.tokenName}>{token_name}</span>
        <span className={styles.manaCost}>{element}</span>
      </div>

      {/* Art area */}
      <div className={styles.artFrame}>
        {art_url ? (
          art_mime?.startsWith('video/') ? (
            <video
              src={art_url}
              autoPlay muted loop playsInline
              className={styles.artImg}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art_url}
              alt={token_name}
              className={styles.artImg}
              loading="lazy"
            />
          )
        ) : (
          <div className={styles.artPlaceholder}>
            <div className={styles.pepeSilhouette}>
              {/* ASCII frog silhouette */}
              <pre className={styles.asciiPepe}>{PEPE_ASCII}</pre>
            </div>
          </div>
        )}
        {/* Rarity foil strip */}
        <div className={styles.rarityStrip}>{rarity}</div>
      </div>

      {/* Type line */}
      <div className={styles.typeLine}>
        <span>CREATURE — PEPE ARTIST</span>
        <span className={styles.setSymbol}>◆</span>
      </div>

      {/* Text box */}
      <div className={styles.textBox}>
        <div className={styles.abilityLine}>
          <span className={styles.abilityKeyword}>CERTIFIED</span>
          {' '}by the Pepe Council.
        </div>
        <div className={styles.abilityLine} style={{marginTop:4}}>
          Token <span className={styles.abilityKeyword}>{seriesLbl}</span> · Card{' '}
          <span className={styles.abilityKeyword}>#{cardNum}</span>
        </div>
        <div className={styles.flavourText}>
          &ldquo;Dank by consensus. Permanent on Bitcoin.&rdquo;
        </div>
      </div>

      {/* Stats bar — MTG P/T box style */}
      <div className={styles.statsBar}>
        <div className={styles.statBlock}>
          <div className={styles.statVal}>{judge_score ? judge_score.toFixed(1) : '—'}</div>
          <div className={styles.statLabel}>SCORE</div>
        </div>
        <div className={styles.starRating} title={`${judge_score?.toFixed(1) ?? '?'} / 37.5`}>
          {stars}
        </div>
        <div className={styles.ptBox}>
          <span>{judge_score ? Math.round((judge_score / 37.5) * 10) : '?'}</span>
          <span className={styles.ptSlash}>/</span>
          <span>10</span>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.artistCredit}>✦ {handle}</span>
        <span className={styles.setCode}>UNATRARE</span>
      </div>

      {/* Card frame bottom border */}
      <div className={styles.frameBottom} />
    </div>
  );
}

const PEPE_ASCII = `  (◕‿◕)
  /|  |\\
   |  |
   /  \\`;
