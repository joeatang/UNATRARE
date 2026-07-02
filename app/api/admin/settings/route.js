import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import { FEATURES, allFeatureStates } from '../../../../lib/features';

const ALLOWED_KEYS = ['early_access_mode'];
// Reward-economy feature flags are toggled through this same endpoint. Only the
// keys derived from the FEATURES registry are writable, and only as '0'/'1'.
const FEATURE_KEYS = Object.keys(FEATURES).map((n) => `feature:${n}`);

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return NextResponse.json({ ok: true, settings, features: allFeatureStates() });
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { key, value } = body || {};
  const isFeature = FEATURE_KEYS.includes(key);
  if (!key || !(ALLOWED_KEYS.includes(key) || isFeature)) {
    return NextResponse.json({ error: 'invalid key' }, { status: 400 });
  }
  if (value === undefined || value === null) {
    return NextResponse.json({ error: 'value required' }, { status: 400 });
  }
  if (isFeature && !['0', '1'].includes(String(value))) {
    return NextResponse.json({ error: 'feature flags must be "0" or "1"' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  return NextResponse.json({ ok: true, key, value: String(value) });
}
