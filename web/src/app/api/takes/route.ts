// POST /api/takes { id, take }: re-judge the take with the game's own judging, then save it.
// Scores sent by the browser are never trusted; the stored numbers are the ones computed here.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateChart, validateTake, type Chart, type Take } from "../../../contracts";
import { judgeTake } from "../../../game/core/judge";
import { songRow, takeRows } from "../../../data/mapping";
import { ensurePlayer, isServerConfigured, saveTake, SupabaseError, upsertSong, userFromToken } from "../../../data/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SONG_ID = /^[a-z0-9-]{1,64}$/;
const MAX_EVENTS = 5000;
const MAX_BODY_BYTES = 512 * 1024;

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if (!isServerConfigured()) return fail(503, "take store not configured");
  const user = await userFromToken(request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? null);
  if (!user) return fail(401, "sign in first");

  let body: { id?: unknown; take?: unknown };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, "take too large");
    body = JSON.parse(text);
  } catch {
    return fail(400, "body is not JSON");
  }
  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!id) return fail(400, "id must be a UUID");
  const problems = validateTake(body.take);
  if (problems.length) return fail(400, `invalid take: ${problems.slice(0, 5).join("; ")}`);
  // Keep only the contract's fields, so nothing extra a client adds ends up stored.
  const raw = body.take as Take;
  const take: Take = {
    chartId: raw.chartId,
    startedAt: raw.startedAt,
    latencyOffsetMs: raw.latencyOffsetMs,
    inputDevice: raw.inputDevice,
    events: raw.events.map((e) => ({ pitch: e.pitch, velocity: e.velocity, timeMs: e.timeMs, offTimeMs: e.offTimeMs })),
  };
  if (take.inputDevice === "test") return fail(422, "test takes are never stored");
  if (Math.abs(take.latencyOffsetMs) > 150) return fail(400, "latencyOffsetMs out of range");
  if (take.events.length > MAX_EVENTS) return fail(422, "too many events");
  if (!SONG_ID.test(take.chartId)) return fail(400, "bad chartId");

  // The chart from this app's own files, never from a URL built from the request (its Host header is
  // client-controlled, so fetching from it would let a client supply its own chart and fake a score).
  let chartText: string;
  try {
    chartText = await readFile(path.join(process.cwd(), "public", "songs", take.chartId, "chart.json"), "utf8");
  } catch {
    return fail(422, `unknown song ${take.chartId}`);
  }
  let chart: Chart;
  try {
    chart = JSON.parse(chartText);
  } catch {
    return fail(500, "chart is not JSON");
  }
  if (validateChart(chart).length || chart.id !== take.chartId) return fail(500, "chart failed validation");
  const chartSha256 = createHash("sha256").update(chartText).digest("hex");

  const results = judgeTake(chart, take);
  const rows = takeRows({ takeId: id, playerId: user.id, chartSha256 }, chart, take, results);
  let outcome: Awaited<ReturnType<typeof saveTake>>;
  try {
    await upsertSong(songRow(chart, chartSha256));
    await ensurePlayer(user.id);
    outcome = await saveTake(rows.take, rows.notes);
  } catch (e) {
    console.error("take-store save failed", e);
    // The take passed validation and was judged here, so a 4xx from the database means its schema is behind
    // the game's contracts (say, a new judgment). 424 tells the browser to keep the take and resend it later.
    if (e instanceof SupabaseError && e.status < 500) return fail(424, "the database refused this take; kept for later");
    return fail(502, "save failed");
  }
  if (outcome === "conflict") return fail(409, "that take id belongs to someone else");
  if (outcome === "limited") return fail(429, "too many saves in a few minutes; kept for later");
  return Response.json(
    { id, outcome, accuracy: results.accuracy, rank: results.rank, counts: results.counts },
    { status: outcome === "saved" ? 201 : 200 },
  );
}
