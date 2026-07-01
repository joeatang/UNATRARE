'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import styles from './update.module.css';

export default function UpdateForm({ initialData }) {
  const name = initialData.token_name;
  const challenge = `UNATRARE:UPDATE:${name}`;

  const [address, setAddress]     = useState('');
  const [sig, setSig]             = useState('');
  const [copied, setCopied]       = useState(false);

  const [displayTitle,  setDisplayTitle]  = useState(initialData.display_title);
  const [artistHandle,  setArtistHandle]  = useState(initialData.artist_handle);
  const [description,   setDescription]  = useState(initialData.description);
  const [officialSignal, setOfficialSignal] = useState(initialData.official_signal);
  const [campaignUpdate, setCampaignUpdate] = useState('');
  const [category,      setCategory]     = useState(initialData.category);
  const [subcategory,   setSubcategory]  = useState(initialData.subcategory);
  const [audioUrl,      setAudioUrl]     = useState(initialData.audio_url);
  const [videoUrl,      setVideoUrl]     = useState(initialData.video_url);

  // Art replacement
  const [artFile,      setArtFile]    = useState(null);
  const [artUploading, setArtUploading] = useState(false);
  const [newArt,       setNewArt]     = useState(null); // { url, hash, mime }
  const [artErr,       setArtErr]     = useState('');
  const fileRef = useRef(null);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [updated,  setUpdated]  = useState([]);

  async function handleUploadArt(file) {
    if (!file) return;
    setArtErr('');
    setArtUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('tokenName', name);
      const res = await fetch('/api/upload-art', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.ok) { setArtErr(data.error || 'Upload failed'); return; }
      setNewArt({ url: data.url, hash: data.hash, mime: file.type });
    } catch (e) {
      setArtErr('Upload failed — ' + e.message);
    } finally {
      setArtUploading(false);
    }
  }

  function copyChallenge() {
    navigator.clipboard.writeText(challenge).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!address.trim() || !sig.trim()) {
      setError('Enter your Bitcoin address and signature to verify ownership.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/update-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenName:    name,
          artistAddress: address.trim(),
          signature:    sig.trim(),
          displayTitle: displayTitle.trim(),
          artistHandle: artistHandle.trim(),
          description:  description.trim(),
          officialSignal: officialSignal.trim(),
          campaignUpdate: campaignUpdate.trim(),
          category:     category.trim(),
          subcategory:  subcategory.trim(),
          audioUrl:     audioUrl.trim(),
          videoUrl:     videoUrl.trim(),
          ...(newArt ? {
            artUrl:  newArt.url,
            artHash: newArt.hash,
            artMime: newArt.mime,
          } : {}),
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Update failed');
        return;
      }

      setSuccess(true);
      setUpdated(data.updated || []);
    } catch (e) {
      setError('Network error — ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={styles.wrap}>
        <div className={styles.successBox}>
          <div className={styles.successMark}>✓</div>
          <div className={styles.successTitle}>CARD UPDATED</div>
          <p className={styles.successMsg}>
            Your changes are live. Wallets and scanners will reflect the update
            on their next refresh. The card URL and token name are unchanged.
          </p>
          {updated.length > 0 && (
            <p className={styles.successFields}>
              Updated: {updated.join(', ')}
            </p>
          )}
          <div className={styles.successLinks}>
            <Link href={`/card/${name}`} className={styles.successLink}>
              view card ↗
            </Link>
            <Link href={`/c/${name}`} className={styles.successLink}>
              view JSON ↗
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>artist update</div>
        <h1 className={styles.title}>{name}</h1>
        <p className={styles.subtitle}>
          Verify ownership, then update your card metadata. The token name and URL never change.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>

        {/* ── STEP 1: Verify ownership ─────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>step 1 — verify ownership</div>

          <div className={styles.challengeBlock}>
            <div className={styles.challengeLabel}>Sign this message in your wallet:</div>
            <div className={styles.challengeRow}>
              <code className={styles.challengeMsg}>{challenge}</code>
              <button type="button" className={styles.copyBtn} onClick={copyChallenge}>
                {copied ? 'copied ✓' : 'copy'}
              </button>
            </div>
            <div className={styles.challengeHint}>
              FreeWallet: Menu → Sign Message &nbsp;·&nbsp;
              Electrum: Tools → Sign/Verify Message
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Your Bitcoin address (used when you submitted)</label>
            <input
              type="text"
              className={styles.input}
              placeholder="1YourBitcoinAddress..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Signature</label>
            <input
              type="text"
              className={styles.input}
              placeholder="H... (base64 signature from your wallet)"
              value={sig}
              onChange={e => setSig(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </section>

        {/* ── STEP 2: Update fields ─────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>step 2 — update fields</div>
          <p className={styles.sectionNote}>
            Leave any field unchanged to keep its current value.
            Only fields you modify will be saved.
          </p>

          <div className={styles.field}>
            <label className={styles.label}>Display title</label>
            <input
              type="text"
              className={styles.input}
              value={displayTitle}
              onChange={e => setDisplayTitle(e.target.value)}
              maxLength={128}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Artist handle</label>
            <div className={styles.inputPrefix}>
              <span className={styles.prefix}>@</span>
              <input
                type="text"
                className={`${styles.input} ${styles.inputNoPad}`}
                value={artistHandle}
                onChange={e => setArtistHandle(e.target.value.replace(/^@/, ''))}
                maxLength={64}
                placeholder="yourhandle"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={2000}
              rows={5}
            />
            <div className={styles.hint}>{description.length} / 2000</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Official artist signal</label>
            <textarea
              className={styles.textarea}
              value={officialSignal}
              onChange={e => setOfficialSignal(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="One official message torchbearers can rally around. Example: Useful for buying rare internet things before Wall Street arrives."
            />
            <div className={styles.hint}>{officialSignal.length} / 280</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Post artist update</label>
            <textarea
              className={styles.textarea}
              value={campaignUpdate}
              onChange={e => setCampaignUpdate(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Post a short campaign update that will appear on the card page activity stream."
            />
            <div className={styles.hint}>{campaignUpdate.length} / 500</div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <input
                type="text"
                className={styles.input}
                value={category}
                onChange={e => setCategory(e.target.value)}
                maxLength={64}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Subcategory</label>
              <input
                type="text"
                className={styles.input}
                value={subcategory}
                onChange={e => setSubcategory(e.target.value)}
                maxLength={64}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Audio URL <span className={styles.opt}>(optional)</span></label>
            <input
              type="url"
              className={styles.input}
              value={audioUrl}
              onChange={e => setAudioUrl(e.target.value)}
              placeholder="https://arweave.net/..."
              maxLength={500}
            />
            <div className={styles.hint}>Must be https://. Clear to remove.</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Video URL <span className={styles.opt}>(optional)</span></label>
            <input
              type="url"
              className={styles.input}
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://arweave.net/..."
              maxLength={500}
            />
            <div className={styles.hint}>Must be https://. Clear to remove.</div>
          </div>

          {/* Art replacement */}
          <div className={styles.field}>
            <label className={styles.label}>
              Replace art file <span className={styles.opt}>(optional)</span>
            </label>
            {initialData.art_url && !newArt && (
              <div className={styles.currentArt}>
                <img
                  src={initialData.art_url}
                  alt="current art"
                  className={styles.currentArtImg}
                />
                <span className={styles.currentArtLabel}>current art</span>
              </div>
            )}
            {newArt && (
              <div className={styles.newArtConfirm}>
                <img src={newArt.url} alt="new art" className={styles.currentArtImg} />
                <span className={styles.newArtLabel}>✓ new art ready to save</span>
              </div>
            )}
            {artErr && <div className={styles.fieldErr}>{artErr}</div>}
            <input
              ref={fileRef}
              type="file"
              className={styles.fileInput}
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,text/html"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 15 * 1024 * 1024) { setArtErr('File too large — image max is 15 MB'); return; }
                setArtFile(f); handleUploadArt(f);
              }}
            />
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => fileRef.current?.click()}
              disabled={artUploading}
            >
              {artUploading ? 'uploading…' : newArt ? 'replace again' : 'choose file'}
            </button>
            <div className={styles.hint}>PNG, JPG, GIF, WebP, SVG or HTML · max 15 MB</div>
          </div>
        </section>

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading || artUploading}
        >
          {loading ? 'saving…' : 'save changes →'}
        </button>

        <p className={styles.footer}>
          Need help?{' '}
          <Link href="/nodes/guide" className={styles.footerLink}>
            wallet signing guide
          </Link>
          {' · '}
          <Link href={`/card/${name}`} className={styles.footerLink}>
            back to card
          </Link>
        </p>
      </form>
    </div>
  );
}
