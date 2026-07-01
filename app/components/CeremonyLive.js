'use client';
import { useEffect, useState, useCallback } from 'react';
import CeremonyBurnPanel from './CeremonyBurnPanel';
import { fmtFull, fmtCompact } from '../../lib/cashBurn';
import styles from './CeremonyLive.module.css';

/**
 * Client island for a cash-burn ceremony detail page.
 *
 * - When active: renders the BurnPanel + a live contributor leaderboard that
 *   polls /api/cash-burn/active every POLL_MS.
 * - When closed: renders a quiet stats sheet (final total, contributor count,
 *   top contributors) without polling.
 *
 * `initialState` shape matches /api/cash-burn/active response.
 */

const POLL_MS = 15_000;

function trunc(addr) {
  if (!addr) return '';
  return addr.length > 12 ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : addr;
}

function fmtClock(secs) {
  if (!Number.isFinite(secs) || secs < 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function relTime(unixSec) {
  if (!unixSec) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function CeremonyLive({ initialState }) {
  const [state, setState] = useState(initialState);
  const isActive = state?.status === 'active';

  const refresh = useCallback(async () => {
    if (!state?.id) return;
    try {
      const r = await fetch(`/api/cash-burn/active?id=${state.id}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j?.ceremony?.id) setState(j.ceremony);
    } catch { /* network blip */ }
  }, [state?.id]);

  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [isActive, refresh]);

  const onContribution = useCallback(() => { refresh(); }, [refresh]);

  if (!state) return null;

  const total      = Number(state.final_total) || 0;
  const seed       = Number(state.admin_seed_amount) || 0;
  const community  = Number(state.contributions_total) || 0;
  const contribs   = Array.isArray(state.leaderboard) ? state.leaderboard : [];
  const contributorCount = Number(state.contributor_count) || 0;
  const min        = Number(state.min_contribution) || 69;

  const durationSec = state.closed_at && state.opened_at
    ? Math.max(0, Number(state.closed_at) - Number(state.opened_at))
    : null;

  return (
    <div className={styles.wrap}>
      {isActive && (
        <CeremonyBurnPanel
          ceremonyId={state.id}
          ordinal={state.ordinal}
          onContribution={onContribution}
        />
      )}

      <div className={styles.statsSheet}>
        <div className={styles.statsHeader}>
          {isActive ? '● live total' : 'final stats'}
        </div>
        <div className={styles.bigNum}>
          {fmtFull(total)}
          <span className={styles.bigNumUnit}> $CASH</span>
        </div>
        <div className={styles.breakdown}>
          {seed > 0 && <span>seed {fmtCompact(seed)}</span>}
          {seed > 0 && community > 0 && <span className={styles.sep}>+</span>}
          {community > 0 && <span>community {fmtCompact(community)}</span>}
          {community > 0 && (
            <span className={styles.sep}>·</span>
          )}
          {community > 0 && (
            <span>{contributorCount} {contributorCount === 1 ? 'contributor' : 'contributors'}</span>
          )}
          {durationSec != null && (
            <>
              <span className={styles.sep}>·</span>
              <span>{fmtClock(durationSec)} window</span>
            </>
          )}
        </div>
      </div>

      {contribs.length > 0 && (
        <div className={styles.ledger}>
          <div className={styles.ledgerTitle}>
            {isActive ? 'contributors · live' : 'top contributors'}
          </div>
          <div className={styles.list}>
            {contribs.slice(0, 10).map((c, i) => {
              const when = c.last_burn_at || c.first_burn_at || c.burned_at;
              const amount = Number(c.amount ?? c.amount_display) || 0;
              return (
                <div key={`${c.sol_wallet}-${i}`} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <a
                    className={styles.wallet}
                    href={`https://solscan.io/account/${c.sol_wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {trunc(c.sol_wallet)}
                  </a>
                  <span className={styles.amt}>{fmtCompact(amount)} $CASH</span>
                  <span className={styles.when}>{relTime(when)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isActive && contribs.length === 0 && (
        <div className={styles.empty}>
          no community contributions yet · be the first to add to this ceremony · minimum {min} $CASH
        </div>
      )}
    </div>
  );
}
