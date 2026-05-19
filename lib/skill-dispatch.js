/**
 * Skill Dispatch — routes incoming SC-Bridge skill:call messages
 * to the correct judge brain, caches brain modules after first load.
 */

import { JUDGE_CHANNELS, MSG_SKILL_RESULT, MSG_SKILL_ERROR } from './skill-protocol.js';

// Channel → judgeId reverse map
const CHANNEL_TO_JUDGE = Object.fromEntries(
  Object.entries(JUDGE_CHANNELS).map(([id, ch]) => [ch, id])
);

// Module cache — only dynamic-import each brain once
const brainCache = new Map();

async function getBrain(judgeId) {
  if (brainCache.has(judgeId)) return brainCache.get(judgeId);
  const mod = await import(`./brains/${judgeId}/index.js`);
  const brain = mod.default || mod;
  brainCache.set(judgeId, brain);
  return brain;
}

/**
 * Handle a skill:call message arriving on a judge channel.
 *
 * @param {string} channel   — the judge channel the message arrived on
 * @param {object} payload   — { callId, text, context }
 * @param {function} reply   — async (type, data) => void  (sends back over SC-Bridge)
 */
export async function dispatchSkillCall(channel, payload, reply) {
  const judgeId = CHANNEL_TO_JUDGE[channel];
  if (!judgeId) {
    await reply(MSG_SKILL_ERROR, { error: `No judge registered for channel: ${channel}`, channel });
    return;
  }

  try {
    const brain = await getBrain(judgeId);
    const { text = '', context = {} } = payload;
    const result = brain.handleMessage(text, context);
    await reply(MSG_SKILL_RESULT, {
      callId: payload.callId,
      judgeId,
      channel,
      ...result,
    });
  } catch (err) {
    console.error(`[skill-dispatch] Error in ${judgeId}:`, err.message);
    await reply(MSG_SKILL_ERROR, {
      callId: payload.callId,
      judgeId,
      channel,
      error: err.message,
    });
  }
}

/** Warm all 8 brain caches. Call once at startup to avoid cold-load latency on first request. */
export async function warmBrainCache() {
  const results = await Promise.allSettled(
    Object.keys(JUDGE_CHANNELS).map(id => getBrain(id))
  );
  const loaded = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[skill-dispatch] Brain cache warm: ${loaded}/${Object.keys(JUDGE_CHANNELS).length} brains loaded`);
  return loaded;
}
