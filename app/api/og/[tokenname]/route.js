import { ImageResponse } from 'next/og';
import { getDb } from '../../../../lib/db';

export const runtime = 'nodejs';

const SITE_URL = 'https://unatrare.wtf';
const W = 400, H = 560;

function getToken(tokenname) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tokens WHERE token_name = ?').get(tokenname.toUpperCase());
    return row ? { ...row } : null;
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const { tokenname } = await params;
  const token = getToken(tokenname);

  const isApproved = token?.status === 'approved';
  const isPending  = !token || token.status === 'pending';
  const isRejected = token?.status === 'rejected';
  const isRevealed = isApproved && !!token?.revealed_at;

  const statusColor  = isApproved ? '#5abf5a' : isPending ? '#C9A84C' : '#c0392b';
  const statusLabel  = isRevealed ? 'CERTIFIED' : isApproved ? 'UNREVEALED' : isPending ? 'PENDING' : 'REJECTED';
  const tokenName    = token?.token_name ?? tokenname.toUpperCase();

  // Always use absolute URLs — ImageResponse fetches them at render time
  let artUrl = null;
  if (isRevealed) {
    if (token.art_mime?.startsWith('video/') && token.art_cover_url) {
      // Use cover image for OG — ImageResponse cannot render video
      artUrl = token.art_cover_url.startsWith('http')
        ? token.art_cover_url
        : `${SITE_URL}${token.art_cover_url}`;
    } else if (token.art_hash) {
      artUrl = `${SITE_URL}/art/${token.art_hash}`;
    } else if (token.art_url) {
      artUrl = token.art_url.startsWith('http') ? token.art_url : `${SITE_URL}${token.art_url}`;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 400,
          height: 560,
          background: '#080808',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #2a2a2a',
          fontFamily: '"Share Tech Mono", monospace',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header strip */}
        <div
          style={{
            height: 36,
            borderBottom: `1px solid ${statusColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, letterSpacing: 4, color: '#C9A84C' }}>UNATRARE</span>
          <span style={{ fontSize: 9, letterSpacing: 3, color: statusColor }}>{statusLabel}</span>
        </div>

        {/* Art area */}
        <div
          style={{
            flex: 1,
            background: '#0f0f0f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {artUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artUrl}
              alt={tokenName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            /* Mystery / pending / no-image placeholder */
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'repeating-linear-gradient(45deg,#1a1a1a 0px,#1a1a1a 4px,#111111 4px,#111111 8px)',
              }}
            >
              <span style={{ fontSize: 48, lineHeight: 1 }}>🐸</span>
              <span style={{ fontSize: 10, letterSpacing: 4, color: '#C9A84C' }}>
                {isApproved ? 'UNREVEALED' : isPending ? 'PENDING JUDGMENT' : 'REJECTED'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            height: 52,
            borderTop: `1px solid #1a1a1a`,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 13, letterSpacing: 2, color: '#d4d4d4', marginBottom: 3 }}>
            {tokenName}
          </div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#666666' }}>
            {isApproved && token?.series && token?.card_number
              ? `Series ${token.series} · #${String(token.card_number).padStart(4, '0')} · unatrare.wtf`
              : 'unatrare.wtf'}
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
    }
  );
}
