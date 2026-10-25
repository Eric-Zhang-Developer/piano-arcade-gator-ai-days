// Loads the 200 synthetic learners into the live Supabase, or takes them out again. Run from web/ with run.mjs
// (supabase/README.md has the commands). Reads web/.env.local and never prints a key.
//   --dry-run   no network: row counts per table and the bytes they'd send
//   --undo      deletes exactly the 200 synthetic auth users; the cascades remove their rows
//   --roster    rewrites roster.json (the /progress switch's list); no network
//   --now <iso> places the takes relative to this time instead of now
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCohort, toLearnerGoalsRow, toLearningAttemptRows, type SyntheticLearner } from "../../learn/frontend/mastery/sim";
import { curriculumCharts } from "./charts";
import { synthesize, type SyntheticRows } from "./generate";
import { rosterEntry } from "./roster";

const webDir = path.resolve(import.meta.dirname, "../../..");

type Learner = { learner: SyntheticLearner; rows: SyntheticRows };
type Env = { url: string; key: string };

function readEnv(): Env {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path.join(webDir, ".env.local"), "utf8").split("\n")) {
    const pair = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (pair) env[pair[1]] = pair[2].replace(/^["']|["']$/g, "");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = env.SUPABASE_SECRET_KEY ?? "";
  if (!url || !key) throw new Error("web/.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  return { url, key };
}

async function call(env: Env, route: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${env.url}${route}`, {
    ...init,
    headers: { apikey: env.key, "Content-Type": "application/json", ...(init.headers as Record<string, string>) },
  });
  if (!res.ok && res.status !== 404) throw new Error(`${init.method ?? "GET"} ${route.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

const chunks = <T>(xs: readonly T[], size: number) => Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, i * size + size));
const inList = (ids: readonly string[]) => `in.(${ids.join(",")})`;

async function inParallel<T>(xs: readonly T[], width: number, run: (x: T) => Promise<void>) {
  const queue = [...xs];
  await Promise.all(Array.from({ length: width }, async () => {
    for (let x = queue.shift(); x !== undefined; x = queue.shift()) await run(x);
  }));
}

/** Upserts rows in batches; `onConflict` names the key a rerun matches on. */
async function upsert(env: Env, table: string, rows: readonly object[], onConflict: string, batch: number) {
  await inParallel(chunks(rows, batch), 4, async (part) => {
    await call(env, `/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(part),
    });
  });
}

async function count(env: Env, table: string, filter: string): Promise<number> {
  const res = await call(env, `/rest/v1/${table}?select=*&${filter}`, { method: "HEAD", headers: { Prefer: "count=exact" } });
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

function attemptRows(learner: SyntheticLearner) {
  const sorted = [...learner.attempts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  // toLearningAttemptRows keeps this order (its sort is stable), so row i is attempt i: its id is the attempt's.
  return toLearningAttemptRows(learner, sorted).map((row, i) => ({ id: sorted[i].id, player_id: learner.playerId, ...row }));
}

function tables(cohort: readonly Learner[]) {
  const songs = new Map(cohort.flatMap(({ rows }) => rows.songs.map((s) => [s.id, s] as const)));
  return {
    players: cohort.map(({ learner, rows }) => ({ id: learner.playerId, handle: rows.handle })),
    songs: [...songs.values()],
    takes: cohort.flatMap(({ rows }) => rows.takes.map((t) => t.take)),
    note_judgments: cohort.flatMap(({ rows }) => rows.takes.flatMap((t) => t.notes)),
    learning_attempts: cohort.flatMap(({ learner }) => attemptRows(learner)),
    learner_goals: cohort.map(({ learner }) => ({ player_id: learner.playerId, ...toLearnerGoalsRow(learner) })),
  };
}

/** Per table: the synthetic players' rows now in the database. */
async function live(env: Env, ids: readonly string[]) {
  const totals = { players: 0, takes: 0, note_judgments: 0, learning_attempts: 0, learner_goals: 0 };
  for (const part of chunks(ids, 50)) {
    const who = `player_id=${inList(part)}`;
    totals.players += await count(env, "players", `id=${inList(part)}&handle=like.synthetic*`);
    totals.takes += await count(env, "takes", who);
    totals.learning_attempts += await count(env, "learning_attempts", who);
    totals.learner_goals += await count(env, "learner_goals", who);
    const judged = (await (await call(env, `/rest/v1/takes?select=perfect,great,good,miss&${who}`)).json()) as Record<string, number>[];
    totals.note_judgments += judged.reduce((sum, t) => sum + t.perfect + t.great + t.good + t.miss, 0);
  }
  return totals;
}

async function ensureAuthUser(env: Env, learner: SyntheticLearner) {
  const found = await call(env, `/auth/v1/admin/users/${learner.playerId}`);
  if (found.ok) {
    const user = (await found.json()) as { user_metadata?: { synthetic?: boolean } };
    if (user.user_metadata?.synthetic !== true) throw new Error(`${learner.id}: auth user ${learner.playerId} exists and isn't synthetic`);
    return;
  }
  await call(env, "/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      id: learner.playerId,
      email: `${learner.id}@synthetic.invalid`,
      email_confirm: true,
      user_metadata: { synthetic: true, synthetic_id: learner.id },
    }),
  });
}

async function load(env: Env, cohort: readonly Learner[]) {
  const rows = tables(cohort);
  const ids = cohort.map(({ learner }) => learner.playerId);
  await inParallel(cohort, 6, ({ learner }) => ensureAuthUser(env, learner));
  console.log("auth users: 200 present");
  await upsert(env, "players", rows.players, "id", 200);
  await upsert(env, "songs", rows.songs, "id", 100);
  // A rerun replaces each learner's takes and attempts outright, so the database always holds exactly this run's rows.
  for (const part of chunks(ids, 10)) {
    await call(env, `/rest/v1/takes?player_id=${inList(part)}`, { method: "DELETE" });
    await call(env, `/rest/v1/learning_attempts?player_id=${inList(part)}`, { method: "DELETE" });
  }
  await upsert(env, "takes", rows.takes, "id", 40);
  await upsert(env, "note_judgments", rows.note_judgments, "take_id,note_id", 2500);
  await upsert(env, "learning_attempts", rows.learning_attempts, "id", 1000);
  await upsert(env, "learner_goals", rows.learner_goals, "player_id", 200);
  console.log("live now:", await live(env, ids));
}

async function undo(env: Env, cohort: readonly Learner[]) {
  const ids = cohort.map(({ learner }) => learner.playerId);
  console.log("live before:", await live(env, ids));
  let deleted = 0;
  await inParallel(cohort, 6, async ({ learner }) => {
    const found = await call(env, `/auth/v1/admin/users/${learner.playerId}`);
    if (!found.ok) return;
    const user = (await found.json()) as { user_metadata?: { synthetic?: boolean } };
    if (user.user_metadata?.synthetic !== true) throw new Error(`${learner.id}: auth user isn't synthetic; not deleting it`);
    await call(env, `/auth/v1/admin/users/${learner.playerId}`, { method: "DELETE" });
    deleted++;
  });
  console.log(`deleted ${deleted} synthetic auth users`);
  console.log("live after:", await live(env, ids));
}

export async function main(args: readonly string[]) {
  const flag = (name: string) => args.includes(name);
  const nowArg = args[args.indexOf("--now") + 1];
  const now = flag("--now") ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`--now: not a date: ${nowArg}`);

  const sources = curriculumCharts(webDir);
  const cohort = buildCohort().map((learner) => ({ learner, rows: synthesize(learner, sources, now) }));

  if (flag("--roster")) {
    const file = path.join(import.meta.dirname, "roster.json");
    const entries = cohort.map(({ learner, rows }) => JSON.stringify(rosterEntry(learner, rows, sources)));
    writeFileSync(file, `[\n${entries.join(",\n")}\n]\n`); // one learner per line, so a change reads as a diff
    console.log(`wrote ${path.relative(webDir, file)}: ${cohort.length} learners`);
    return;
  }
  if (flag("--dry-run")) {
    for (const [table, rows] of Object.entries(tables(cohort)))
      console.log(`${table.padEnd(18)} ${String(rows.length).padStart(7)} rows  ${(JSON.stringify(rows).length / 1e6).toFixed(1).padStart(6)} MB`);
    console.log(`auth users         ${String(cohort.length).padStart(7)}`);
    return;
  }
  const env = readEnv();
  await (flag("--undo") ? undo(env, cohort) : load(env, cohort));
}
