import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export async function GET() {
  const db    = getDb();
  const { n } = db.prepare('SELECT COUNT(*) as n FROM tg_registrations').get();
  return NextResponse.json({ count: n });
}
