import { NextResponse } from 'next/server';
import { listRails } from '../../../../lib/market/currencies.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/health
export async function GET() {
  return NextResponse.json({ ok: true, group: process.env.ARTIFACT_GROUP || 'main', rails: listRails().length });
}
