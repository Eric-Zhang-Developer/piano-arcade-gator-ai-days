import type { NextActivity } from '../schema';
import { type Candidate, MAX_NEW } from './candidates';
import { MAX_ACTIVITIES } from './validate';

/** The plan without the model: the top candidates by score, skipping new nodes past the third. */
export function fallbackPlan(candidates: readonly Candidate[]): NextActivity[] {
  const picked: NextActivity[] = [];
  let fresh = 0;
  for (const c of candidates) {
    if (picked.length === MAX_ACTIVITIES) break;
    if (c.isNew && fresh === MAX_NEW) continue;
    if (c.isNew) fresh++;
    picked.push({ nodeId: c.nodeId, activity: c.activity, keywords: c.keywords, reason: c.reason });
  }
  return picked;
}
