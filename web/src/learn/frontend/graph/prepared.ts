import { activities, type ActivityId } from '../LearningSessions';
import { actionFor, byId, demoGoal, recommendation, type GraphAction, type Domain } from './data';

const connectedSkills = new Set(['theory.tonal-center', 'theory.phrase-endings', 'procedure.steady-pulse', 'procedure.held-endings', 'procedure.short-phrase-coordination']);

export function contextualActivity(action: GraphAction) {
  const skill = byId.get(action.skillId);
  const eligible = skill && actionFor(skill).action;
  if (!connectedSkills.has(action.skillId) || !skill?.activity || eligible?.domain !== action.domain || eligible?.intent !== action.intent) return null;
  const group: 'Learn' | 'Review' = action.intent === 'learn' ? 'Learn' : 'Review';
  const title = action.domain === 'theory' ? 'Theory' : 'Practice';
  const activity = activities.find(item => item.group === group && item.title === title)!;
  return { activity };
}

// An authored prepared example, not a cross-domain ranking or a connected agent.
// Reading another map never changes this assignment.
const candidate = recommendation('theory')!;
export type PreparedActivity = { skillId: string; domain: Domain; action: GraphAction; activityId: ActivityId; title: string; reason: string };
export const preparedActivity: PreparedActivity = {
  skillId: candidate.id,
  domain: candidate.domain,
  action: actionFor(candidate).action!,
  activityId: 'learn-theory' as ActivityId,
  title: 'Hearing a phrase come home',
  reason: 'Hear how phrase endings help a melody feel settled.',
} as const;

// After the first example, the goal's other targets in the goal's own order, each with its connected activity (#943):
// finishing one never leaves the map with "Start again" as its only button. Titles and reasons come from the skill.
export const goalActivities: PreparedActivity[] = [
  preparedActivity,
  ...demoGoal.targets.flatMap(id => {
    const skill = byId.get(id)!, action = actionFor(skill).action, target = action && contextualActivity(action);
    if (!target || id === preparedActivity.skillId) return [];
    return [{ skillId: id, domain: skill.domain, action: action!, activityId: target.activity.id as ActivityId, title: skill.title, reason: skill.description }];
  }),
];
