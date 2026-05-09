'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Nav from '../components/Nav';
import styles from './profile.module.css';

const STEPS = {
  lookup: 'lookup',
  edit:   'edit',
  done:   'done',
};

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const [step, setStep]       = useState(STEPS.lookup);
  const [address, setAddress] = useState('');
  const [lookupErr, setLookupErr] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [context, setContext] = useState(null); // { submission_count, approved_count, handle_fallback }
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');

  // Pre-fill address from ?address= query param
  useEffect(() => {
    const addr = searchParams.get('address');
    if (addr) setAddress(addr);
  }, [searchParams]);

  const [form, setForm] = useState({
    alias: '',
    anonymous: false,
    pfp_url: '',
    bio: '',
    website: '',
    twitter_handle: '',
    past_projects: '',
    cp_collections: '',
  });

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleLookup(e) {
    e.preventDefault();
    const addr = address.trim();
    if (!addr) return;
    setLookupBusy(true);
    setLookupErr('');
    try {
      const res = await fetch(`/api/artist-profile?address=${encodeURIComponent(addr)}`);
      const data = await res.json();

      if (res.status === 404 && data.error === 'no_submissions') {
        setLookupErr('No submissions found for this address. Only artists who have submitted art can create a profile.');
        return;
      }
      if (!res.ok) {
        setLookupErr(data.error || 'Lookup failed. Check the address and try again.');
        return;
      }

      // Pre-fill form from existing profile if one exists
      const p = data.profile || {};
      setForm({
        alias:          p.alias || '',
        anonymous:      !!p.anonymous,
        pfp_url:        p.pfp_url || '',
        bio:            p.bio || '',
        website:        p.website || '',
        twitter_handle: p.twitter_handle || '',
        past_projects:  p.past_projects || '',
        cp_collections: p.cp_collections && p.cp_collections !== '[]'
          ? (typeof p.cp_collections === 'string'
              ? JSON.parse(p.cp_collections).join('\n')
              : '')
          : '',
      });

      setContext({
        submission_count: data.submission_count,
        approved_count:   data.approved_count,
        handle_fallback:  data.handle_fallback,
        has_profile:      !!p.alias,
      });
      setStep(STEPS.edit);
    } catch {
      setLookupErr('Network error. Try again.');
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveErr('');
    try {
      const body = {
        btc_address:    address.trim(),
        alias:          form.alias,
        anonymous:      form.anonymous ? 1 : 0,
        pfp_url:        form.pfp_url,
        bio:            form.bio,
        website:        form.website,
        twitter_handle: form.twitter_handle,
        past_projects:  form.past_projects,
        cp_collections: form.cp_collections.trim()
          ? JSON.stringify(form.cp_collections.split('\n').map(s => s.trim()).filter(Boolean))
          : '[]',
      };
      const res = await fetch('/api/artist-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveErr(data.error || 'Save failed.');
        return;
      }
      setStep(STEPS.done);
    } catch {
      setSaveErr('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* ── Step 1: Address lookup ── */}
        {step === STEPS.lookup && (
          <div className={styles.wrap}>
            <div className={styles.header}>
              <div className={styles.eyebrow}>ARTIST PORTAL</div>
              <h1 className={styles.title}>CLAIM YOUR<br /><span>PROFILE</span></h1>
              <p className={styles.subtitle}>
                Artists who have submitted art to UNATRARE can create a public profile —
                bio, socials, collections, and a personal archive page on the directory.
              </p>
            </div>

            <form onSubmit={handleLookup} className={styles.lookupForm}>
              <label className={styles.fieldLabel}>YOUR BITCOIN (BTC) ADDRESS</label>
              <p className={styles.fieldHint}>
                The same address you used when submitting your art. This is how we verify you're the artist.
              </p>
              <input
                className={styles.addressInput}
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf..."
                spellCheck={false}
                autoComplete="off"
              />
              {lookupErr && <p className={styles.errMsg}>{lookupErr}</p>}
              <button className={styles.primaryBtn} type="submit" disabled={lookupBusy || !address.trim()}>
                {lookupBusy ? 'CHECKING…' : 'VERIFY ADDRESS →'}
              </button>
            </form>

            <div className={styles.infoBox}>
              <div className={styles.infoTitle}>HOW THIS WORKS</div>
              <div className={styles.infoSteps}>
                <div className={styles.infoStep}>
                  <span className={styles.infoGlyph}>01</span>
                  <span>Enter your Bitcoin address — the one linked to your art submissions</span>
                </div>
                <div className={styles.infoStep}>
                  <span className={styles.infoGlyph}>02</span>
                  <span>Fill in your alias, bio, socials, and Counterparty collections</span>
                </div>
                <div className={styles.infoStep}>
                  <span className={styles.infoGlyph}>03</span>
                  <span>Your profile auto-populates at <code>/artist/your-address</code> — no admin needed</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Profile form ── */}
        {step === STEPS.edit && (
          <div className={styles.wrap}>
            <div className={styles.header}>
              <div className={styles.eyebrow}>ARTIST PORTAL</div>
              <h1 className={styles.title}>{context?.has_profile ? 'EDIT YOUR' : 'CREATE YOUR'}<br /><span>PROFILE</span></h1>
              <p className={styles.subtitle}>
                {context?.approved_count > 0
                  ? `${context.approved_count} certified card${context.approved_count !== 1 ? 's' : ''} in the directory`
                  : `${context?.submission_count} submission${context?.submission_count !== 1 ? 's' : ''} on record`}
                {context?.handle_fallback && ` · @${context.handle_fallback}`}
              </p>
              <div className={styles.addressPill}>{address.slice(0,10)}…{address.slice(-8)}</div>
            </div>

            <form onSubmit={handleSave} className={styles.profileForm}>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>DISPLAY NAME / ALIAS</label>
                <input
                  className={styles.fieldInput}
                  type="text"
                  maxLength={80}
                  value={form.alias}
                  onChange={e => setField('alias', e.target.value)}
                  placeholder={context?.handle_fallback ? `@${context.handle_fallback}` : 'Your artist name'}
                />
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.anonymous}
                  onChange={e => setField('anonymous', e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>Stay anonymous — hide name and socials from public profile</span>
              </label>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>BIO / ARTIST STATEMENT</label>
                <textarea
                  className={styles.fieldTextarea}
                  rows={4}
                  maxLength={1000}
                  value={form.bio}
                  onChange={e => setField('bio', e.target.value)}
                  placeholder="What drives your art? What's your background in the Rare Pepe / XCP space?"
                />
                <span className={styles.charCount}>{form.bio.length}/1000</span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>X / TWITTER HANDLE</label>
                  <div className={styles.handleWrap}>
                    <span className={styles.handleAt}>@</span>
                    <input
                      className={styles.fieldInputInner}
                      type="text"
                      maxLength={50}
                      value={form.twitter_handle}
                      onChange={e => setField('twitter_handle', e.target.value.replace(/^@/, ''))}
                      placeholder="username"
                    />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>WEBSITE</label>
                  <input
                    className={styles.fieldInput}
                    type="url"
                    value={form.website}
                    onChange={e => setField('website', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>PFP / AVATAR URL</label>
                <input
                  className={styles.fieldInput}
                  type="url"
                  value={form.pfp_url}
                  onChange={e => setField('pfp_url', e.target.value)}
                  placeholder="https://… (direct image link)"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>COUNTERPARTY COLLECTIONS</label>
                <p className={styles.fieldHint}>One collection / series name per line</p>
                <textarea
                  className={styles.fieldTextarea}
                  rows={3}
                  value={form.cp_collections}
                  onChange={e => setField('cp_collections', e.target.value)}
                  placeholder={'RAREPEPE SERIES IV\nMY COLLECTION\n…'}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>PAST PROJECTS</label>
                <p className={styles.fieldHint}>Other art projects, collaborations, events — one per line</p>
                <textarea
                  className={styles.fieldTextarea}
                  rows={3}
                  value={form.past_projects}
                  onChange={e => setField('past_projects', e.target.value)}
                  placeholder={'Project Name — 2021\nCollaboration with XYZ — 2023\n…'}
                />
              </div>

              {saveErr && <p className={styles.errMsg}>{saveErr}</p>}

              <div className={styles.formActions}>
                <button className={styles.primaryBtn} type="submit" disabled={saving}>
                  {saving ? 'SAVING…' : 'SAVE PROFILE →'}
                </button>
                <button className={styles.ghostBtn} type="button" onClick={() => setStep(STEPS.lookup)}>
                  ← Change address
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === STEPS.done && (
          <div className={styles.wrap}>
            <div className={styles.successBox}>
              <div className={styles.successGlyph}>🐸</div>
              <div className={styles.successTitle}>PROFILE SAVED</div>
              <p className={styles.successBody}>
                Your artist page is live. It pulls directly from what you just submitted —
                no admin approval needed.
              </p>
              <div className={styles.successActions}>
                <a
                  href={`/artist/${address.trim()}`}
                  className={styles.primaryBtn}
                  style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                >
                  VIEW MY PROFILE ↗
                </a>
                <button className={styles.ghostBtn} onClick={() => setStep(STEPS.edit)}>
                  ← Edit again
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
