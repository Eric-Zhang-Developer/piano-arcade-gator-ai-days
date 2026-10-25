import type { Attempt, Goals } from '../schema';

/** The server route that keeps attempts and goals in Supabase. The browser only ever talks to it, never to Supabase. */
export const ATTEMPTS_ROUTE = '/learn/api/attempts';

export const ATTEMPT_LIMITS = {
  /** A `learning_attempts.id` is a uuid, so an attempt id must be one too. */
  id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  shortId: /^[a-z0-9][a-z0-9-]{0,127}$/,
  detailsBytes: 8 * 1024,
  goalSongs: 3,
  /** The most attempts one GET returns, oldest first. */
  listed: 5000,
  bodyBytes: 16 * 1024,
} as const;

/** `POST` saves one attempt or replaces the goals; `GET` returns both for the signed-in player. */
export type AttemptsRequest = { attempt: Attempt } | { goals: Goals };

/**
 * `not-configured`: this deploy has no Supabase server key. `not-ready`: the tables (issue #753) don't exist yet.
 * `limited` (429): over the database's save limit for this player. The device store keeps everything, and sends what
 * the server hasn't seen the next time it reads, so nothing is lost.
 */
export type AttemptsResponse =
  | { status: 'ok'; attempts: Attempt[]; goals: Goals }
  | { status: 'saved' }
  | { status: 'not-configured' }
  | { status: 'not-ready' }
  | { status: 'limited' }
  | { status: 'error'; message: string };
