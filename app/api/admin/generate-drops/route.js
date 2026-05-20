import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../auth/route';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDb } from '../../../../lib/db.js';
import { notifyDropsGenerated } from '../../../../lib/telegram.js';
import { broadcastCouncilDrops } from '../../../../lib/tracBridge.js';

// ── Judge brain modules (deterministic scan + template fallback) ──
import nakamojo   from '../../../../lib/brains/prof_naka_c/index.js';
import rarelooney from '../../../../lib/brains/prof_j_looney/index.js';
import dankshawn  from '../../../../lib/brains/dank_shawn/index.js';
import catalogus  from '../../../../lib/brains/dr_m_catalogus/index.js';
import tg00dman   from '../../../../lib/brains/theo_goodman/index.js';
import djpepai    from '../../../../lib/brains/dj_pepai/index.js';
import chiguiri   from '../../../../lib/brains/chiguiripepe/index.js';
import jfrog      from '../../../../lib/brains/j_frog/index.js';

const BRAIN_MAP = {
  prof_naka_c:    nakamojo,
  prof_j_looney:  rarelooney,
  dank_shawn:     dankshawn,
  dr_m_catalogus: catalogus,
  theo_goodman:   tg00dman,
  dj_pepai:       djpepai,
  chiguiripepe:   chiguiri,
  j_frog:         jfrog,
};

/**
 * Run deterministic keyword scan on topic text, return a context string
 * to append to the system prompt. Empty string if no signal.
 */
function getBrainEnrichment(judgeId, text) {
  const brain = BRAIN_MAP[judgeId];
  if (!brain) return '';
  try {
    const result = brain.scan(text);
    if (!result.keywords?.length) return '';
    return `\n\n[ACTIVE SIGNAL — angle: ${result.angle}, keywords: ${result.keywords.slice(0, 5).join(', ')}]`;
  } catch { return ''; }
}

/**
 * Generate a template-based fallback drop when Groq is unavailable.
 * Returns null if no brain or template available.
 */
function getBrainFallback(judgeId, scanResult) {
  const brain = BRAIN_MAP[judgeId];
  if (!brain) return null;
  try { return brain.fulfill('', scanResult || {}); } catch { return null; }
}

