import type { Attempt, Goals, PlayingMeasures } from '../schema';

/**
 * One row of `public.learning_attempts` (migrations 0009 and 0010), less `id` and `player_id`, which the loader
 * fills. `details` carries `synthetic: true`, so a stored row always says it came from the simulation.
 */
export type LearningAttemptRow = {
  created_at: string;
  item_id: string;
  node_id: string;
  kind: 'theory' | 'playing';
  mode: 'diagnostic' | 'activity';
  correct: boolean;
  cold: boolean;
  help_share: number;
  revealed: boolean;
  details: ({ choiceId: string } | PlayingMeasures) & { synthetic: true };
};

/** The learner's attempts as `learning_attempts` rows, oldest first. Pure: nothing is written anywhere. */
export function toLearningAttemptRows(_learner: { id: string }, attempts: readonly Attempt[]): LearningAttemptRow[] {
  return [...attempts]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map(a => ({
      created_at: a.at,
      item_id: a.itemId,
      node_id: a.nodeId,
      kind: a.kind,
      mode: a.mode,
      correct: a.correct,
      cold: a.cold,
      help_share: a.helpShare,
      revealed: a.revealed,
      details: { ...a.details, synthetic: true },
    }));
}

/** The learner's goal songs as a `learner_goals` row, less `player_id`: at most three real song ids. */
export function toLearnerGoalsRow(learner: { goals: Goals }): { song_ids: string[] } {
  return { song_ids: learner.goals.songIds.slice(0, 3) };
}
