import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { verifyAdminToken } from '../admin/auth/route';

export async function GET() {
  const db = getDb();
  const proposals = db.prepare(
    `SELECT p.*, 
       COUNT(CASE WHEN v.choice='yes'     THEN 1 END) as yes_count,
       COUNT(CASE WHEN v.choice='no'      THEN 1 END) as no_count,
       COUNT(CASE WHEN v.choice='abstain' THEN 1 END) as abstain_count,
       COUNT(v.id) as total_votes,
       SUM(CASE WHEN v.choice='yes' THEN v.weight ELSE 0 END) as yes_weight,
       SUM(CASE WHEN v.choice='no'  THEN v.weight ELSE 0 END) as no_weight
     FROM proposals p
     LEFT JOIN votes v ON v.proposal_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  ).all();

  return NextResponse.json({ ok: true, proposals });
}

// Admin-only: create a proposal
export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { title, description = '', type = 'general', closesAt } = body;

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return NextResponse.json({ error: 'title required (min 3 chars)' }, { status: 400 });
  }

  const allowedTypes = new Set(['general', 'series', 'rule']);
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: 'type must be general, series, or rule' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO proposals (title, description, type, closes_at)
     VALUES (?, ?, ?, ?)`
  ).run(
    title.trim().slice(0, 200),
    description.trim().slice(0, 2000),
    type,
    closesAt ? Number(closesAt) : null
  );

  return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
}

// Admin-only: close a proposal
export async function PATCH(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { id, status, result } = body;
  if (!id || !['active','closed','enacted'].includes(status)) {
    return NextResponse.json({ error: 'id and valid status required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `UPDATE proposals SET status=?, result=? WHERE id=?`
  ).run(status, result || '', Number(id));

  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
