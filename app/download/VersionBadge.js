'use client';

import { useEffect, useState } from 'react';
import styles from './download.module.css';

// Reads the live release manifest so the page always reflects the newest build
// the moment latest.json is bumped — no redeploy needed.
export default function VersionBadge() {
  const [v, setV] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/downloads/latest.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && j.version) setV(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!v) return null;
  return (
    <div className={styles.verBadge}>
      <span className={styles.verDot} aria-hidden="true" />
      Latest version <b>v{v.version}</b>
      {v.notes ? <span className={styles.verNotes}> · {v.notes}</span> : null}
    </div>
  );
}
