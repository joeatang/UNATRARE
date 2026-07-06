// GET /api/og/artist-update — a minimal briefing graphic for artists covering
// the recent Studio / payouts / UNATREACH / Torchbearer updates + actions.
// 1080×1350 portrait PNG via next/og. Public, downloadable, reproducible.

import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AMBER = '#ffb020';
const GREEN = '#b4ff6f';
const DIM = '#8f8f8f';
const TEXT = '#f5f5f5';

function Update({ tag, line }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', fontSize: 22, letterSpacing: 4, color: AMBER, fontWeight: 800 }}>{tag}</div>
      <div style={{ display: 'flex', fontSize: 27, lineHeight: 1.3, color: TEXT }}>{line}</div>
    </div>
  );
}

function Action({ n, line }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 999, background: GREEN, color: '#080808', fontSize: 24, fontWeight: 900 }}>{n}</div>
      <div style={{ display: 'flex', fontSize: 26, color: TEXT }}>{line}</div>
    </div>
  );
}

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px', height: '1350px', display: 'flex', flexDirection: 'column',
          background: '#080808', padding: '70px 74px', border: `4px solid ${AMBER}`,
          fontFamily: 'sans-serif', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 32, letterSpacing: 10, color: AMBER, fontWeight: 800 }}>UNATRARE</div>
          <div style={{ display: 'flex', fontSize: 20, letterSpacing: 4, color: DIM }}>ARTIST UPDATE</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 62, lineHeight: 1.02, fontWeight: 900, color: TEXT }}>What's new —</div>
          <div style={{ display: 'flex', fontSize: 62, lineHeight: 1.05, fontWeight: 900, color: AMBER }}>and what to do.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <Update tag="STUDIO" line="One hub for your submissions, card updates & payouts." />
          <Update tag="PAYOUTS" line="Set your Solana address once — it applies to ALL your cards. You earn 31% of every salute." />
          <Update tag="UNATREACH" line="Your community earns this by sharing your cards — fans become promoters, bringing you more salutes. (You can share too.)" />
          <Update tag="TORCHBEARERS" line="Your supporters — now ranked and credited right on your cards." />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 5, color: GREEN, fontWeight: 800 }}>ACTIONS TO TAKE NOW</div>
          <Action n="1" line="Open the Studio → set your payout address (one signature)." />
          <Action n="2" line="Check your card shows 'TO ARTIST' — that's your 31%." />
          <Action n="3" line="Rally your supporters to share your cards & earn UNATREACH." />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 30, color: AMBER, letterSpacing: 2, fontWeight: 700 }}>unatrare.wtf/studio</div>
          <div style={{ display: 'flex', fontSize: 18, color: DIM, letterSpacing: 3 }}>CERTIFIED · ON BITCOIN</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
  );
}
