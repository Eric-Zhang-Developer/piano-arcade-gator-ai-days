// GET /api/progress?song=<id>: the signed-in player's take history and per-bar trends for one song.
// GET /api/progress?view=sessions[&song=<id>]: every session (take) they played, newest first, for the profile page.
// Runs as the player (their session token), so RLS returns their rows only. The coach reads the same shape.
import { isServerConfigured, readProgress, readSessions, SupabaseError } from "../../../data/server";

export async function GET(request: Request) {
  if (!isServerConfigured()) return Response.json({ error: "take store not configured" }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return Response.json({ error: "sign in first" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const song = q.get("song") ?? "";
  const sessions = q.get("view") === "sessions";
  if ((song || !sessions) && !/^[a-z0-9-]{1,64}$/.test(song))
    return Response.json({ error: "song must be a chart id" }, { status: 400 });
  try {
    if (sessions) return Response.json({ sessions: await readSessions(token, song || undefined) });
    return Response.json(await readProgress(token, song));
  } catch (e) {
    const status = e instanceof SupabaseError && e.status === 401 ? 401 : 502;
    return Response.json({ error: "couldn't read progress" }, { status });
  }
}
