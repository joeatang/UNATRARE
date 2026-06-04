import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import { notifyCeremonyOpen, notifyCeremonyClose } from '../../../../lib/telegram';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['draft', 'scheduled', 'active', 'closed', 'archived']);
const SPOTLIGHT_HOURS = 48;
const BURN_FLOOR = 69;

// Themes are randomized per activation — experiential, not configurable by admin.
const THEMES = ['ember', 'flame', 'inferno', 'legendary', 'frost', 'neon', 'void', 'gold'];
function randomTheme() {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}
const ENABLE_NODE_PRESET = process.env.SALUTE_ENABLE_NODE_PRESET === '1';
const SPLIT_PRESETS = {
  phase1_artist_31: {
    key: 'phase1_artist_31',
    label: '69 burn / 31 artist',
    burn_pct: 69,
    artist_pct: 31,
    node_pct: 0,
  },
  phase2_artist_21_node_10: {
    key: 'phase2_artist_21_node_10',
    label: '69 burn / 21 artist / 10 nodes',
    burn_pct: 69,
    artist_pct: 21,
    node_pct: 10,
  },
};

function getActiveSplitPresets() {
  const active = [SPLIT_PRESETS.phase1_artist_31];
  if (ENABLE_NODE_PRESET) active.push(SPLIT_PRESETS.phase2_artist_21_node_10);
  return active;
}

const ACTIVE_SPLIT_PRESETS = getActiveSplitPresets();
const ACTIVE_SPLIT_MAP = Object.fromEntries(ACTIVE_SPLIT_PRESETS.map(p => [p.key, p]));
const VALID_DISTRIBUTION_MODES = new Set([
  'none',
  'top_burners',
  'weighted_burners',
  'raffle_burners',
  'manual_curated',
]);
const POLICY = {
  enforceWindow: process.env.SALUTE_ENFORCE_CEREMONY_WINDOW === '1',
  strictConfiguredOnly: process.env.SALUTE_ENFORCE_CEREMONY_STRICT === '1',
  burnFloor: BURN_FLOOR,
  spotlightHours: SPOTLIGHT_HOURS,
  splitPresets: ACTIVE_SPLIT_PRESETS,
  nodePresetEnabled: ENABLE_NODE_PRESET,
};

function normalizeCardName(v) {
  return (v || '').toUpperCase().trim();
}

function isValidCardName(v) {
  return /^[A-Z][A-Z0-9.]{0,49}$/.test(v || '');
}

