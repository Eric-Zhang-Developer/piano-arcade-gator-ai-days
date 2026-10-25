import type { Attempt, PlayingMeasures } from '../schema';

/** One row of `public.learning_attempts` (migrations 0009 and 0010), column for column. */
export type LearningAttemptRow = {
  id: string;
  player_id: string;
  created_at: string;
  item_id: string;
  node_id: string;
  kind: 'theory' | 'playing';
  mode: 'diagnostic' | 'activity';
  correct: boolean;
  cold: boolean;
  help_share: number;
  revealed: boolean;
  details: { choiceId: string } | PlayingMeasures;
};

/** The learner's attempts as `learning_attempts` rows under its stable player id. Pure: nothing is written anywhere. */
export function toLearningAttemptRows(learner: { playerId: string }, attempts: readonly Attempt[]): LearningAttemptRow[] {
  return attempts.map(a => ({
    id: a.id,
    player_id: learner.playerId,
    created_at: a.at,
    item_id: a.itemId,
    node_id: a.nodeId,
    kind: a.kind,
    mode: a.mode,
    correct: a.correct,
    cold: a.cold,
    help_share: a.helpShare,
    revealed: a.revealed,
    details: a.details,
  }));
}