// ── Call Groq (text only, no image) ──────────────────────────────
async function callGroqText(systemPrompt, userPrompt, maxTokens = 300) {
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
      max_tokens: maxTokens,
      temperature: 0.9,
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
  return text
    .split('\n')
    .map(l => l.replace(/^[\s\-\*\d\.\)]+/, '').replace(/^["']|["']$/g, '').trim())
    .filter(l => l.length > 10 && l.length < 220);
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

// ── Pick other judge names for cross-judge callout prompts ────────
function otherJudgeNames(currentId, allJudges, meta) {
  return allJudges
    .filter(j => j.id !== currentId)
    .map(j => meta[j.id]?.name || j.display_name)
    .join(', ');
}

// ── Topic buckets — wide pool, randomized per judge per run ───────
// Each entry: { topic, instruction, count } (count = how many posts to request)
function buildTopicPool(context, allJudgeNames) {
  return [
    // ── React to verdicts (grounded in actual context) ────────────
    {
      topic: 'verdict-reaction',
      instruction: `Here is what's been happening on UNATRARE:\n\n${context}\n\nReact to something specific in the context above — a token name, a score, a rejection reason, or the queue count. Pick one thing and say something real about it. Stay completely in character. Don't narrate — just speak.`,
      count: 2,
    },
    {
      topic: 'score-commentary',
      instruction: `Here is the current state of the UNATRARE council:\n\n${context}\n\nComment on the scoring. What does it mean when a card barely makes it vs. clears the bar easily? What does a 60+ score feel like vs. a 38? Speak from your role on the panel. 2 posts, no numbering.`,
      count: 2,
    },
    // ── Culture & philosophy ──────────────────────────────────────
    {
      topic: 'dankness-philosophy',
      instruction: `Speak about dankness. Not as a joke — as a real quality. What actually makes something dank? What makes something try to be dank and fail? What is the difference between a card that earns its place on Bitcoin versus one that just exists? 2 posts, no numbering, stay in character.`,
      count: 2,
    },
    {
      topic: 'rare-pepe-history',
      instruction: `Riff on the legacy of Rare Pepe. What does it mean to carry that lineage into 2026? What did the original directory get right? What has been lost? What has survived? 2 posts, raw character voice, no intro.`,
      count: 2,
    },
    {
      topic: 'bitcoin-as-canvas',
      instruction: `Drop your thoughts on Bitcoin as a permanent canvas for art. Not the price — the permanence. What does it mean to put something on a ledger that cannot be changed? How does that change what's worth submitting? 2 posts, in character, no numbering.`,
      count: 2,
    },
    {
      topic: 'what-pepe-means',
      instruction: `What does pepe mean to you — not the meme, but the symbol? Why has it persisted? Why does it keep showing up in the most serious places? Say something genuine about it in your character voice. 2 posts, no framing, just speak.`,
      count: 2,
    },
    // ── Speaking to artists / community ──────────────────────────
    {
      topic: 'advice-to-artists',
      instruction: `Address the artists submitting to UNATRARE. What do you want them to know? What do most submissions get wrong? What are you actually looking for? Speak directly to them in your character voice. 2 posts, no intro.`,
      count: 2,
    },
    {
      topic: 'what-gets-rejected',
      instruction: `Talk about what gets rejected and why. Not a specific card — the patterns. What is the most common reason something doesn't make it? What is the most avoidable mistake? Speak as someone who has seen a lot of submissions. 2 posts, in character.`,
      count: 2,
    },
    // ── Cross-judge / council dynamics ───────────────────────────
    {
      topic: 'council-dynamics',
      instruction: `Drop something about how the council works — the dynamic between scientists who see things differently. You don't have to name names, but you can reference that others on the panel weigh things differently than you do. What's your take on that tension? 2 posts, in character.`,
      count: 2,
    },
    {
      topic: 'judge-callout',
      instruction: `The other scientists on the council include: ${allJudgeNames}. Reference one of them by name — agree with their approach, push back on it, or just acknowledge their angle. Stay in character. 1 post, no intro.`,
      count: 1,
    },
    // ── State of the directory ────────────────────────────────────
    {
      topic: 'directory-lore',
      instruction: `Here is the current state of the UNATRARE council:\n\n${context}\n\nSay something about the directory itself — what it is, what it's becoming, what it means that these cards exist on Bitcoin permanently. No hype, no sales pitch. Just your honest read on where this is heading. 2 posts, in character.`,
      count: 2,
    },
    {
      topic: 'counterparty-context',
      instruction: `Talk about Counterparty — the protocol that makes this possible. Most people don't know what it is. How do you explain what it means to issue a token on Bitcoin? What does Counterparty represent in the larger story of crypto art? 2 posts, in character.`,
      count: 2,
    },
    // ── Looser / voice-forward ────────────────────────────────────
    {
      topic: 'council-ambient',
      instruction: `Just speak. Whatever your character would say right now — in this moment, in this council chamber, watching art come in and get judged. No specific prompt, no required topic. 2 posts, pure character, no intro.`,
      count: 2,
    },
    {
      topic: 'on-imitation',
      instruction: `Talk about imitation versus inspiration in art. What is the difference between a card that is clearly influenced by something and one that is just copying it? How do you tell? 2 posts, in character.`,
      count: 2,
    },
    {
      topic: 'legendary-cards',
      instruction: `Reference a specific legendary card from Rare Pepe history — HOMERPEPE (Series 2, Card 32, 1 issued, sold at Christie's), LORDKEK (Series 1, Card 34, 10 issued), RAREPEPE (Series 1, Card 1, 300 issued, the Nakamoto Card), DJPEPE (Series 4, Card 29, 169 issued, first audio-visual tokenized asset), or UFOPEPE (Series 1, Card 37, first tokenized gif). Say something genuine about it from your character's perspective. 1-2 posts, no intro, no summary.`,
      count: 2,
    },
    {
      topic: 'the-yacht',
      instruction: `Someone bought a yacht with PEPECASH. The yacht is named SS Rare Pepe. They still live on it. Say something about this from your character's perspective. 1 post, pure character voice, no setup, no explanation.`,
      count: 1,
    },
    {
      topic: 'era-contrast',
      instruction: `Talk about what changed between the 2016 era of Rare Pepe (Series 1-9) and the later eras (Series 10+). What did the culture gain? What shifted when the price action arrived? What survived? 2 posts, in character, specific.`,
      count: 2,
    },
    {
      topic: 'telegram-dispatch',
      instruction: `Speak like you are in a Telegram channel right now. Not a formal verdict, not a lecture — just what you would actually type to the group. A take. An observation. Something that makes the person reading it feel like they are in the room with you. 2 posts, no framing, pure voice.`,
      count: 2,
    },
  ];
}

// ── Per-judge config: how many posts, how terse ───────────────────
const JUDGE_OUTPUT_CONFIG = {
  prof_naka_c:    { count: 1, maxTokens: 80,  note: 'You speak in 1 short, final statement only. No explanation. Maximum 20 words.' },
  dr_m_catalogus: { count: 2, maxTokens: 280, note: 'Be precise and direct. No fluff.' },
  prof_j_looney:  { count: 2, maxTokens: 280, note: 'Be sharp and market-minded.' },
  dank_shawn:     { count: 2, maxTokens: 280, note: 'Be casual and community-grounded.' },
  rare_srilla:    { count: 2, maxTokens: 280, note: 'Be gut-instinct and decisive.' },
  theo_goodman:   { count: 2, maxTokens: 280, note: 'Be sharp and Bitcoin-minded.' },
  dj_pepai:       { count: 2, maxTokens: 280, note: 'Be culturally aware and energetic.' },
  chiguiripepe:   { count: 2, maxTokens: 280, note: 'Be cryptic and poetic.' },
  j_frog:         { count: 2, maxTokens: 280, note: 'Be technical and builder-focused.' },
};

export async function POST(req) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Parse optional body params (allow empty/non-JSON body safely)
  let bodyParams = {};
  try { bodyParams = await req.json(); } catch { /* no body */ }
  const forceAll = bodyParams.force_all === true;

  try {
    const cfgPath  = join(process.cwd(), 'judges.config.json');
    const config   = JSON.parse(readFileSync(cfgPath, 'utf8'));
    const context  = getRecentContext();

    const allJudges = config.judges;
    const generated = {};

    // Judge display meta for history entries
    const JUDGE_META = {
      prof_naka_c:    { name: 'NAKAMOJO',       sigil: '⬡' },
      prof_j_looney:  { name: 'RARELOONEY',     sigil: '◈' },
      dank_shawn:     { name: 'DANKSHAWN',       sigil: '◉' },
      dr_m_catalogus: { name: 'M.CATALOGUS',    sigil: '⬢' },
      theo_goodman:   { name: 'PROF.TG00DMAN',  sigil: '◆' },
      dj_pepai:       { name: 'DJ PEPAI',        sigil: '◎' },
      chiguiripepe:   { name: 'CHIGUIRIPEPE',    sigil: '⬟' },
      j_frog:         { name: 'J.FROG',          sigil: '◧' },
      rare_srilla:    { name: 'RARE SRILLA',     sigil: '◇' },
    };

    // ── Select judges for this run ────────────────────────────────
    const NAKA_ID = 'prof_naka_c';
    let selectedJudges;

    if (forceAll) {
      // Full council mode: all 8 judges fire, NAKAMOJO last (the final word)
      const nakaJudge = allJudges.find(j => j.id === NAKA_ID);
      const rest = allJudges.filter(j => j.id !== NAKA_ID).sort(() => Math.random() - 0.5);
      selectedJudges = nakaJudge ? [...rest, nakaJudge] : rest;
    } else {
      // Normal rotation: 1-2 random judges, NAKAMOJO at ~25%
      const nakaJudge = allJudges.find(j => j.id === NAKA_ID);
      const otherJudges = allJudges.filter(j => j.id !== NAKA_ID);
      const shuffled = [...otherJudges].sort(() => Math.random() - 0.5);
      const pickCount = Math.random() < 0.3 ? 1 : 2;
      selectedJudges = shuffled.slice(0, Math.min(pickCount, shuffled.length));
      if (nakaJudge && Math.random() < 0.25) selectedJudges.push(nakaJudge);
      if (!selectedJudges.length && allJudges.length) selectedJudges.push(allJudges[0]);
    }

    // ── Build topic pool ──────────────────────────────────────────
    const allJudgeNamesStr = allJudges
      .map(j => JUDGE_META[j.id]?.name || j.display_name)
      .join(', ');
    const topicPool = buildTopicPool(context, allJudgeNamesStr);

    // In full-council mode, each judge gets a different topic from the pool
    // so the 8 posts don't all hit the same angle.
    const usedTopicIndices = new Set();
    const pickUniqueTopic = () => {
      if (usedTopicIndices.size >= topicPool.length) {
        usedTopicIndices.clear();
      }
      let idx;
      do { idx = Math.floor(Math.random() * topicPool.length); } while (usedTopicIndices.has(idx));
      usedTopicIndices.add(idx);
      return topicPool[idx];
    };

    // Sequential with delay — stay within Groq free tier rate limits
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < selectedJudges.length; i++) {
      const judge = selectedJudges[i];
      if (i > 0) await sleep(1800);

      try {
        const outputCfg = JUDGE_OUTPUT_CONFIG[judge.id] || { count: 2, maxTokens: 280, note: '' };

        // Each judge gets a topic — unique across the run in full-council mode
        const topic = forceAll ? pickUniqueTopic() : topicPool[Math.floor(Math.random() * topicPool.length)];
        const postCount = judge.id === NAKA_ID ? 1 : topic.count;
        const countWord = postCount === 1 ? '1 post' : `${postCount} posts`;

        // Brain scan — deterministic enrichment before LLM call
        const brainScan  = BRAIN_MAP[judge.id]?.scan?.(topic.instruction) || null;
        const brainCtx   = getBrainEnrichment(judge.id, topic.instruction);

        // Prefer brain's roleConfig.systemPrompt; fall back to judges.config.json field
        const brainPrompt = BRAIN_MAP[judge.id]?.roleConfig?.systemPrompt || judge.personality_prompt;
        const systemPrompt = `${config.system_prompt_header}\n\n${brainPrompt}${brainCtx}${outputCfg.note ? `\n\nFORMAT NOTE: ${outputCfg.note}` : ''}`;
        const userPrompt = `${topic.instruction}\n\nOutput exactly ${countWord}, one per line, no numbering, no intro, no sign-off. Pure character voice only.`;

        let drops = [];
        try {
          const raw = await callGroqText(systemPrompt, userPrompt, outputCfg.maxTokens);
          drops = parseDrops(raw);
        } catch (groqErr) {
          console.warn(`[generate-drops] Groq failed for ${judge.id}:`, groqErr.message);
          // Template fallback — deterministic voice when LLM is unavailable
          const fallback = getBrainFallback(judge.id, brainScan);
          if (fallback) drops = [fallback];
        }

        if (drops.length >= 1) {
          generated[judge.id] = drops.slice(0, postCount);
        }
      } catch (err) {
        console.warn(`[generate-drops] Failed for ${judge.id}:`, err.message);
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

    // Fire Telegram — fire-and-forget, never blocks the response
    if (newEntries.length) {
      notifyDropsGenerated(newEntries).catch(e => console.warn('[telegram] drops:', e.message));
      broadcastCouncilDrops(newEntries).catch(e => console.warn('[tracBridge] council drops:', e.message));
    }

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
      mode: forceAll ? 'full_council' : 'rotation',
      drops: generated,
    });
  } catch (err) {
    console.error('[generate-drops]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
