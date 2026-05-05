import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import { judgeToken } from '../../../../lib/judge';

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { tokenName, action, note } = body;

  if (!tokenName || typeof tokenName !== 'string') {
    return NextResponse.json({ error: 'tokenName required' }, { status: 400 });
  }

  const name = tokenName.toUpperCase().trim();
  const actions = ['approve', 'reject', 'judge', 'rejudge', 'genesis', 'purge', 'reveal',
                   'hide_from_directory', 'show_in_directory'];
  if (!actions.includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  try {
    const db = getDb();
    const token = db.prepare('SELECT * FROM tokens WHERE token_name = ?').get(name);
    if (!token) {
      return NextResponse.json({ error: 'token not found' }, { status: 404 });
    }

    if (action === 'hide_from_directory') {
      db.prepare('UPDATE tokens SET directory_hidden=1 WHERE token_name=?').run(name);
      return NextResponse.json({ ok: true, action: 'hidden_from_directory' });
    }

    if (action === 'show_in_directory') {
      db.prepare('UPDATE tokens SET directory_hidden=0 WHERE token_name=?').run(name);
      return NextResponse.json({ ok: true, action: 'shown_in_directory' });
    }

    if (action === 'judge') {
      // Trigger AI judge pipeline
      const result = await judgeToken(name);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'rejudge') {
      // Force re-score; also update verdict if score now passes/fails threshold
      const result = await judgeToken(name, { force: true });
      const config = result?.config ?? {};
      const threshold = config?.scoring?.approval_threshold ?? 0;
      const score = result?.score ?? 0;
      if (score > 0) {
        const newStatus = score >= threshold ? 'approved' : 'rejected';
        db.prepare(
          "UPDATE tokens SET status=?, judge_score=?, judged_at=unixepoch() WHERE token_name=?"
        ).run(newStatus, score, name);
        result.verdict_updated = newStatus;
      }
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'genesis') {
      // Series 0 — founding collection, admin-certified, no AI judge required
      const last = db.prepare(
        'SELECT MAX(card_number) as mx FROM tokens WHERE series=0'
      ).get();
      const card_number = (last?.mx ?? 0) + 1;

      let supply = token.supply || 0;
      if (supply <= 0) {
        try {
          const res = await fetch(
            `https://tokenscan.io/api/asset/${encodeURIComponent(name)}`,
            { headers: { 'User-Agent': 'UNATRARE/1.0' } }
          );
          if (res.ok) { const d = await res.json(); supply = Number(d.supply) || 0; }
        } catch { /* non-critical */ }
      }

      db.prepare(
        `UPDATE tokens
         SET status='approved', judged_at=unixepoch(), series=0, card_number=?,
             rejection_reason=?, supply=?
         WHERE token_name=?`
      ).run(card_number, note ? `Genesis: ${note}` : 'Genesis Series 0 — founding collection', supply, name);

      return NextResponse.json({ ok: true, action: 'genesis', series: 0, card_number, supply });
    }

    if (action === 'approve') {
      // Assign card number + series if not already set
      let { series, card_number } = token;
      if (!card_number) {
        // Find current series (fills at 300 then increments)
        const seriesRow = db.prepare(
          `SELECT series, COUNT(*) as n FROM tokens WHERE status='approved'
           GROUP BY series ORDER BY series DESC LIMIT 1`
        ).get();
        const seriesNum = (!seriesRow || seriesRow.n >= 300)
          ? (seriesRow ? seriesRow.series + 1 : 1)
          : seriesRow.series;
        const last = db.prepare(
          'SELECT MAX(card_number) as mx FROM tokens WHERE status=? AND series=?'
        ).get('approved', seriesNum);
        card_number = (last?.mx ?? 0) + 1;
        series = seriesNum;
      }

      // Fetch supply from tokenscan if not cached
      let supply = token.supply || 0;
      if (supply <= 0) {
        try {
          const res = await fetch(
            `https://tokenscan.io/api/asset/${encodeURIComponent(name)}`,
            { headers: { 'User-Agent': 'UNATRARE/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            supply = Number(data.supply) || 0;
          }
        } catch { /* non-critical */ }
      }

      db.prepare(
        `UPDATE tokens
         SET status='approved', judged_at=unixepoch(), series=?, card_number=?,
             rejection_reason=?, supply=?
         WHERE token_name=?`
      ).run(series, card_number, note ? `Admin note: ${note}` : '', supply, name);

      return NextResponse.json({ ok: true, action: 'approved', series, card_number, supply, payUrl: `https://unatrare.wtf/pay/${name}` });
    }

    if (action === 'reject') {
      const reason = note
        ? `Admin rejection: ${note}`
        : (token.rejection_reason || 'Does not meet UNATRARE standards.');

      db.prepare(
        `UPDATE tokens
         SET status='rejected', judged_at=unixepoch(), rejection_reason=?
         WHERE token_name=?`
      ).run(reason, name);

      return NextResponse.json({ ok: true, action: 'rejected' });
    }

    if (action === 'purge') {
      // Hard delete — removes from DB entirely. Art file left on disk (harmless).
      db.prepare('DELETE FROM tokens WHERE token_name = ?').run(name);
      return NextResponse.json({ ok: true, action: 'purged' });
    }

    if (action === 'reveal') {
      // Drop the art publicly — sets revealed_at so art goes live everywhere.
      // Token must be approved first.
      if (token.status !== 'approved') {
        return NextResponse.json({ error: 'token must be approved before reveal' }, { status: 400 });
      }
      db.prepare(
        "UPDATE tokens SET revealed_at=unixepoch() WHERE token_name=?"
      ).run(name);
      return NextResponse.json({ ok: true, action: 'revealed' });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
