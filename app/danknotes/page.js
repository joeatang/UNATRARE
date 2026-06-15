import Image from 'next/image';
import Link from 'next/link';
import Nav from '../components/Nav';
import BuyCash from '../components/BuyCash';
import styles from './danknotes.module.css';

export const metadata = {
  title: 'DANKNOTES — DROP 01 · UNATRARE',
  description:
    'Pepe cash, reborn on Bitcoin. 10,080 deterministic banknotes minted one-per-block via the NATCASH bonding curve on nat.fun.',
  openGraph: {
    title: 'DANKNOTES — DROP 01',
    description:
      'Pepe cash, reborn on Bitcoin. 10,080 deterministic banknotes minted one-per-block via the NATCASH bonding curve on nat.fun.',
    images: ['/danknotes-og.png'],
  },
  twitter: { card: 'summary_large_image' },
};

const ARCHETYPES = [
  ['01_classic',  'THE CLASSIC',  '69K'],
  ['02_satoshi',  'THE SATOSHI',  '21M'],
  ['03_lord',     'THE LORD',     '$420'],
  ['04_anon',     'THE ANON',     '1K'],
  ['05_trump',    'THE TRUMP',    '69K'],
  ['06_pepecash', 'CASH FROG',    '$69'],
  ['07_homer',    'THE HOMER',    '69K'],
  ['08_jong',     'THE JONG',     '100K'],
  ['09_hair',     'THE HAIR',     '5M'],
  ['10_gox',      'THE GOX',      '69M'],
  ['11_flooney',  'THE LOONEY',   '10M'],
  ['12_djpepe',   'THE DJ',       '30M'],
  ['13_bane',     'THE BANE',     '$256'],
  ['14_classic2', 'NAKAMOTO',     '2M'],
  ['15_cool',     'PEPE IS LOVE', '69K'],
  ['16_haze',     'DANK NOTE',    '5M'],
  ['17_fine',     'THIS IS FINE', '$420'],
  ['18_bear',     'PEPE ADDICT',  '100K'],
  ['19_3d',       'THE QUANTUM',  '1M'],
];

const SERIES = [
  ['SERIES 2024', 50, 'Common'],
  ['SERIES 2016', 28, 'Uncommon'],
  ['SERIES 2009', 14, 'Rare'],
  ['SERIES 1774',  8, 'Ultra Rare'],
];

const GOD = [
  ['COLONIAL',  'block contains 1774'],
  ['GENESIS',   'block contains 2009'],
  ['RPD CERT',  'block contains 2016'],
  ['L33T',      'block contains 1337'],
  ['CUBED',     'perfect cube'],
  ['MIRROR',    'palindrome'],
];
const ULTRA = [
  ['ROUND',     'ends in 000'],
  ['SQUARED',   'perfect square'],
  ['ASCENDING', '4 ascending digits'],
  ['KEK',       'contains 666'],
  ['ANGEL',     'contains 777'],
  ['300 CLUB',  'contains 300'],
  ['BLAZE',     'contains 420'],
  ['PI',        'contains 314'],
];
const COMMON = [
  ['NICE',       'contains 69'],
  ['PRIMAL',     'prime block'],
  ['TRIPLE',     '3 same digits in a row'],
  ['HITCHHIKER', 'contains 42'],
  ['SATOSHI',    'digit sum = 21'],
];
const CEREMONIAL = [
  ['GENESIS KING', 'mint #1 of the cycle'],
  ['CARD 69',      'mint #69 — RAREPEPE callback'],
  ['BEAST',        'mint #666'],
  ['FINALE',       'mint #10,080'],
  ['HOMERPEPE',    'Homer + 69 (RAREPEPE Card #69 commemorative)'],
];

const SPECIMEN = [
  ['102,816', 'GENESIS KING',    'first mint of the cycle · THE CLASSIC'],
  ['102,884', 'DJ COMMEMORATIVE','THE DJ at issuance'],
  ['103,481', 'CLASSIC 10M',     'a Classic at the ceiling'],
  ['111,774', 'COLONIAL 1774',   'literal 1774 in the block · god-tier'],
  ['112,895', 'GOX 2024',        'final-block GOX · series 2024'],
];

