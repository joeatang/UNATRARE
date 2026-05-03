import { NextResponse } from 'next/server';
import { judgeToken, judgeAllPending } from '../../../lib/judge.js';

// Simple bearer-token auth — set JUDGE_SECRET in .env.local
// curl -X POST http://localhost:3007/api/judge \
//   -H "Authorization: Bearer YOUR_SECRET" \
//   -H "Content-Type: application/json" \
//   -d '{"tokenName":"YOURTOKEN"}'
//
// Omit tokenName to run all pending tokens.

function isAuthorized(request) {
  const secret = process.env.JUDGE_SECRET;
  if (!secret) return false; // refuse all if not configured
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try { body = await request.json(); } catch { /* body is optional */ }

  const { tokenName } = body;

  try {
    if (tokenName) {
      const result = await judgeToken(tokenName);
      return NextResponse.json({ ok: true, result });
    } else {
      const results = await judgeAllPending();
      return NextResponse.json({ ok: true, results });
    }
  } catch (err) {
    console.error('Judge pipeline error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
