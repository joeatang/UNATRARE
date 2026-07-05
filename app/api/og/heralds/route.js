// GET /api/og/heralds — downloadable promo/explainer graphic for Heralds & Reach.
// 1080×1080 square PNG rendered server-side via next/og (same engine as the block
// card). Public, cacheable. Save it straight from the URL, or share the link.

import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AMBER = '#ffb020';
const GREEN = '#b4ff6f';
const DIM = '#8f8f8f';

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 62, height: 62, borderRadius: 999, border: `2px solid ${AMBER}`,
          color: AMBER, fontSize: 30, fontWeight: 800,
        }}
      >
        {n}
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: '#f5f5f5' }}>{children}</div>
    </div>
  );
}

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px', height: '1080px', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#080808', color: '#f5f5f5',
          padding: '80px 84px', border: `4px solid ${AMBER}`, fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 34, letterSpacing: 12, color: AMBER, fontWeight: 800 }}>UNATRARE</div>
          <div style={{ display: 'flex', fontSize: 20, letterSpacing: 5, color: DIM }}>CERTIFIED · ON BITCOIN</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 8, color: DIM, marginBottom: 14 }}>NEW · NOW IN TESTING</div>
          <div style={{ display: 'flex', fontSize: 108, lineHeight: 1, fontWeight: 900 }}>Become a</div>
          <div style={{ display: 'flex', fontSize: 108, lineHeight: 1.05, fontWeight: 900, color: AMBER }}>Herald.</div>
          <div style={{ display: 'flex', fontSize: 32, lineHeight: 1.45, marginTop: 26, maxWidth: 880 }}>
            Support the art even if you can’t spend. Share a card, bring real people in, and build your public Reach.
          </div>
          <div style={{ display: 'flex', fontSize: 25, color: GREEN, marginTop: 14 }}>
            No funds needed. Word of mouth counts. Burning only multiplies it.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Step n="1">Claim your Bitcoin block — your permanent badge.</Step>
          <Step n="2">Light a beacon — share any card with your link.</Step>
          <Step n="3">Every click & new supporter you bring lifts your Reach.</Step>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 30, color: AMBER, letterSpacing: 2, fontWeight: 700 }}>unatrare.wtf</div>
          <div style={{ display: 'flex', fontSize: 20, color: DIM, letterSpacing: 3 }}>EARLY TESTERS WANTED</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    },
  );
}
