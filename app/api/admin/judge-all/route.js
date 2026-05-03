import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../auth/route';
import { judgeAllPending } from '../../../../lib/judge';

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const results = await judgeAllPending();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
