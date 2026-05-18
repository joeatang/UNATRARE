import { ImageResponse } from 'next/og'

export const alt = 'UNATRARE — Certified Counterparty Art on Bitcoin'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        background: '#080808',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* Outer border frame */}
      <div
        style={{
          position: 'absolute',
          inset: '28px',
          border: '1px solid #303030',
          display: 'flex',
        }}
      />

      {/* Inner corner accents — top left */}
      <div style={{ position: 'absolute', top: '28px', left: '28px', width: '40px', height: '40px', borderTop: '2px solid #b4ff6f', borderLeft: '2px solid #b4ff6f', display: 'flex' }} />
      {/* top right */}
      <div style={{ position: 'absolute', top: '28px', right: '28px', width: '40px', height: '40px', borderTop: '2px solid #b4ff6f', borderRight: '2px solid #b4ff6f', display: 'flex' }} />
      {/* bottom left */}
      <div style={{ position: 'absolute', bottom: '28px', left: '28px', width: '40px', height: '40px', borderBottom: '2px solid #b4ff6f', borderLeft: '2px solid #b4ff6f', display: 'flex' }} />
      {/* bottom right */}
      <div style={{ position: 'absolute', bottom: '28px', right: '28px', width: '40px', height: '40px', borderBottom: '2px solid #b4ff6f', borderRight: '2px solid #b4ff6f', display: 'flex' }} />

      {/* Top label */}
      <div
        style={{
          position: 'absolute',
          top: '52px',
          display: 'flex',
          color: '#5abf5a',
          fontSize: '15px',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          fontFamily: 'monospace',
        }}
      >
        BITCOIN · COUNTERPARTY · DMT
      </div>

      {/* Main wordmark */}
      <div
        style={{
          fontSize: '128px',
          fontWeight: '900',
          color: '#b4ff6f',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          textTransform: 'uppercase',
          display: 'flex',
          fontFamily: 'sans-serif',
        }}
      >
        UNATRARE
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: '28px',
          fontSize: '26px',
          color: '#5abf5a',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          display: 'flex',
          fontFamily: 'monospace',
        }}
      >
        NOT EVERY PEPE MAKES THE CUT.
      </div>

      {/* Bottom detail row */}
      <div
        style={{
          position: 'absolute',
          bottom: '52px',
          display: 'flex',
          flexDirection: 'row',
          gap: '0px',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'flex', color: '#a89060', fontSize: '14px', letterSpacing: '0.2em', fontFamily: 'monospace' }}>AI-JUDGED</span>
        <span style={{ display: 'flex', color: '#303030', fontSize: '14px', margin: '0 20px', fontFamily: 'monospace' }}>·</span>
        <span style={{ display: 'flex', color: '#a89060', fontSize: '14px', letterSpacing: '0.2em', fontFamily: 'monospace' }}>CERTIFIED ON BITCOIN</span>
        <span style={{ display: 'flex', color: '#303030', fontSize: '14px', margin: '0 20px', fontFamily: 'monospace' }}>·</span>
        <span style={{ display: 'flex', color: '#a89060', fontSize: '14px', letterSpacing: '0.2em', fontFamily: 'monospace' }}>unatrare.wtf</span>
      </div>
    </div>,
    { ...size }
  )
}
