import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import { judgeToken } from '../../../../lib/judge';

// Auto-update exemplar calibration list when a human overrides the AI verdict.
// Graceful — any failure here never blocks the actual admin action.
function appendExemplar(type, tokenName, note) {
  try {
    const cfgPath = path.join(process.cwd(), 'judges.config.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const list = cfg.exemplar_cards[type];
    if (!list.some(e => e.startsWith(tokenName + ' '))) {
      const reason = note
        ? note.replace(/^Admin (note|rejection): ?/i, '').trim()
        : type === 'approved'
          ? 'human council override — genuine Pepe energy confirmed'
          : 'human council override — failed human review';
      list.push(`${tokenName} (${reason})`);
      writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    }
  } catch (e) {
    console.warn('[exemplar] failed to update judges.config.json:', e.message);
  }
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { tokenName, action, note, series: seriesOverride } = body;

  if (!tokenName || typeof tokenName !== 'string') {
    return NextResponse.json({ error: 'tokenName required' }, { status: 400 });
  }

  const name = tokenName.toUpperCase().trim();
  const actions = ['approve', 'reject', 'judge', 'rejudge', 'genesis', 'purge', 'reveal',
                   'hide_from_directory', 'show_in_directory',
                   'certify_stamp', 'decertify_stamp'];
  if (!actions.includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  try {
    const db = getDb();
    const token = db.prepare('SELECT * FROM tokens WHERE token_name = ?').get(name);
    if (!token) {
      return NextResponse.json({ error: 'token not found' }, { status: 404 });
    }

    if (action === 'certify_stamp') {
      if (token.status !== 'approved') {
        return NextResponse.json({ error: 'token must be approved before stamping' }, { status: 400 });
      }
      // Auto-reveal: certifying as dank means it's ready to go public
      db.prepare(
        'UPDATE tokens SET council_certified=1, revealed_at=COALESCE(revealed_at, unixepoch()) WHERE token_name=?'
      ).run(name);
      return NextResponse.json({ ok: true, action: 'certify_stamp', council_certified: 1 });
    }

    if (action === 'decertify_stamp') {
      db.prepare('UPDATE tokens SET council_certified=0 WHERE token_name=?').run(name);
      return NextResponse.json({ ok: true, action: 'decertify_stamp', council_certified: 0 });
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
      // judgeToken force mode now handles full DB update (status + council_certified)
      const result = await judgeToken(name, { force: true });
      if (result?.status) {
        result.verdict_updated = result.status;
      }
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'genesis') {
      // Admin-certified founding card — defaults to Series 0 but respects seriesOverride
      let genesisSeriesNum = 0;
      if (seriesOverride !== undefined && seriesOverride !== null && seriesOverride !== '') {
        const parsed = parseInt(seriesOverride, 10);
        if (isNaN(parsed) || parsed < 0) {
          return NextResponse.json({ error: 'invalid series number' }, { status: 400 });
        }
        genesisSeriesNum = parsed;
      }

      const last = db.prepare(
        "SELECT MAX(card_number) as mx FROM tokens WHERE series=? AND status='approved'"
      ).get(genesisSeriesNum);
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
         SET status='approved', judged_at=unixepoch(), revealed_at=COALESCE(revealed_at, unixepoch()),
             series=?, card_number=?, rejection_reason=?, supply=?, council_certified=1
         WHERE token_name=?`
      ).run(genesisSeriesNum, card_number, note ? `Genesis: ${note}` : `Genesis Series ${genesisSeriesNum} — founding collection`, supply, name);

      return NextResponse.json({ ok: true, action: 'genesis', series: genesisSeriesNum, card_number, supply });
    }

    if (action === 'approve') {
      // Assign card number + series if not already set
      let { series, card_number } = token;
      if (!card_number) {
        // Use admin-specified series if provided, otherwise auto-assign
        let seriesNum;
        if (seriesOverride !== undefined && seriesOverride !== null && seriesOverride !== '') {
          seriesNum = parseInt(seriesOverride, 10);
          if (isNaN(seriesNum) || seriesNum < 0) {
            return NextResponse.json({ error: 'invalid series number' }, { status: 400 });
          }
        } else {
          // Find current series (fills at 300 then increments)
          const seriesRow = db.prepare(
            `SELECT series, COUNT(*) as n FROM tokens WHERE status='approved'
             GROUP BY series ORDER BY series DESC LIMIT 1`
          ).get();
          seriesNum = (!seriesRow || seriesRow.n >= 300)
            ? (seriesRow ? seriesRow.series + 1 : 1)
            : seriesRow.series;
        }
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
         SET status='approved', judged_at=unixepoch(), revealed_at=COALESCE(revealed_at, unixepoch()),
             series=?, card_number=?, rejection_reason=?, supply=?
         WHERE token_name=?`
      ).run(series, card_number, note ? `Admin note: ${note}` : '', supply, name);

      // If the AI had previously rejected this, it's a human override — feed it back as an exemplar
      if (token.status === 'rejected') {
        appendExemplar('approved', name, note);
      }

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

      // If the AI had previously approved this, it's a human override — feed it back as a rejected exemplar
      if (token.status === 'approved') {
        appendExemplar('rejected', name, note);
      }

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
