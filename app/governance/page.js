'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';
import styles from './governance.module.css';

function VoteBar({ yesWeight, noWeight, abstainCount }) {
  const total = (yesWeight || 0) + (noWeight || 0) + (abstainCount || 0);
  if (total === 0) return <div className={styles.voteBarEmpty}>no votes yet</div>;
  const yesPct = Math.round(((yesWeight || 0) / total) * 100);
  const noPct  = Math.round(((noWeight  || 0) / total) * 100);
  return (
    <div className={styles.voteBarWrap}>
      <div className={styles.voteBarTrack}>
        {yesPct > 0 && (
          <div className={styles.voteBarYes} style={{ width: `${yesPct}%` }} />
        )}
        {noPct > 0 && (
          <div className={styles.voteBarNo} style={{ width: `${noPct}%` }} />
        )}
      </div>
      <div className={styles.voteBarLabels}>
        <span className={styles.voteBarYesLabel}>YES {yesPct}%</span>
        <span className={styles.voteBarTotalLabel}>{total} vote{total !== 1 ? 's' : ''}</span>
        <span className={styles.voteBarNoLabel}>NO {noPct}%</span>
      </div>
    </div>
  );
}

function ProposalCard({ proposal }) {
  const [expanded, setExpanded]   = useState(false);
  const [address, setAddress]     = useState('');
  const [choice, setChoice]       = useState('');
  const [status, setStatus]       = useState(''); // '', 'voting', 'ok', 'error'
  const [msg, setMsg]             = useState('');
  const [votes, setVotes]         = useState(null);

  const isActive  = proposal.status === 'active';
  const closedLabel = proposal.status === 'enacted' ? 'ENACTED' : 'CLOSED';

  async function loadVotes() {
    const res = await fetch(`/api/vote?proposal=${proposal.id}`);
    const json = await res.json();
    if (json.ok) setVotes(json.votes);
  }

  async function castVote() {
    if (!address || !choice) { setMsg('enter your address and choose yes/no/abstain'); return; }
    setStatus('voting');
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          voterAddress: address,
          choice,
          signature: 'placeholder', // Phase 2+: full BIP-137 sig
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus('ok');
        setMsg(`vote recorded · ${choice.toUpperCase()}`);
      } else {
        setStatus('error');
        setMsg(json.error || 'vote failed');
      }
    } catch {
      setStatus('error');
      setMsg('network error');
    }
  }

  return (
    <div className={`${styles.proposal} ${!isActive ? styles.proposalClosed : ''}`}>
      <div className={styles.proposalHeader} onClick={() => { setExpanded(e => !e); if (!votes) loadVotes(); }}>
        <div className={styles.proposalMeta}>
          <span className={styles.proposalType}>{proposal.type}</span>
          <span className={`${styles.proposalStatus} ${isActive ? styles.statusActive : styles.statusClosed}`}>
            {isActive ? 'ACTIVE' : closedLabel}
          </span>
        </div>
        <div className={styles.proposalTitle}>{proposal.title}</div>
        <VoteBar
          yesWeight={proposal.yes_weight}
          noWeight={proposal.no_weight}
          abstainCount={proposal.abstain_count}
        />
        <div className={styles.proposalExpand}>{expanded ? '▲ collapse' : '▼ expand'}</div>
      </div>

      {expanded && (
        <div className={styles.proposalBody}>
          {proposal.description && (
            <div className={styles.proposalDesc}>{proposal.description}</div>
          )}

          {proposal.result && (
            <div className={styles.proposalResult}>
              <span className={styles.resultLabel}>RESULT ·</span> {proposal.result}
            </div>
          )}

          {/* Voter list */}
          {votes && votes.length > 0 && (
            <div className={styles.voteList}>
              {votes.slice(0, 10).map((v, i) => (
                <div key={i} className={styles.voteRow}>
                  <span className={styles.voteAddr}>{v.voter_addr.slice(0,8)}…{v.voter_addr.slice(-6)}</span>
                  <span className={`${styles.voteChoice} ${styles[`choice_${v.choice}`]}`}>
                    {v.choice.toUpperCase()}
                  </span>
                </div>
              ))}
              {votes.length > 10 && (
                <div className={styles.voteMore}>+{votes.length - 10} more</div>
              )}
            </div>
          )}

          {/* Vote form — only on active proposals */}
          {isActive && status !== 'ok' && (
            <div className={styles.voteForm}>
              <div className={styles.voteFormLabel}>CAST YOUR VOTE</div>
              <div className={styles.voteFormNote}>
                · requires UNAT Pepe holding · equal weight per holder ·
              </div>
              <input
                className={styles.voteInput}
                type="text"
                placeholder="your Bitcoin address"
                value={address}
                onChange={e => setAddress(e.target.value.trim())}
              />
              <div className={styles.voteChoices}>
                {['yes','no','abstain'].map(c => (
                  <button
                    key={c}
                    className={`${styles.voteChoiceBtn} ${choice === c ? styles.choiceSelected : ''} ${styles[`choiceColor_${c}`]}`}
                    onClick={() => setChoice(c)}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                className={styles.voteSubmitBtn}
                disabled={status === 'voting'}
                onClick={castVote}
              >
                {status === 'voting' ? 'submitting…' : 'SUBMIT VOTE'}
              </button>
              {msg && <div className={`${styles.voteMsg} ${status === 'error' ? styles.voteMsgError : ''}`}>{msg}</div>}
            </div>
          )}

          {status === 'ok' && (
            <div className={styles.voteSuccess}>{msg}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GovernancePage() {
  const [proposals, setProposals] = useState(null);
  const [error, setError]         = useState('');

  useEffect(() => {
    fetch('/api/proposals')
      .then(r => r.json())
      .then(j => {
        if (j.ok) setProposals(j.proposals);
        else setError('Failed to load proposals');
      })
      .catch(() => setError('Network error'));
  }, []);

  const active  = proposals?.filter(p => p.status === 'active')  || [];
  const closed  = proposals?.filter(p => p.status !== 'active')  || [];

  return (
    <>
      <Nav />
      <main className={styles.page}>

        <div className={styles.header}>
          <div className={styles.eyebrow}>· UNAT holder governance ·</div>
          <h1 className={styles.title}>GOVERN<span>A</span>NCE</h1>
          <div className={styles.subtitle}>
            Votes are weighted equally — 1 UNAT Pepe = 1 vote.
            <br />
            Series choices, rule changes, and certification standards are decided here.
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {proposals === null && !error && (
          <div className={styles.loading}>loading proposals…</div>
        )}

        {proposals !== null && proposals.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>NO PROPOSALS YET</div>
            <div className={styles.emptyText}>
              governance proposals are created by the UNATRARE admin.<br />
              UNAT Pepe holders will be notified when voting opens.
            </div>
          </div>
        )}

        {active.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>ACTIVE PROPOSALS</div>
            {active.map(p => <ProposalCard key={p.id} proposal={p} />)}
          </section>
        )}

        {closed.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>PAST PROPOSALS</div>
            {closed.map(p => <ProposalCard key={p.id} proposal={p} />)}
          </section>
        )}

      </main>
    </>
  );
}
