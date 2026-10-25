// The two learning tables over PostgREST, with the server's secret key. Server-only: never import from the browser.
// Writes go through Sharan's functions (issue #1225), reads select the tables. Until the migration lands PostgREST
// answers "no such table" or "no such function", which reads as NotReady.
import type { Attempt, Goals } from '../../../../learn/frontend/mastery/schema';
import { supabaseUrl } from '../../../../data/config';
import { SupabaseError } from '../../../../data/server';

/** PostgREST's codes for a table or function that isn't in its schema cache (the migration hasn't landed). */
const MISSING = ['PGRST205', 'PGRST202', '42P01'];

export class NotReady extends Error {}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY ?? '',
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
    cache: 'no-store',
  });
  if (res.ok) return res;
  const text = await res.text();
  if (MISSING.some(code => text.includes(`"${code}"`))) throw new NotReady(`${path.split('?')[0]}: ${text}`);
  throw new SupabaseError(res.status, `${path.split('?')[0]}: ${res.status} ${text}`);
}

type AttemptRow = {
  id: string;
  player_id: string;
  created_at: string;
  item_id: string;
  node_id: string;
  kind: Attempt['kind'];
  mode: Attempt['mode'];
  correct: boolean;
  cold: boolean;
  help_share: number;
  revealed: boolean;
  details: Attempt['details'];
};

const toRow = (a: Attempt, playerId: string): AttemptRow => ({
  id: a.id,
  player_id: playerId,
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
});

/** A row back in the engine's shape, still untrusted: the caller runs it through `parseAttempt`. */
const fromRow = (r: AttemptRow): unknown => ({
  id: r.id,
  learnerId: r.player_id,
  at: r.created_at,
  itemId: r.item_id,
  nodeId: r.node_id,
  kind: r.kind,
  mode: r.mode,
  correct: r.correct,
  cold: r.cold,
  helpShare: r.help_share,
  revealed: r.revealed,
  details: r.details,
});

const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

/** What `save_learning_attempt` answers (0009): `limited` is over 300 new attempts in 5 minutes for this player. */
export type SaveOutcome = 'saved' | 'duplicate' | 'conflict' | 'limited';
const OUTCOMES: readonly string[] = ['saved', 'duplicate', 'conflict', 'limited'] satisfies SaveOutcome[];

/**
 * Appends one attempt in one call, with the limit and the owner check in the database. A retry of an id this player
 * already saved is a duplicate; an id another player owns is a conflict.
 */
export async function saveAttempt(attempt: Attempt, playerId: string): Promise<SaveOutcome> {
  const res = await rest('/rest/v1/rpc/save_learning_attempt', {
    method: 'POST',
    body: JSON.stringify({ p: toRow(attempt, playerId) }),
  });
  const outcome: unknown = await res.json();
  if (typeof outcome === 'string' && OUTCOMES.includes(outcome)) return outcome as SaveOutcome;
  throw new SupabaseError(502, `save_learning_attempt: unexpected answer ${JSON.stringify(outcome)}`);
}

export async function listAttempts(playerId: string, limit: number): Promise<unknown[]> {
  const res = await rest(`/rest/v1/learning_attempts?player_id=${eq(playerId)}&order=created_at.asc&limit=${limit}`);
  return ((await res.json()) as AttemptRow[]).map(fromRow);
}

export async function readGoals(playerId: string): Promise<unknown> {
  const res = await rest(`/rest/v1/learner_goals?player_id=${eq(playerId)}&select=song_ids`);
  const rows = (await res.json()) as { song_ids: unknown }[];
  return { songIds: rows[0]?.song_ids ?? [] };
}

export async function writeGoals(playerId: string, goals: Goals): Promise<void> {
  await rest('/rest/v1/rpc/set_learner_goals', {
    method: 'POST',
    body: JSON.stringify({ p_player: playerId, p_song_ids: goals.songIds }),
  });
}
