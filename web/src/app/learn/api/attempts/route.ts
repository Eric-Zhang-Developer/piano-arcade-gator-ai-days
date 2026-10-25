// GET and POST /learn/api/attempts: the signed-in player's learning attempts and goal songs, kept in Supabase with
// the server's secret key. The browser never writes Supabase itself. Without the key the route answers 503
// not-configured; before the tables exist (issue #753), 503 not-ready. The device store keeps everything either way.
import { ensurePlayer, isServerConfigured, SupabaseError, userFromToken } from '../../../../data/server';
import { parseAttempt } from '../../../../learn/frontend/mastery/engine';
import {
  ATTEMPT_LIMITS as LIMITS,
  type AttemptsResponse,
} from '../../../../learn/frontend/mastery/remote/protocol';
import type { Attempt, Goals } from '../../../../learn/frontend/mastery/schema';
import { insertAttempt, listAttempts, NotReady, readGoals, writeGoals } from './supabase';

const FUTURE_SLACK_MS = 5 * 60_000; // a device clock a little ahead is fine; an attempt from next week isn't

const send = (body: AttemptsResponse, status = 200) => Response.json(body, { status });
const failure = (status: number, message: string) => send({ status: 'error', message }, status);

function parseGoals(value: unknown): Goals | null {
  if (typeof value !== 'object' || value === null) return null;
  const { songIds } = value as Record<string, unknown>;
  if (!Array.isArray(songIds) || songIds.length > LIMITS.goalSongs) return null;
  if (!songIds.every(s => typeof s === 'string' && LIMITS.shortId.test(s))) return null;
  return new Set(songIds).size === songIds.length ? { songIds } : null;
}

/** Why an attempt is refused, or null when it may be stored. Its owner comes from the session, never the body. */
function problemWith(a: Attempt): string | null {
  if (!LIMITS.id.test(a.id)) return 'attempt id must be a UUID';
  if (!LIMITS.shortId.test(a.itemId) || !LIMITS.shortId.test(a.nodeId)) return 'bad itemId or nodeId';
  if (Date.parse(a.at) > Date.now() + FUTURE_SLACK_MS) return 'attempt is from the future';
  if (JSON.stringify(a.details).length > LIMITS.detailsBytes) return 'attempt details too large';
  return null;
}

/** The player behind the request, or the response to send instead. */
async function player(request: Request): Promise<string | Response> {
  if (!isServerConfigured()) return send({ status: 'not-configured' }, 503);
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '') ?? null;
  const user = await userFromToken(token);
  return user ? user.id : failure(401, 'sign in first');
}

function storeFailure(e: unknown, what: string): Response {
  if (e instanceof NotReady) return send({ status: 'not-ready' }, 503);
  console.error(`learning store ${what} failed`, e);
  // A 4xx from the database means its CHECKs refused a row this route let through: keep it on the device.
  if (e instanceof SupabaseError && e.status < 500) return failure(424, 'the database refused this; kept on the device');
  return failure(502, `${what} failed`);
}

export async function GET(request: Request) {
  const playerId = await player(request);
  if (typeof playerId !== 'string') return playerId;
  try {
    const [rows, goals] = await Promise.all([listAttempts(playerId, LIMITS.listed), readGoals(playerId)]);
    const attempts = rows.map(parseAttempt).filter((a): a is Attempt => a !== null);
    return send({ status: 'ok', attempts, goals: parseGoals(goals) ?? { songIds: [] } });
  } catch (e) {
    return storeFailure(e, 'read');
  }
}

export async function POST(request: Request) {
  const playerId = await player(request);
  if (typeof playerId !== 'string') return playerId;

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > LIMITS.bodyBytes) return failure(413, 'request too large');
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return failure(400, 'body must be an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return failure(400, 'body is not JSON');
  }

  if ('goals' in body) {
    const goals = parseGoals(body.goals);
    if (!goals) return failure(400, `goals must be at most ${LIMITS.goalSongs} distinct song ids`);
    try {
      await ensurePlayer(playerId);
      await writeGoals(playerId, goals);
    } catch (e) {
      return storeFailure(e, 'save');
    }
    return send({ status: 'saved' });
  }

  const parsed = parseAttempt(body.attempt);
  if (!parsed) return failure(400, 'invalid attempt');
  const attempt = { ...parsed, learnerId: playerId };
  const problem = problemWith(attempt);
  if (problem) return failure(400, problem);
  let outcome: Awaited<ReturnType<typeof insertAttempt>>;
  try {
    await ensurePlayer(playerId);
    outcome = await insertAttempt(attempt, playerId);
  } catch (e) {
    return storeFailure(e, 'save');
  }
  if (outcome === 'conflict') return failure(409, 'that attempt id belongs to someone else');
  return send({ status: 'saved' }, 201);
}
