import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='burn_required'").get();
  return NextResponse.json({ burnRequired: row?.value === '1' });
}
