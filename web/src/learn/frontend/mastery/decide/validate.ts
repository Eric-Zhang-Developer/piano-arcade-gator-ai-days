import type { NextActivity } from '../schema';
import { type Candidate, MAX_NEW } from './candidates';

export const MIN_ACTIVITIES = 3;
export const MAX_ACTIVITIES = 5;
const MAX_KEYWORDS = 4;
const MAX_REASON = 400;

export type Checked = { ok: true; activities: NextActivity[] } | { ok: false; why: string };

/** The JSON object in the reply, allowing a code fence or a stray line around it. */
function parseReply(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * The model's plan, checked against the graph: every node from the candidates and each once, 3-5 of them (fewer
 * only when there are fewer candidates), at most three new, keywords that are graph node ids, and a reason. The
 * activity always comes from the node's quadrant, never from the model.
 */
export function validatePlan(text: string, candidates: readonly Candidate[], graphIds: ReadonlySet<string>): Checked {
  const reply = parseReply(text);
  const list = (reply as { activities?: unknown } | null)?.activities;
  if (!Array.isArray(list)) return { ok: false, why: 'no activities list' };
  const min = Math.min(MIN_ACTIVITIES, candidates.length);
  const max = Math.min(MAX_ACTIVITIES, candidates.length);
  if (list.length < min || list.length > max) return { ok: false, why: `${list.length} activities, wanted ${min}-${max}` };

  const byId = new Map(candidates.map(c => [c.nodeId, c]));
  const seen = new Set<string>();
  const activities: NextActivity[] = [];
  let fresh = 0;
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) return { ok: false, why: 'an activity is not an object' };
    const { nodeId, keywords, reason } = entry as Record<string, unknown>;
    const candidate = typeof nodeId === 'string' ? byId.get(nodeId) : undefined;
    if (!candidate) return { ok: false, why: `off-list node ${String(nodeId)}` };
    if (seen.has(candidate.nodeId)) return { ok: false, why: `${candidate.nodeId} twice` };
    seen.add(candidate.nodeId);
    if (candidate.isNew && ++fresh > MAX_NEW) return { ok: false, why: `more than ${MAX_NEW} new nodes` };
    if (
      !Array.isArray(keywords) ||
      keywords.length === 0 ||
      keywords.length > MAX_KEYWORDS ||
      !keywords.every(k => typeof k === 'string' && graphIds.has(k))
    )
      return { ok: false, why: `keywords for ${candidate.nodeId} are not graph nodes` };
    if (typeof reason !== 'string' || !reason.trim() || reason.length > MAX_REASON)
      return { ok: false, why: `no usable reason for ${candidate.nodeId}` };
    activities.push({
      nodeId: candidate.nodeId,
      activity: candidate.activity,
      keywords: [...new Set(keywords as string[])],
      reason: reason.trim(),
    });
  }
  return { ok: true, activities };
}
