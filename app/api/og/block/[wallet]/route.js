// Public share-card image for a torchbearer's claimed Bitcoin block.
// 1200×630 PNG (X / open-graph card spec), rendered server-side via next/og.
// Used by:
//   - the "Flex your block" share sheet (Save image / preview)
//   - og:image on /torchbearer/[wallet] so tweeting a profile link previews it
//
// URL only takes a wallet address — no admin fields exposed.

import { ImageResponse } from 'next/og';
import { getDb } from '../../../../../lib/db';
import { tierFor, truncateWallet } from '../../../../../lib/saluteDisplay';
import { getTorchbearer, displayFor } from '../../../../../lib/torchbearerIdentity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request, { params }) {
  const wallet = decodeURIComponent((await params)?.wallet || '');
  if (!SOL_ADDR_RE.test(wallet)) {
    return new Response('bad wallet', { status: 400 });
  }

  const identity = getTorchbearer(wallet);
  const disp = displayFor(identity, wallet);
  if (disp.block == null) {
    return new Response('no block claimed', { status: 404 });
  }

  // Burn tier (matches the primary badge on the profile page).
  let tierLabel = 'TORCHBEARER';
  let tierColor = '#ffb020';
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT COALESCE(SUM(amount_display), 0) AS tb FROM card_salutes WHERE sol_wallet = ?')
      .get(wallet);
    const t = tierFor(Number(row?.tb || 0));
    if (t?.label) tierLabel = t.label;
    if (t?.color) tierColor = t.color;
  } catch { /* fall back to defaults */ }

  const blockStr = Number(disp.block).toLocaleString();
  const subtitle = identity?.handle ? `@${identity.handle}` : truncateWallet(wallet);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#080808',
          padding: '64px 72px',
          border: '3px solid #ffb020',
          fontFamily: 'sans-serif',
        }}
      >
        {/* top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 34, letterSpacing: 10, color: '#ffb020', fontWeight: 800 }}>
            UNATRARE
          </div>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 4, color: '#8f8f8f' }}>
            CERTIFIED · ON BITCOIN
          </div>
        </div>

        {/* center */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', fontSize: 30, letterSpacing: 12, color: '#8f8f8f' }}>
            BITCOIN GENESIS BLOCK
          </div>
          <div style={{ display: 'flex', fontSize: 190, lineHeight: 1, color: '#ffb020', fontWeight: 900 }}>
            #{blockStr}
          </div>
          <div style={{ display: 'flex', fontSize: 46, color: '#f5f5f5', marginTop: 10 }}>
            {subtitle}
          </div>
        </div>

        {/* bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              letterSpacing: 3,
              color: tierColor,
              border: `2px solid ${tierColor}88`,
              borderRadius: '999px',
              padding: '12px 26px',
            }}
          >
            {tierLabel}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#8f8f8f' }}>unatrare.wtf</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
