import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../auth/route';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDb } from '../../../../lib/db.js';
// ── Call Groq (text only, no image) ──────────────────────────────
async function callGroqText(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      temperature: 0.85,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── Parse drops from LLM response ────────────────────────────────
function parseDrops(text) {
  // Expect newline-separated lines, optionally numbered or bulleted
  return text
    .split('\n')
    .map(l => l.replace(/^[\s\-\*\d\.\)]+/, '').replace(/^["']|["']$/g, '').trim())
    .filter(l => l.length > 10 && l.length < 160);
}

// ── Build context summary from recent verdicts ────────────────────
function getRecentContext() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT token_name, status, judge_score, artist_handle
      FROM tokens
      WHERE judged_at IS NOT NULL AND is_demo = 0
      ORDER BY judged_at DESC
      LIMIT 8
    `).all();

    if (!rows.length) return 'No verdicts yet.';

    const certified = rows.filter(r => r.status === 'approved');
    const rejected  = rows.filter(r => r.status === 'rejected');

    const lines = [
      `Recent certified: ${certified.map(r => r.token_name).join(', ') || 'none'}`,
      `Recent rejected: ${rejected.map(r => r.token_name).join(', ') || 'none'}`,
      `Total recent verdicts: ${rows.length}`,
    ];
    return lines.join('\n');
  } catch {
    return 'Recent activity not available.';
  }
}

export async function POST(req) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const cfgPath  = join(process.cwd(), 'judges.config.json');
    const dropPath = join(process.cwd(), 'data', 'generated_drops.json');
    const config   = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const context  = getRecentContext();

    const judges = config.judges;
    const generated = {};

    for (const judge of judges) {
      try {
        const systemPrompt = `${config.system_prompt_header}\n\n${judge.personality_prompt}`;
        const userPrompt = `Here is recent activity on the UNATRARE Pepe Council:\n\n${context}\n\nBased on this activity and your personality, drop 3 short observations for the public feed. These are short, memetic, in-character statements — 1-2 sentences max each. Think of them as things you'd post on social media. No intro. No numbering. Just the three drops, one per line. Pure character voice.`;

        const raw = await callGroqText(systemPrompt, userPrompt);
        const drops = parseDrops(raw);
        if (drops.length >= 1) {
          generated[judge.id] = drops.slice(0, 3);
        }
      } catch (err) {
        console.warn(`[generate-drops] Failed for ${judge.id}:`, err.message);
        // skip this judge — don't fail the whole batch
      }
    }

    // Save with timestamp
    const output = {
      generated_at: Date.now(),
      drops: generated,
    };
    writeFileSync(dropPath, JSON.stringify(output, null, 2), 'utf8');

    const total = Object.values(generated).reduce((s, arr) => s + arr.length, 0);
    return NextResponse.json({
      ok: true,
      generated_at: output.generated_at,
      judges_generated: Object.keys(generated).length,
      total_drops: total,
      drops: generated,
    });
  } catch (err) {
    console.error('[generate-drops]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
