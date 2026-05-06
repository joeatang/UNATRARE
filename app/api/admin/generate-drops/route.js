import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../auth/route';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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
      SELECT token_name, display_title, status, judge_score, artist_handle, rejection_reason, judge_notes
      FROM tokens
      WHERE judged_at IS NOT NULL AND (is_demo IS NULL OR is_demo=0)
      ORDER BY judged_at DESC
      LIMIT 10
    `).all();

    if (!rows.length) return 'No verdicts yet. The council chamber is empty.';

    const certified = rows.filter(r => r.status === 'approved');
    const rejected  = rows.filter(r => r.status === 'rejected');
    const pending   = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='pending' AND (is_demo IS NULL OR is_demo=0)").get().n;
    const totalCert = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='approved' AND (is_demo IS NULL OR is_demo=0)").get().n;

    const certLines = certified.map(r => {
      const score = r.judge_score ? ` (score: ${r.judge_score.toFixed(1)}/69)` : '';
      const by = r.artist_handle ? ` by @${r.artist_handle}` : '';
      return `  ✓ ${r.token_name}${by}${score}`;
    });

    const rejLines = rejected.map(r => {
      const score = r.judge_score ? ` (score: ${r.judge_score.toFixed(1)}/69)` : '';
      const reason = r.rejection_reason ? ` — "${r.rejection_reason.slice(0, 80)}"` : '';
      return `  ✗ ${r.token_name}${score}${reason}`;
    });

    return [
      `TOTAL CERTIFIED IN DIRECTORY: ${totalCert}`,
      `CARDS AWAITING JUDGMENT NOW: ${pending}`,
      '',
      `RECENTLY CERTIFIED (${certified.length}):`,
      ...(certLines.length ? certLines : ['  none']),
      '',
      `RECENTLY REJECTED (${rejected.length}):`,
      ...(rejLines.length ? rejLines : ['  none']),
    ].join('\n');
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
    const config   = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const context  = getRecentContext();

    const judges = config.judges;
    const generated = {};

    // Judge display meta for history entries
    const JUDGE_META = {
      prof_naka_c:    { name: 'NAKAMOJO',      sigil: '⬡' },
      prof_j_looney:  { name: 'RARELOONEY',    sigil: '◈' },
      dank_shawn:     { name: 'DANKSHAWN',      sigil: '◉' },
      dr_m_catalogus: { name: 'M.CATALOGUS',   sigil: '⬢' },
      theo_goodman:   { name: 'PROF.TG00DMAN', sigil: '◆' },
      dj_pepai:       { name: 'DJ PEPAI',       sigil: '◎' },
    };

    // Rotate prompt style so consecutive runs feel different
    const promptStyles = [
      `Here is what's been happening on UNATRARE:\n\n${context}\n\nReact to this activity in your character voice. Pick 1-2 specific things from the context to respond to — a specific card name, a score, a rejection reason, the queue count, whatever catches your eye. Be organic. You might be hyped, skeptical, philosophical, memetic, or cryptic depending on your personality. 3 posts, one per line, NO numbering, NO intro. Pure voice. 1-3 sentences each.`,

      `Here is the current state of the UNATRARE council:\n\n${context}\n\nDrop your thoughts. You can comment on art quality, the culture, what Rare Pepe means in 2026, Bitcoin's role as a canvas, the specific tokens in the list, or whatever your character would fixate on. Keep it short, punchy, memetic. 3 posts, one per line, no numbering. Raw character voice only.`,

      `UNATRARE council activity:\n\n${context}\n\nSay something. You can react to a specific token, riff on pepe culture, talk about what makes art dank or mid, compare something to classic RAREPEPE series cards, speak to artists submitting, or just drop lore. 3 posts, one per line, no numbering. Stay completely in character.`,

      `Council feed update:\n\n${context}\n\nDrop 3 feed posts in your voice. At least one should reference something specific from the context above (a token name, score, or count). The others can be broader — culture, art standards, Bitcoin permanence, what separates real from fake dank. No numbering, no intro. Pure character.`,
    ];

    const now = Math.floor(Date.now() / 1000);
    const styleIdx = Math.floor(now / 3600) % promptStyles.length; // rotates every hour

    for (const judge of judges) {
      try {
        const systemPrompt = `${config.system_prompt_header}\n\n${judge.personality_prompt}`;
        const userPrompt = promptStyles[styleIdx];

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

    // ── Append to drops_history.json (persistent, accumulating) ──────────
    const dataDir    = join(process.cwd(), 'data');
    const histPath   = join(dataDir, 'drops_history.json');
    const legacyPath = join(process.cwd(), 'data', 'generated_drops.json');

    mkdirSync(dataDir, { recursive: true });

    let history = [];
    if (existsSync(histPath)) {
      try { history = JSON.parse(readFileSync(histPath, 'utf8')).drops || []; } catch { /* start fresh */ }
    }

    const nowTs = Math.floor(Date.now() / 1000);
    const newEntries = [];
    for (const [judgeId, texts] of Object.entries(generated)) {
      const meta = JUDGE_META[judgeId] || { name: judgeId.toUpperCase(), sigil: '○' };
      texts.forEach((text, i) => {
        newEntries.push({
          id:         `${nowTs}_${judgeId}_${i}`,
          judge_id:   judgeId,
          judge_name: meta.name,
          sigil:      meta.sigil,
          text,
          ts:         nowTs,
        });
      });
    }

    // Prepend new entries, cap at 300 total
    history = [...newEntries, ...history].slice(0, 300);
    writeFileSync(histPath, JSON.stringify({ drops: history }, null, 2), 'utf8');

    // Also write legacy file so fallback paths still work
    const legacyOutput = { generated_at: Date.now(), drops: generated };
    writeFileSync(legacyPath, JSON.stringify(legacyOutput, null, 2), 'utf8');

    const total = Object.values(generated).reduce((s, arr) => s + arr.length, 0);
    return NextResponse.json({
      ok: true,
      generated_at: nowTs,
      judges_generated: Object.keys(generated).length,
      total_drops: total,
      history_count: history.length,
      drops: generated,
    });
  } catch (err) {
    console.error('[generate-drops]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