function parseUnix(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function parseSplitPreset(v) {
  const key = String(v || 'phase1_artist_31').trim();
  const preset = ACTIVE_SPLIT_MAP[key];
  if (!preset) return null;
  if (preset.burn_pct < BURN_FLOOR) return null;
  if ((preset.burn_pct + preset.artist_pct + preset.node_pct) !== 100) return null;
  return preset;
}

function normalizeDistributionMode(v) {
  const mode = String(v || 'none').trim();
  return VALID_DISTRIBUTION_MODES.has(mode) ? mode : null;
}

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || '').toLowerCase().trim();
  const card = normalizeCardName(searchParams.get('card') || '');
  const db = getDb();

  const requireSplitTxEnv = process.env.SALUTE_REQUIRE_ARTIST_SPLIT_TX === '1';

  if (card) {
    const row = db.prepare(`
      SELECT c.*, t.display_title, t.artist_handle, t.artist_sol_address
      FROM salute_ceremonies c
      LEFT JOIN tokens t ON t.token_name = c.card_name
      WHERE c.card_name = ?
      LIMIT 1
    `).get(card);
    return NextResponse.json({ ok: true, ceremony: row || null, policy: POLICY, env: { requireSplitTx: requireSplitTxEnv } });
  }

  const where = status && VALID_STATUSES.has(status) ? 'WHERE c.status = ?' : '';
  const rows = db.prepare(`
    SELECT c.*, t.display_title, t.artist_handle, t.artist_sol_address
    FROM salute_ceremonies c
    LEFT JOIN tokens t ON t.token_name = c.card_name
    ${where}
    ORDER BY c.updated_at DESC, c.id DESC
    LIMIT 500
  `).all(...(where ? [status] : []));

  return NextResponse.json({ ok: true, ceremonies: rows, policy: POLICY, env: { requireSplitTx: requireSplitTxEnv } });
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const action = (body?.action || '').toLowerCase().trim();
  const cardName = normalizeCardName(body?.card_name || '');
  if (!action) {
    return NextResponse.json({ error: 'action required' }, { status: 422 });
  }
  if (!cardName || !isValidCardName(cardName)) {
    return NextResponse.json({ error: 'valid card_name required' }, { status: 422 });
  }

  const db = getDb();
  const token = db.prepare("SELECT token_name, artist_sol_address FROM tokens WHERE token_name = ? AND status = 'approved'").get(cardName);
  if (!token) {
    return NextResponse.json({ error: 'card not found or not certified' }, { status: 404 });
  }

  // Optional inline artist SOL address update (used for activate/upsert from admin).
  const artistSolRaw = String(body?.artist_sol_address || '').trim();
  if (artistSolRaw) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(artistSolRaw)) {
      return NextResponse.json({ error: 'artist_sol_address is not a valid Solana address' }, { status: 422 });
    }
    if (artistSolRaw !== (token.artist_sol_address || '')) {
      db.prepare('UPDATE tokens SET artist_sol_address = ? WHERE token_name = ?').run(artistSolRaw, cardName);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const headline = String(body?.headline || '').trim();
  const subtitle = String(body?.subtitle || '').trim();
  // Theme is always randomized per activation — ignore any admin-supplied value
  // unless explicitly overridden via theme_key_override (debug only).
  const themeOverride = String(body?.theme_key_override || '').trim();
  const themeKey = (themeOverride && THEMES.includes(themeOverride)) ? themeOverride : randomTheme();
  const startsAt = parseUnix(body?.starts_at);
  const endsAt = parseUnix(body?.ends_at);
  const splitPreset = parseSplitPreset(body?.split_preset);
  const distributionMode = normalizeDistributionMode(body?.distribution_mode);
  const distributionAsset = String(body?.distribution_asset || '').trim().slice(0, 80);
  const distributionRule = String(body?.distribution_rule || '').trim().slice(0, 500);

  if (!splitPreset) {
    return NextResponse.json({ error: 'invalid split_preset' }, { status: 422 });
  }
  if (!distributionMode) {
    return NextResponse.json({ error: 'invalid distribution_mode' }, { status: 422 });
  }

  const existing = db.prepare('SELECT id FROM salute_ceremonies WHERE card_name = ?').get(cardName);

  if (action === 'upsert') {
    const nextStatus = VALID_STATUSES.has((body?.status || '').toLowerCase())
      ? String(body.status).toLowerCase()
      : (existing ? 'draft' : 'draft');

    if (startsAt != null && endsAt != null && endsAt <= startsAt) {
      return NextResponse.json({ error: 'ends_at must be greater than starts_at' }, { status: 422 });
    }

    if (existing) {
      db.prepare(`
        UPDATE salute_ceremonies
        SET headline = ?, subtitle = ?, theme_key = ?,
            split_preset = ?, burn_pct = ?, artist_pct = ?, node_pct = ?,
            distribution_mode = ?, distribution_asset = ?, distribution_rule = ?,
            status = ?, starts_at = ?, ends_at = ?, updated_at = ?
        WHERE card_name = ?
      `).run(
        headline,
        subtitle,
        themeKey,
        splitPreset.key,
        splitPreset.burn_pct,
        splitPreset.artist_pct,
        splitPreset.node_pct,
        distributionMode,
        distributionAsset,
        distributionRule,
        nextStatus,
        startsAt,
        endsAt,
        now,
        cardName,
      );
    } else {
      db.prepare(`
        INSERT INTO salute_ceremonies (
          card_name, headline, subtitle, theme_key,
          split_preset, burn_pct, artist_pct, node_pct,
          distribution_mode, distribution_asset, distribution_rule,
          status, starts_at, ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cardName,
        headline,
        subtitle,
        themeKey,
        splitPreset.key,
        splitPreset.burn_pct,
        splitPreset.artist_pct,
        splitPreset.node_pct,
        distributionMode,
        distributionAsset,
        distributionRule,
        nextStatus,
        startsAt,
        endsAt,
        now,
        now,
      );
    }

    const ceremony = db.prepare('SELECT * FROM salute_ceremonies WHERE card_name = ?').get(cardName);
    return NextResponse.json({ ok: true, ceremony });
  }

  if (action === 'activate') {
    if (POLICY.strictConfiguredOnly && !existing) {
      return NextResponse.json(
        { error: 'strict mode requires an existing ceremony row before activation' },
        { status: 422 },
      );
    }

    // Pre-flight: split-tx env requires the token to have an artist SOL payout address.
    // Re-read because the optional inline update earlier may have just populated it.
    const requireSplitTxEnv = process.env.SALUTE_REQUIRE_ARTIST_SPLIT_TX === '1';
    if (requireSplitTxEnv) {
      const tokRow = db.prepare('SELECT artist_sol_address, artist_address FROM tokens WHERE token_name = ?').get(cardName);
      if (!tokRow?.artist_sol_address) {
        return NextResponse.json({
          error: 'missing_artist_sol',
          message: `${cardName} has no artist SOL payout address. Ask the artist to set it on their /status page (they must sign with their submission BTC address), OR paste it under ⚙️ ADVANCED → ARTIST SOL ADDRESS to set it on their behalf.`,
          artist_btc_address: tokRow?.artist_address || null,
        }, { status: 422 });
      }
    }

    const effectiveStart = startsAt ?? now;
    const effectiveEnd = effectiveStart + SPOTLIGHT_HOURS * 60 * 60;
    if (endsAt != null && endsAt !== effectiveEnd) {
      return NextResponse.json({ error: `spotlight campaigns are fixed at ${SPOTLIGHT_HOURS}h` }, { status: 422 });
    }
    if (effectiveEnd <= effectiveStart) {
      return NextResponse.json({ error: 'ends_at must be greater than starts_at' }, { status: 422 });
    }

    if (existing) {
      db.prepare(`
        UPDATE salute_ceremonies
        SET status = 'active',
            starts_at = ?,
            ends_at = ?,
            headline = COALESCE(NULLIF(?, ''), headline),
            subtitle = COALESCE(NULLIF(?, ''), subtitle),
            theme_key = COALESCE(NULLIF(?, ''), theme_key),
            split_preset = ?,
            burn_pct = ?,
            artist_pct = ?,
            node_pct = ?,
            distribution_mode = ?,
            distribution_asset = ?,
            distribution_rule = ?,
            updated_at = ?
        WHERE card_name = ?
      `).run(
        effectiveStart,
        effectiveEnd,
        headline,
        subtitle,
        themeKey,
        splitPreset.key,
        splitPreset.burn_pct,
        splitPreset.artist_pct,
        splitPreset.node_pct,
        distributionMode,
        distributionAsset,
        distributionRule,
        now,
        cardName,
      );
    } else {
      db.prepare(`
        INSERT INTO salute_ceremonies (
          card_name, headline, subtitle, theme_key,
          split_preset, burn_pct, artist_pct, node_pct,
          distribution_mode, distribution_asset, distribution_rule,
          status, starts_at, ends_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(
        cardName,
        headline || 'Burn to Salute',
        subtitle || 'Voluntary community ritual · proof of appreciation',
        themeKey,
        splitPreset.key,
        splitPreset.burn_pct,
        splitPreset.artist_pct,
        splitPreset.node_pct,
        distributionMode,
        distributionAsset,
        distributionRule,
        effectiveStart,
        effectiveEnd,
        now,
        now,
      );
    }

    const ceremony = db.prepare('SELECT * FROM salute_ceremonies WHERE card_name = ?').get(cardName);
    try {
      const tokenRow = db.prepare(
        'SELECT token_name, display_title, art_url, artist_handle, artist_address FROM tokens WHERE token_name = ?'
      ).get(cardName);
      if (tokenRow) notifyCeremonyOpen(tokenRow, ceremony);
    } catch {}
    return NextResponse.json({ ok: true, ceremony });
  }

  if (action === 'close' || action === 'archive' || action === 'draft') {
    const targetStatus = action === 'archive' ? 'archived' : action;
    db.prepare(`
      UPDATE salute_ceremonies
      SET status = ?, updated_at = ?
      WHERE card_name = ?
    `).run(targetStatus, now, cardName);

    const ceremony = db.prepare('SELECT * FROM salute_ceremonies WHERE card_name = ?').get(cardName);
    if (action === 'close') {
      try {
        const tokenRow = db.prepare(
          'SELECT token_name, display_title, art_url, artist_handle, artist_address FROM tokens WHERE token_name = ?'
        ).get(cardName);
        const summary = db.prepare(`
          SELECT COALESCE(SUM(amount_display),0) AS total,
                 COUNT(DISTINCT sol_wallet)      AS burners
          FROM card_salutes WHERE card_name = ?
        `).get(cardName);
        const topRow = db.prepare(`
          SELECT sol_wallet FROM card_salutes WHERE card_name = ?
          GROUP BY sol_wallet ORDER BY SUM(amount_display) DESC LIMIT 1
        `).get(cardName);
        if (tokenRow) notifyCeremonyClose(tokenRow, {
          totalBurned: summary?.total ?? 0,
          uniqueBurners: summary?.burners ?? 0,
          topWallet: topRow?.sol_wallet || null,
        });
      } catch {}
    }
    return NextResponse.json({ ok: true, ceremony });
  }

  return NextResponse.json({ error: `unknown action: ${action}` }, { status: 422 });
}