export default function DanknotesPage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>
        {/* HERO */}
        <header className={styles.hero}>
          <div className={styles.heroEyebrow}>· DROP 01 · NATCASH · vibe 99 ·</div>
          <h1 className={styles.heroTitle}>
            DANK<span>NOTES</span>
          </h1>
          <p className={styles.heroSub}>
            Pepe cash — reborn on Bitcoin. 10,080 deterministic banknotes,
            one for every block in the issuance window. Each note is generated
            from its block height: a 19-step PRNG roll picks an archetype, a
            series, a denomination, and a stack of ceremonial flags. No off-chain
            inputs. No servers. The sketch is on Bitcoin forever.
          </p>
          <a
            href="https://nat.fun/token/oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.heroLive}
          >
            LIVE ON NAT.FUN ↗
          </a>
        </header>

        {/* STAT STRIP */}
        <section className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>10,080</div>
            <div className={styles.statLabel}>Total Supply</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>19</div>
            <div className={styles.statLabel}>Archetypes</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>4</div>
            <div className={styles.statLabel}>Series Tiers</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>blastoff</div>
            <div className={styles.statLabel}>DMT Element</div>
          </div>
        </section>

        {/* ABOUT */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// 01</span>
            <h2 className={styles.sectionTitle}>WHAT IS THIS</h2>
          </div>
          <div className={styles.aboutGrid}>
            <div className={styles.aboutCard}>
              <div className={styles.aboutCardHead}>// deterministic</div>
              <h3 className={styles.aboutCardTitle}>Block-derived art</h3>
              <p className={styles.aboutCardBody}>
                Every Danknote is rendered live from its Bitcoin block height.
                Same input, same output, every time — your specific bill is
                already computable, even before it&apos;s minted.
              </p>
            </div>
            <div className={styles.aboutCard}>
              <div className={styles.aboutCardHead}>// 19 archetypes</div>
              <h3 className={styles.aboutCardTitle}>The roster</h3>
              <p className={styles.aboutCardBody}>
                THE CLASSIC, THE GOX, THE DJ, NAKAMOTO, DANK NOTE, and 14 more.
                Each archetype carries its own hero denomination and ink family.
                The sketch cycles through all 19 in order.
              </p>
            </div>
            <div className={styles.aboutCard}>
              <div className={styles.aboutCardHead}>// rarity stack</div>
              <h3 className={styles.aboutCardTitle}>Traits compound</h3>
              <p className={styles.aboutCardBody}>
                Series tier × archetype × denomination × ceremonial flags.
                A single bill can stack GENESIS + COLONIAL + 1ST&nbsp;IMPRESSION +
                NOTARY. The trophy bills are the ones that hit five trait gates
                at once.
              </p>
            </div>
          </div>
        </section>

        {/* ARCHETYPES */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// 02</span>
            <h2 className={styles.sectionTitle}>NINETEEN ARCHETYPES</h2>
          </div>
          <div className={styles.archGrid}>
            {ARCHETYPES.map(([key, name, denom], i) => (
              <div key={key} className={styles.archCell}>
                <span className={styles.archIdx}>{String(i + 1).padStart(2, '0')}</span>
                <Image
                  src={`/sprites/${key}.webp`}
                  alt={name}
                  width={200}
                  height={200}
                  className={styles.archImg}
                  unoptimized
                />
                <div className={styles.archName}>{name}</div>
                <div className={styles.archDenom}>HERO · {denom}</div>
              </div>
            ))}
          </div>
        </section>

        {/* SERIES */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// 03</span>
            <h2 className={styles.sectionTitle}>SERIES TIERS</h2>
          </div>
          <div className={styles.seriesList}>
            {SERIES.map(([name, pct, label]) => (
              <div key={name} className={styles.seriesRow}>
                <div className={styles.seriesName}>{name}</div>
                <div className={styles.seriesBar}>
                  <div className={styles.seriesFill} style={{ width: `${pct}%` }} />
                </div>
                <div className={styles.seriesPct}>{pct}%</div>
                <div className={styles.seriesLabel}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* DENOMS */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// 04</span>
            <h2 className={styles.sectionTitle}>DENOMINATIONS</h2>
          </div>
          <div className={styles.denomGrid}>
            <div className={styles.denomCard}>
              <h3 className={styles.denomTitle}>K-TIER</h3>
              <div className={styles.denomList}>1K · 2K · 5K · 10K · 20K · 69K · 100K</div>
              <div className={styles.denomNote}>standard issuance · all series</div>
            </div>
            <div className={styles.denomCard}>
              <h3 className={styles.denomTitle}>M-TIER</h3>
              <div className={styles.denomList}>1M · 2M · 5M · 10M · 30M · 69M</div>
              <div className={styles.denomNote}>uncommon · all series</div>
            </div>
            <div className={styles.denomCard}>
              <h3 className={styles.denomTitle}>DOLLAR-TIER</h3>
              <div className={styles.denomList}>$69 · $256 · $420</div>
              <div className={styles.denomNote}>only on SERIES 2009 / 1774</div>
            </div>
          </div>
        </section>

        {/* RARITY */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// 05</span>
            <h2 className={styles.sectionTitle}>CEREMONIAL TRAITS</h2>
          </div>
          <div className={styles.rarityWrap}>
            <div className={styles.rarityCol}>
              <h3 className={`${styles.rarityTier} ${styles.tierGod}`}>GOD-TIER</h3>
              {GOD.map(([n, w]) => (
                <div key={n} className={styles.rarityRow}>
                  <span className={styles.rarityName}>{n}</span>
                  <span className={styles.rarityWhy}>{w}</span>
                </div>
              ))}
              <h3 className={`${styles.rarityTier} ${styles.tierUltra}`} style={{ marginTop: 16 }}>ULTRA-TIER</h3>
              {ULTRA.map(([n, w]) => (
                <div key={n} className={styles.rarityRow}>
                  <span className={styles.rarityName}>{n}</span>
                  <span className={styles.rarityWhy}>{w}</span>
                </div>
              ))}
            </div>
            <div className={styles.rarityCol}>
              <h3 className={`${styles.rarityTier} ${styles.tierCommon}`}>COMMON-TIER</h3>
              {COMMON.map(([n, w]) => (
                <div key={n} className={styles.rarityRow}>
                  <span className={styles.rarityName}>{n}</span>
                  <span className={styles.rarityWhy}>{w}</span>
                </div>
              ))}
              <h3 className={`${styles.rarityTier} ${styles.tierCer}`} style={{ marginTop: 16 }}>1-OF-1 / CEREMONIAL</h3>
              {CEREMONIAL.map(([n, w]) => (
                <div key={n} className={styles.rarityRow}>
                  <span className={styles.rarityName}>{n}</span>
                  <span className={styles.rarityWhy}>{w}</span>
                </div>
              ))}
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 14, lineHeight: 1.6 }}>
                Traits stack. <strong>1ST IMPRESSION</strong> (~3% of bills) renders
                without drop shadows — a Pokemon-shadowless analog. Hardest trophy:
                a 1ST IMPRESSION GENESIS KING.
              </p>
            </div>
          </div>
        </section>

        {/* SPECIMEN */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// 06</span>
            <h2 className={styles.sectionTitle}>SPECIMEN BLOCKS</h2>
          </div>
          <div className={styles.specList}>
            {SPECIMEN.map(([blk, type, why]) => (
              <div key={blk} className={styles.specRow}>
                <span className={styles.specBlock}>BLOCK {blk}</span>
                <span className={styles.specType}>{type}</span>
                <span className={styles.specWhy}>{why}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTag}>// 07</span>
            <h2 className={styles.sectionTitle}>GET IN</h2>
          </div>
          <BuyCash
            variant="full"
            headline="MINT $CASH ON NAT.FUN"
            subline={
              <>
                Buying $CASH on the bonding curve is how you participate in the
                drop. Every $CASH purchase pushes the curve forward; at 100% the
                graduation event triggers and the inscriptions ship.
              </>
            }
          />
        </section>

        <footer className={styles.footer}>
          NATCASH · DROP 01 · 10,080 PIECES · DEPLOYED ON BITCOIN<br />
          mint <code>oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat</code>
        </footer>
      </main>
    </>
  );
}
