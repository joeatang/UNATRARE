// Public per-ceremony image endpoint.
// Returns the cached ceremony PNG, regenerating if the file is missing.
// Used by:
//   - Twitter/X & open-graph share previews on /burns/[id]
//   - Direct image embeds (e.g. user copies the URL into chat)
//
// We DON'T expose admin-only fields; the URL only takes a numeric id.

import { NextResponse } from 'next/server';
import path from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { getDb } from '../../../../../lib/db';
import { renderCashBurnImageToFile } from '../../../../../lib/burnImage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function absImagePathFor(ordinal) {
  const padded = String(ordinal).padStart(3, '0');
  return path.join(process.cwd(), 'public', 'uploads', 'cash-burns', `cbc-${padded}.png`);
}

export async function GET(request, { params }) {
  const id = Number(params?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(id);
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const absPath = absImagePathFor(row.ordinal);

  // Lazy regeneration: if the PNG was deleted (e.g. fresh deploy), rebuild.
  if (!existsSync(absPath)) {
    try {
      await renderCashBurnImageToFile({
        ordinal:       row.ordinal,
        character_key: row.character_key,
        amount:        row.amount,
        card_name:     row.card_name,
        headline:      row.headline,
        quote:         row.quote,
        burned_at:     row.burned_at,
      }, absPath);
    } catch (e) {
      console.warn('[og/cash-burn] regen failed:', e.message);
      return NextResponse.json({ error: 'render failed' }, { status: 500 });
    }
  }

  const buf = await readFile(absPath);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':  'image/png',
      // Active ceremonies update; closed ceremonies are immutable.
      'Cache-Control': row.status === 'active'
        ? 'public, max-age=60'
        : 'public, max-age=86400, immutable',
    },
  });
}
