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
export async function userFromToken(token: string | null): Promise<{ id: string } | null> {
  if (!token) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey || secretKey(), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string };
  return u.id ? { id: u.id } : null;
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

/** One transaction. A retry of the same take id changes nothing; an id owned by another player is refused. */
export async function saveTake(take: TakeRow, notes: NoteRow[]): Promise<"saved" | "duplicate" | "conflict"> {
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
