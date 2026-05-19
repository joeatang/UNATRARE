/**
 * Skill Protocol — channel names, registry, and message type constants
 * for UNATRARE judge P2P skill architecture.
 */

export const JUDGE_CHANNELS = {
  prof_naka_c:    'unatrare-judge-nakamojo',
  prof_j_looney:  'unatrare-judge-rarelooney',
  dank_shawn:     'unatrare-judge-dankshawn',
  dr_m_catalogus: 'unatrare-judge-catalogus',
  theo_goodman:   'unatrare-judge-tg00dman',
  dj_pepai:       'unatrare-judge-djpepai',
  chiguiripepe:   'unatrare-judge-chiguiripepe',
  j_frog:         'unatrare-judge-jfrog',
};

export const SKILL_REGISTRY = Object.entries(JUDGE_CHANNELS).map(([judgeId, channel]) => ({
  skill: `judge-${channel.replace('unatrare-judge-', '')}`,
  channel,
  judgeId,
}));

export const ALL_JUDGE_CHANNELS = Object.values(JUDGE_CHANNELS);

// Message type constants for skill call/response over SC-Bridge
export const MSG_SKILL_CALL   = 'skill:call';
export const MSG_SKILL_RESULT = 'skill:result';
export const MSG_SKILL_ERROR  = 'skill:error';
