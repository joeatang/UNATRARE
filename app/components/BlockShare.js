'use client';

// Flex-your-block share sheet. Two variants:
//   variant="pill" — renders the ⛓ block pill as a button that opens a modal
//                    (used on the public torchbearer profile)
//   variant="card" — renders an inline preview + share buttons
//                    (used on the claim success screen)
//
// "Flex on X" opens a tweet intent linking the profile (which carries the
// block card as its og:image). "Save image" uses the native share sheet when
// available (lets mobile users save straight to Photos), else downloads.

import { useState } from 'react';
import styles from './BlockShare.module.css';

export default function BlockShare({ wallet, block, subtitle = '', variant = 'card' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const blockStr = Number(block).toLocaleString();
  const imgUrl = `/api/og/block/${wallet}`;
  const profileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/torchbearer/${wallet}`
      : `https://unatrare.wtf/torchbearer/${wallet}`;
  const tweetText = `Bitcoin just dealt me Block #${blockStr} on @unatrare 🔥\n\nCertified Counterparty art. On Bitcoin.`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(profileUrl)}`;

  async function saveImage() {
    setBusy(true);
    try {
      const res = await fetch(imgUrl, { cache: 'no-store' });
      const blob = await res.blob();
      const file = new File([blob], `unatrare-block-${block}.png`, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Bitcoin Block #${blockStr}`,
          text: tweetText,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* user cancelled the share sheet, or offline — no-op */
    }
    setBusy(false);
  }

  const actions = (
    <div className={styles.actions}>
      <a className={styles.flexBtn} href={tweetUrl} target="_blank" rel="noopener noreferrer">
        Flex on X ↗
      </a>
      <button type="button" className={styles.saveBtn} onClick={saveImage} disabled={busy}>
        {busy ? 'Preparing…' : 'Save image'}
      </button>
    </div>
  );

  return (
    <>
      {variant === 'pill' ? (
        <button type="button" className={styles.pill} onClick={() => setOpen(true)}>
          ⛓ Genesis Block #{blockStr}
          <span className={styles.pillShare}>share ↗</span>
        </button>
      ) : (
        <div className={styles.cardInline}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.preview} src={imgUrl} alt={`Bitcoin Block #${blockStr}`} />
          <div className={styles.cardHint}>Flex your block — put it on your timeline.</div>
          {actions}
        </div>
      )}

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)} role="presentation">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className={styles.modalTitle}>Flex your block</div>
            {subtitle && <div className={styles.modalSub}>{subtitle}</div>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.preview} src={imgUrl} alt={`Bitcoin Block #${blockStr}`} />
            {actions}
          </div>
        </div>
      )}
    </>
  );
}
