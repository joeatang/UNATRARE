import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../auth/route';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDb } from '../../../../lib/db.js';

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
    .filter(l => l.length > 10 && l.length < 500);
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
    // ── Two directories / identity ────────────────────────────────────────
    {
      topic: 'directory-distinction',
      instruction: `There are TWO distinct directories: (1) The original Rare Pepe Directory — 2016–2018, 1,774 cards, 36 series, now CLOSED, the founding legend of crypto-native art. (2) UNATRARE — the new directory, currently open, the respectful new kid that reveres the original and is building its own legacy. Say something that honors the original Rare Pepe Directory while expressing what UNATRARE is — the challenger, the admirer, the new kid who studied every card and is now building its own record. Speak with reverence for one and pride in the other. 2 posts, in your character voice, no intro.`,
      count: 2,
    },
    {
      topic: 'unatrare-identity',
      instruction: `What is UNATRARE? Not what it does — what it IS. It is not the original Rare Pepe Directory (that one is closed, 1,774 cards, done in 2018). UNATRARE is the new challenger — built by people who love the original and are building something in its spirit on Bitcoin/Counterparty today. What does it mean to build a directory in the shadow of the greatest crypto art directory ever made? What is the responsibility? What is the opportunity? 2 posts, in character.`,
      count: 2,
    },
    // ── Supply philosophy ─────────────────────────────────────────────────
    {
      topic: 'supply-as-statement',
      instruction: `Supply numbers are creative decisions. Supply 1 is a different statement than supply 10 or supply 300. HOMERPEPE (supply 1 — never to be inflated, one person holds the entire history), LORDKEK (supply 10 — inner circle only), RAREPEPE (supply 300 — democratic, accessible but still scarce). What does an artist communicate by choosing their supply number? What supply decision makes you lean in as a judge, and why? 2 posts, in character, specific.`,
      count: 2,
    },
    // ── Block language / permanence ───────────────────────────────────────
    {
      topic: 'block-as-time',
      instruction: `Bitcoin blocks are timestamps. Block 428,919 = the genesis of the original Rare Pepe Directory — September 9, 2016, UTC. Every card issued on Counterparty has a block height that committed it permanently to the ledger. Why does speaking in block heights feel different from speaking in dates? What does it mean that block 428,919 is as permanent and verifiable today as the day it was mined — that a specific moment in Pepe history is accessible in the chain data by anyone who knows where to look? Say something that makes someone feel the weight of on-chain permanence. 1-2 posts, in character.`,
      count: 2,
    },
  ];
}

// ── Per-judge config: how many posts, how terse ───────────────────
const JUDGE_OUTPUT_CONFIG = {
  prof_naka_c:    { count: 1, maxTokens: 80,  note: 'You speak in 1 short, final statement only. No explanation. Maximum 20 words.' },
  dr_m_catalogus: { count: 2, maxTokens: 280, note: 'Archival precision. Clinical observation. Reference a supply number, a series fact, or a specific on-chain finding.' },
  prof_j_looney:  { count: 2, maxTokens: 280, note: 'Builder voice. Self-deprecating. Reference something you built before they had a name for it. Dad-joke optional.' },
  dank_shawn:     { count: 2, maxTokens: 280, note: 'Cultural memory. Reference a specific Telegram era, a moment in the timeline, or a card from lore — not vibes, specifics.' },
  theo_goodman:   { count: 2, maxTokens: 280, note: 'Be witty. The joke IS the critique. Make someone actually smile — at least one line should be screenshot-worthy.' },
  dj_pepai:       { count: 2, maxTokens: 280, note: 'Maximum swag. Do not explain the reference. If they need a footnote they are not the audience. Drop it and walk away.' },
  chiguiripepe:   { count: 2, maxTokens: 280, note: "Warm, unhurried, builder's precision. South American confidence. Reference the chiguire, a CIP, or the PEPECASH yacht." },
  j_frog:         { count: 2, maxTokens: 280, note: 'Reference a specific on-chain data point — supply number, block height, or explorer finding. Let the chain data do the talking.' },
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
      // Rotation: exactly 1 random judge per run from the full council pool.
      // Cron fires hourly — one voice at a time, spread across the day.
      const pick = [...allJudges].sort(() => Math.random() - 0.5)[0];
      selectedJudges = pick ? [pick] : [allJudges[0]];
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

        // Brain scan — used for template fallback selection only
        const brainScan  = BRAIN_MAP[judge.id]?.scan?.(topic.instruction) || null;

        // Prefer brain's roleConfig.systemPrompt; fall back to judges.config.json field
        // NOTE: system_prompt_header (judging rules) is intentionally excluded here — Mode 2 (feed)
        const brainPrompt = BRAIN_MAP[judge.id]?.roleConfig?.systemPrompt || judge.personality_prompt;
        const systemPrompt = `${brainPrompt}${outputCfg.note ? `\n\nFORMAT NOTE: ${outputCfg.note}` : ''}`;
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
    // Rotation: stagger 15-30 min so one judge's posts spread through the feed.
    // Full council: tight 60s stagger — council event should cluster, not scatter across hours.
    const staggerSecs = forceAll ? 60 : 900 + Math.floor(Math.random() * 900);
    const newEntries = [];
    let entryIdx = 0;
    for (const [judgeId, texts] of Object.entries(generated)) {
      const meta = JUDGE_META[judgeId] || { name: judgeId.toUpperCase(), sigil: '○' };
      texts.forEach((text) => {
        newEntries.push({
          id:         `${nowTs}_${judgeId}_${entryIdx}`,
          judge_id:   judgeId,
          judge_name: meta.name,
          sigil:      meta.sigil,
          text,
          ts:         nowTs + entryIdx * staggerSecs,
        });
        entryIdx++;
      });
    }

    // Prepend new entries, cap at 300 total
    history = [...newEntries, ...history].slice(0, 300);
    writeFileSync(histPath, JSON.stringify({ drops: history }, null, 2), 'utf8');

    // Fire tracBridge only — Telegram/Discord receive approvals (Mode 1), not feed drops
    if (newEntries.length) {
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
