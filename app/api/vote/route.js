import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

// GET — return votes for a proposal (or the caller's vote)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const proposalId = Number(searchParams.get('proposal'));
  const address = searchParams.get('address');

  if (!proposalId) {
    return NextResponse.json({ error: 'proposal ID required' }, { status: 400 });
  }

  const db = getDb();

  if (address) {
    const vote = db.prepare(
      'SELECT * FROM votes WHERE proposal_id=? AND voter_addr=?'
    ).get(proposalId, address);
    return NextResponse.json({ ok: true, vote: vote || null });
  }

  const votes = db.prepare(
    'SELECT voter_addr, choice, weight, voted_at FROM votes WHERE proposal_id=? ORDER BY voted_at DESC'
  ).all(proposalId);
  return NextResponse.json({ ok: true, votes });
}

// POST — cast a vote (requires UNAT holding verified on-chain)
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { proposalId, voterAddress, choice, signature } = body;

  // ── Input validation ────────────────────────────────────────
  if (!proposalId || !voterAddress || !choice || !signature) {
    return NextResponse.json({ error: 'proposalId, voterAddress, choice, signature required' }, { status: 400 });
  }

  const VALID_CHOICES = new Set(['yes', 'no', 'abstain']);
  if (!VALID_CHOICES.has(choice)) {
    return NextResponse.json({ error: 'choice must be yes, no, or abstain' }, { status: 400 });
  }

  // Basic Bitcoin address format check (P2PKH / P2SH)
  const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  if (!ADDR_RE.test(voterAddress)) {
    return NextResponse.json({ error: 'invalid voter address' }, { status: 400 });
  }

  const db = getDb();

  // ── Check proposal exists and is active ─────────────────────
  const proposal = db.prepare(
    'SELECT id, status, closes_at FROM proposals WHERE id = ?'
  ).get(Number(proposalId));
  if (!proposal) {
    return NextResponse.json({ error: 'proposal not found' }, { status: 404 });
  }
  if (proposal.status !== 'active') {
    return NextResponse.json({ error: 'proposal is not active' }, { status: 409 });
  }
  if (proposal.closes_at && proposal.closes_at < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: 'voting period has ended' }, { status: 409 });
  }

  // ── Verify voter holds UNAT Pepe (TAP protocol, via api.tap3.link) ───
  let balance = 0;
  try {
    const res = await fetch(
      `https://api.tap3.link/address/${voterAddress}`,
      { headers: { 'User-Agent': 'UNATRARE/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = await res.json();
      const balances = Array.isArray(json.token_balances) ? json.token_balances : [];
      const entry = balances.find(b => (b.tick ?? '').toLowerCase() === 'unatpepe');
      balance = entry ? Number(entry.available_balance ?? entry.balance ?? 0) : 0;
    }
  } catch { /* non-fatal: proceed with balance=0 */ }

  if (balance <= 0) {
    return NextResponse.json({
      error: 'Only UNAT Pepe holders may vote. Your address holds 0 UNATRARE tokens.'
    }, { status: 403 });
  }

  // Weight = 1 per holder (equal weight — no plutocracy)
  const weight = 1;

  // ── Record vote ─────────────────────────────────────────────
  try {
    db.prepare(
      `INSERT INTO votes (proposal_id, voter_addr, choice, weight)
       VALUES (?, ?, ?, ?)`
    ).run(Number(proposalId), voterAddress, choice, weight);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'You have already voted on this proposal' }, { status: 409 });
    }
    return NextResponse.json({ error: 'database error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, choice, weight, balance });
}

export const dynamic = 'force-dynamic';
