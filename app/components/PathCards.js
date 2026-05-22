'use client';
// PathCards — "Choose Your Path" interactive cards on the landing page.
// Two primary action cards (Browse + Submit) + three audience context cards
// (Counterparty, DMT/TAP, Node runner). Counterparty and DMT cards expand
// on click to show deeper lore and next-step links.

import { useState } from 'react';
import Link from 'next/link';
import styles from './PathCards.module.css';

export default function PathCards() {
  const [open, setOpen] = useState(null); // 'xcp' | 'dmt' | null

  const toggle = (key) => setOpen(prev => (prev === key ? null : key));

  return (
    <div className={styles.wrap}>

      {/* ── Primary action cards ─────────────────────────────── */}
      <div className={styles.primaryRow}>

        {/* Browse the Directory */}
        <Link href="/directory" className={styles.primaryCard}>
          <div className={styles.pcSigil}>◎</div>
          <div className={styles.pcTitle}>Browse the Directory</div>
          <div className={styles.pcDesc}>
            Skip the lore. Enter the art. Certified Counterparty tokens — judged, listed, permanent.
          </div>
          <div className={styles.pcCta}>enter the directory →</div>
        </Link>

        {/* Submit Art */}
        <Link href="/submit" className={`${styles.primaryCard} ${styles.primaryCardSubmit}`}>
          <div className={styles.pcSigil}>✦</div>
          <div className={styles.pcTitle}>Submit Your Art</div>
          <div className={styles.pcDesc}>
            Pepe-inspired, safe-for-work. Create your Counterparty token, then let the Council of 8
            decide. Full scorecard published with every verdict.
          </div>
          <div className={styles.pcCta}>start submission →</div>
        </Link>

      </div>

      {/* ── Context / audience cards ─────────────────────────── */}
      <div className={styles.pathRow}>

        {/* OG Counterparty */}
        <div className={styles.pathCard}>
          <button
            className={styles.pathHeader}
            onClick={() => toggle('xcp')}
            aria-expanded={open === 'xcp'}
          >
            <div className={styles.pathHeaderInner}>
              <div className={styles.pathSigil}>⬢</div>
              <div className={styles.pathTitle}>OG Counterparty</div>
              <div className={styles.pathDesc}>
                You know the old directory. You held Pepe. You know XCP.
              </div>
            </div>
            <span className={styles.pathToggle}>{open === 'xcp' ? '−' : '+'}</span>
          </button>

          {open === 'xcp' && (
            <div className={styles.pathBody}>
              <p>
                UNATRARE respects the 2016 Rare Pepe directory energy. It is not trying to
                replace what Joe Looney, Matt Furie, and the original community built. That
                history is the foundation.
              </p>
              <p>
                What UNATRARE adds: new Counterparty art submissions in 2026 and beyond,
                reviewed by 8 judges each inspired by real OG names from the community — Joe
                Looney, Theo Goodman, DJPEPE, Mike the Anonymous, and more. A node-powered
                archive that already preserves Rare Pepe Series 1–38 where Arweave and IPFS
                failed. And cultural bridge exposure to DMT / TAP / UNATPEPE communities
                discovering Counterparty for the first time through UNATRARE.
              </p>
              <p className={styles.pathBodyNote}>
                The goal isn&apos;t to replace the existing tools. It&apos;s to give
                Counterparty art more surface area in 2026 without breaking what already exists.
              </p>
              <div className={styles.pathBodyLinks}>
                <Link href="/archive">browse the archive (Rare Pepe Series 1–38) →</Link>
                <Link href="/directory">browse the certified directory →</Link>
                <Link href="/council">meet the council of 8 →</Link>
                <Link href="/rules">submission rules →</Link>
              </div>
            </div>
          )}
        </div>

        {/* UNATPEPE / DMT / TAP */}
        <div className={styles.pathCard}>
          <button
            className={styles.pathHeader}
            onClick={() => toggle('dmt')}
            aria-expanded={open === 'dmt'}
          >
            <div className={styles.pathHeaderInner}>
              <div className={styles.pathSigil}>◆</div>
              <div className={styles.pathTitle}>UNATPEPE / DMT / TAP</div>
              <div className={styles.pathDesc}>
                You came through TAP. You know what NAT means. You hold UNATPEPE.
              </div>
            </div>
            <span className={styles.pathToggle}>{open === 'dmt' ? '−' : '+'}</span>
          </button>

          {open === 'dmt' && (
            <div className={styles.pathBody}>
              <p>
                Counterparty is one of the roots of Bitcoin-native meme art. Before Ordinals.
                Before TAP. In 2016, Rare Pepe cards were the first globally-traded meme assets
                issued on Bitcoin. That lineage is the cultural bedrock UNATRARE builds on.
              </p>
              <p>
                Every Counterparty art submission approved by UNATRARE means UNATPEPE holders
                get one allocation — certified art distributed directly to verified holders.
                The more the directory grows, the more you receive. Register your Bitcoin address
                to activate this.
              </p>
              <p className={styles.pathBodyNote}>
                You hold UNAT in a TAP wallet. You hold art tokens in a Counterparty wallet
                (Freewallet or Electrum+XCP). Both are Bitcoin addresses. UNATRARE bridges them.
              </p>
              <div className={styles.pathBodyLinks}>
                <Link href="/register">register your UNATPEPE address →</Link>
                <Link href="/directory">browse the directory →</Link>
                <Link href="/drops">view current drops →</Link>
                <Link href="/about">read the full thesis →</Link>
              </div>
            </div>
          )}
        </div>

        {/* Run a Node — direct link (no expand, nodes page has the full terminal experience) */}
        <Link href="/nodes" className={`${styles.pathCard} ${styles.pathCardNode}`}>
          <div className={styles.pathSigil}>░</div>
          <div className={styles.pathTitle}>Run a Node</div>
          <div className={styles.pathDesc}>
            Help preserve Bitcoin meme art. Seed the archive network. Genesis window is open —
            first 100 nodes get permanent genesis status.
          </div>
          <div className={styles.pathNodeCta}>explore nodes →</div>
        </Link>

      </div>

    </div>
  );
}
