import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const MAX_PUBKEY_LEN = 128;
const MAX_ADDR_LEN   = 100;

export async function POST(req) {
  try {
    const body = await req.json();
    const pubkey      = String(body.pubkey      || '').trim().toLowerCase();
    const btc_address = String(body.btc_address || '').trim();
    const xcp_address = String(body.xcp_address || '').trim();
    const tap_address = String(body.tap_address || '').trim();

    if (!pubkey || pubkey.length < 16 || pubkey.length > MAX_PUBKEY_LEN) {
      return NextResponse.json({ ok: false, error: 'Invalid pubkey' }, { status: 400 });
    }
    if (btc_address.length > MAX_ADDR_LEN || xcp_address.length > MAX_ADDR_LEN || tap_address.length > MAX_ADDR_LEN) {
      return NextResponse.json({ ok: false, error: 'Address too long' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT pubkey, is_genesis FROM nodes WHERE pubkey = ?').get(pubkey);

    if (existing) {
      db.prepare(
        'UPDATE nodes SET btc_address = ?, xcp_address = ?, tap_address = ? WHERE pubkey = ?'
      ).run(btc_address, xcp_address, tap_address, pubkey);
      return NextResponse.json({ ok: true, is_genesis: !!existing.is_genesis });
    }

    const { n } = db.prepare('SELECT COUNT(*) as n FROM nodes').get();
    const is_genesis = n < 100 ? 1 : 0;

    db.prepare(
      'INSERT INTO nodes (pubkey, btc_address, xcp_address, tap_address, registered_at, is_genesis) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(pubkey, btc_address, xcp_address, tap_address, Date.now(), is_genesis);

    console.log(`[nodes/register] New node: ${pubkey.slice(0, 8)}... genesis=${!!is_genesis}`);
    return NextResponse.json({ ok: true, is_genesis: !!is_genesis });

  } catch (err) {
    console.error('[api/nodes/register]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Registration failed' }, { status: 500 });
  }
}
