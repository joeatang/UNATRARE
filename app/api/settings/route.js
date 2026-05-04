import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

// Public — returns non-sensitive settings the client needs
export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='early_access_mode'").get();
  return NextResponse.json({
    ok: true,
    earlyAccessMode: row?.value === '1',
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
