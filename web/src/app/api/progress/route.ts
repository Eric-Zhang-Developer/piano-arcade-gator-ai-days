// GET /api/progress?song=<id>: the signed-in player's take history and per-bar trends for one song.
// Runs as the player (their session token), so RLS returns their rows only. The coach reads the same shape.
import { isServerConfigured, readProgress, SupabaseError } from "../../../data/server";

export async function GET(request: Request) {
  if (!isServerConfigured()) return Response.json({ error: "take store not configured" }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return Response.json({ error: "sign in first" }, { status: 401 });
  const song = new URL(request.url).searchParams.get("song") ?? "";
  if (!/^[a-z0-9-]{1,64}$/.test(song)) return Response.json({ error: "song must be a chart id" }, { status: 400 });
  try {
    return Response.json(await readProgress(token, song));
  } catch (e) {
    const status = e instanceof SupabaseError && e.status === 401 ? 401 : 502;
    return Response.json({ error: "couldn't read progress" }, { status });
  }
}
