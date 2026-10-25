import { colourOf, replay } from '../mastery/engine';
import type { Activity, Attempt, Colour, Curriculum, Goals, NextActivity, NextRequest, NextSession } from '../mastery/schema';

/** The learner on this device (spec Q12): one local student until accounts carry the graph. */
export const learnerId = 'local';
export const maxGoals = 3;

/** A map caption: the title up to its first colon or bracket, which carries the detail. */
export function shortTitle(title: string): string {
  const cut = title.search(/[:(]/);
  return (cut > 0 ? title.slice(0, cut) : title).trim();
}

/** Each node's colour, replayed from the student's own attempts. A node with no evidence stays unknown. */
export function paint(curriculum: Curriculum, attempts: readonly Attempt[]): ReadonlyMap<string, Colour> {
  const states = replay(curriculum, attempts);
  return new Map(curriculum.nodes.map(node => {
    const state = states.get(node.id);
    return [node.id, state ? colourOf(state) : 'unknown'];
  }));
}

export function tally(colours: ReadonlyMap<string, Colour>): Record<Colour, number> {
  const total: Record<Colour, number> = { unknown: 0, 'in-progress': 0, mastered: 0 };
  for (const colour of colours.values()) total[colour]++;
  return total;
}

/** Adds or removes a goal song; a fourth is refused, so the list never passes three. */
export function toggleGoal(songIds: readonly string[], songId: string): readonly string[] {
  if (songIds.includes(songId)) return songIds.filter(id => id !== songId);
  return songIds.length >= maxGoals ? songIds : [...songIds, songId];
}

const routes: Record<Activity, { label: string; path: string }> = {
  sandbox: { label: 'Understand', path: '/learn/understand' },
  test: { label: 'Test', path: '/learn/review/theory' },
  practice: { label: 'Practice', path: '/learn/practice' },
  playCheck: { label: 'Play check', path: '/learn/check' },
};
export const activityLabel = (activity: Activity) => routes[activity].label;
export const activityHref = (next: Pick<NextActivity, 'activity' | 'nodeId'>) => `${routes[next.activity].path}?node=${encodeURIComponent(next.nodeId)}`;

const isActivity = (value: unknown): value is Activity => typeof value === 'string' && value in routes;

/** Reads `/learn/api/next`'s answer, keeping only activities on nodes the curriculum has. Anything else is null. */
export function parseNextSession(value: unknown, curriculum: Curriculum): NextSession | null {
  if (typeof value !== 'object' || value === null) return null;
  const { activities, source } = value as Record<string, unknown>;
  if ((source !== 'model' && source !== 'fallback') || !Array.isArray(activities) || !activities.length) return null;
  const nodes = new Set(curriculum.nodes.map(node => node.id));
  const parsed: NextActivity[] = [];
  for (const item of activities) {
    if (typeof item !== 'object' || item === null) return null;
    const { nodeId, activity, keywords, reason } = item as Record<string, unknown>;
    if (typeof nodeId !== 'string' || !nodes.has(nodeId) || !isActivity(activity) || typeof reason !== 'string') return null;
    if (!Array.isArray(keywords) || !keywords.every(word => typeof word === 'string')) return null;
    parsed.push({ nodeId, activity, keywords, reason });
  }
  return { activities: parsed, source };
}

export type NextResult = { ok: true; session: NextSession } | { ok: false };

/** Asks the planner for the next session. A failed request or an unreadable answer is "not connected", never a guess. */
export async function fetchNext(fetchFn: typeof fetch, request: NextRequest, curriculum: Curriculum, signal?: AbortSignal): Promise<NextResult> {
  try {
    const response = await fetchFn('/learn/api/next', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal });
    if (!response.ok) return { ok: false };
    const session = parseNextSession(await response.json(), curriculum);
    return session ? { ok: true, session } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export const noGoals: Goals = { songIds: [] };
