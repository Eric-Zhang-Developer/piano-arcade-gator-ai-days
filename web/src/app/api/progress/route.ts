// GET /api/progress?song=<id>: the signed-in player's take history and per-bar trends for one song.
// GET /api/progress?view=sessions[&song=<id>]: every session (take) they played, newest first, for the profile page.
// GET /api/progress?view=profile[&song=<id>]: the sessions plus per-hand judgments and timing, for the profile's panels.
// Runs as the player (their session token), so RLS returns their rows only. The coach reads the same shape.
// Any of them with &as=synthetic-042: the same for one of the 200 synthetic learners instead, signed in or not. The
// server maps the id to the learner's player and reads with the secret key; no token is needed or used.
import { isSyntheticId, syntheticLearner } from "../../../learn/frontend/mastery/sim";
import { isServerConfigured, readHandle, readHandStats, readProgress, readSessions, SupabaseError, type Reader } from "../../../data/server";

/** The learner's player, only if the loader made it: its handle says so. */
async function syntheticReader(id: string): Promise<Reader | null> {
  const playerId = syntheticLearner(id)!.playerId;
  return (await readHandle(playerId))?.startsWith("synthetic ") ? { playerId } : null;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const as = q.get("as");
  if (as !== null && !isSyntheticId(as)) return Response.json({ error: "as must be synthetic-001 to synthetic-200" }, { status: 400 });
  if (!isServerConfigured()) return Response.json({ error: "take store not configured" }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (as === null && !token) return Response.json({ error: "sign in first" }, { status: 401 });
  const song = q.get("song") ?? "";
  const view = q.get("view");
  const sessions = view === "sessions" || view === "profile";
  if ((song || !sessions) && !/^[a-z0-9-]{1,64}$/.test(song))
    return Response.json({ error: "song must be a chart id" }, { status: 400 });
  try {
    const reader = as === null ? { userToken: token! } : await syntheticReader(as);
    if (!reader) return Response.json({ error: `${as} isn't loaded` }, { status: 404 });
    if (view === "profile") {
      const [rows, hands] = await Promise.all([readSessions(reader, song || undefined), readHandStats(reader, song || undefined)]);
      return Response.json({ sessions: rows, hands });
    }
    if (sessions) return Response.json({ sessions: await readSessions(reader, song || undefined) });
    return Response.json(await readProgress(reader, song));
  } catch (e) {
    const status = e instanceof SupabaseError && e.status === 401 ? 401 : 502;
    return Response.json({ error: "couldn't read progress" }, { status });
  }
}
