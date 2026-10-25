// Server-only Supabase access over REST (PostgREST + Auth), with the secret key. Never import this from a
// client component: SUPABASE_SECRET_KEY must not reach the browser.
import { publishableKey, supabaseUrl } from "./config";
import type { NoteRow, SongRow, TakeRow } from "./mapping";

const secretKey = () => process.env.SUPABASE_SECRET_KEY ?? "";
export const isServerConfigured = () => Boolean(supabaseUrl && secretKey());

export class SupabaseError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function rest(path: string, init: RequestInit & { userToken?: string } = {}): Promise<Response> {
  const { userToken, ...rest } = init;
  const headers: Record<string, string> = userToken
    ? { apikey: publishableKey, Authorization: `Bearer ${userToken}` } // runs as that user: RLS applies
    : { apikey: secretKey() }; // service role: bypasses RLS, server writes only
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...headers, ...(rest.headers as Record<string, string>) },
    cache: "no-store",
  });
  if (!res.ok) throw new SupabaseError(res.status, `${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res;
}

/** The user behind a session token, or null if the token is missing, expired or forged. */
export async function userFromToken(token: string | null): Promise<{ id: string; isAnonymous: boolean } | null> {
  if (!token) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey || secretKey(), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; is_anonymous?: boolean };
  return u.id ? { id: u.id, isAnonymous: u.is_anonymous === true } : null;
}

export async function upsertSong(row: SongRow): Promise<void> {
  await rest("/rest/v1/songs?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
}

export async function ensurePlayer(id: string): Promise<void> {
  await rest("/rest/v1/players?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ id }),
  });
}

/** A player's handle, or null when unset or when they have no row yet. */
export async function readHandle(id: string): Promise<string | null> {
  const rows = (await (await rest(`/rest/v1/players?id=eq.${encodeURIComponent(id)}&select=handle`)).json()) as { handle: string | null }[];
  return rows[0]?.handle ?? null;
}

/** Sets this one player's handle (creating their row first). The table's CHECK has the last word. */
export async function writeHandle(id: string, handle: string): Promise<string> {
  await ensurePlayer(id);
  const res = await rest(`/rest/v1/players?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ handle }),
  });
  const rows = (await res.json()) as { handle: string }[];
  if (rows.length !== 1) throw new SupabaseError(500, `players: expected 1 row, updated ${rows.length}`);
  return rows[0].handle;
}

/** One transaction. A retry of the same take id changes nothing; an id owned by another player is refused. */
/** "limited": over 20 new takes in 5 minutes for this player (0008); the browser keeps the take and resends later. */
export async function saveTake(take: TakeRow, notes: NoteRow[]): Promise<"saved" | "duplicate" | "conflict" | "limited"> {
  const res = await rest("/rest/v1/rpc/save_take", { method: "POST", body: JSON.stringify({ p_take: take, p_notes: notes }) });
  return res.json();
}

/** The signed-in player's own rows only (RLS), for one song. */
export async function readProgress(userToken: string, songId: string) {
  const song = encodeURIComponent(songId);
  const [history, bars] = await Promise.all([
    rest(`/rest/v1/take_history?song_id=eq.${song}&order=created_at.asc&limit=100`, { userToken }).then((r) => r.json()),
    rest(`/rest/v1/bar_trends?song_id=eq.${song}&order=bar.asc`, { userToken }).then((r) => r.json()),
  ]);
  return { history, bars };
}

/** Moves an anonymous player's takes and coach notes to another player, in one transaction. */
export async function mergePlayer(from: string, to: string): Promise<number> {
  const res = await rest("/rest/v1/rpc/merge_player", { method: "POST", body: JSON.stringify({ p_from: from, p_to: to }) });
  return res.json();
}

/** Deletes an Auth user (admin API, secret key). Their players row cascades. */
export async function deleteAuthUser(id: string): Promise<void> {
  await rest(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Every session the signed-in player has played, newest first (RLS: their rows only), optionally for one song. */
export async function readSessions(userToken: string, songId?: string) {
  const song = songId ? `&song_id=eq.${encodeURIComponent(songId)}` : "";
  return rest(`/rest/v1/session_history?select=*&order=created_at.desc&limit=500${song}`, { userToken }).then((r) => r.json());
}

/** The signed-in player's per-hand judgments and timing, per song (RLS: their rows only). */
export async function readHandStats(userToken: string, songId?: string) {
  const song = songId ? `&song_id=eq.${encodeURIComponent(songId)}` : "";
  return rest(`/rest/v1/hand_stats?select=*${song}`, { userToken }).then((r) => r.json());
}
