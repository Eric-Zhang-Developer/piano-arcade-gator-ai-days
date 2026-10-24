// Live check of the real Supabase project's setup: grants, RLS, anonymous sign-in and save_take.
// Reads web/.env.local, never prints a key, and deletes everything it creates. Run from the repo root:
//   node supabase/tests/live-smoke.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../../web/.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = env.SUPABASE_SECRET_KEY;
for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUB, SUPABASE_SECRET_KEY: SECRET }))
  assert.ok(v, `${k} missing in web/.env.local`);
assert.ok(PUB.startsWith("sb_publishable_"), "the publishable key should start with sb_publishable_");
assert.ok(SECRET.startsWith("sb_secret_"), "the secret key should start with sb_secret_");
assert.match(URL_, /^https:\/\/[a-z0-9]+\.supabase\.co$/, "NEXT_PUBLIC_SUPABASE_URL should be the Project URL (https://<ref>.supabase.co), not a dashboard link");

const say = (s) => process.stdout.write(s + "\n");
const users = [];
const signup = async () => {
  const r = await fetch(`${URL_}/auth/v1/signup`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(r.status, 200, `anonymous sign-in: ${r.status} ${await r.clone().text()} (turn on Anonymous sign-ins)`);
  assert.match(r.headers.get("content-type") ?? "", /json/, `expected JSON from ${URL_}/auth/v1/signup; check NEXT_PUBLIC_SUPABASE_URL`);
  const j = await r.json();
  users.push(j.user.id);
  return j;
};
const rest = (path, key, token, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
const check = async (name, fn) => { await fn(); say(`ok  ${name}`); };

try {
  const a = await signup(), b = await signup();
  const takeId = randomUUID();
  await check("anonymous sign-in works and is flagged anonymous", async () => assert.equal(a.user.is_anonymous, true));
  await check("server key can upsert a song and a player", async () => {
    const s = await rest("songs?on_conflict=id", SECRET, null, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "smoke-test", title: "Smoke test", composer: "-", bpm: 100, beats_per_bar: 4, note_count: 1, chart_sha256: "x" }) });
    assert.ok(s.ok, `songs upsert ${s.status} ${await s.text()}`);
    const p = await rest("players?on_conflict=id", SECRET, null, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ id: a.user.id }) });
    assert.ok(p.ok, `players upsert ${p.status} ${await p.text()}`);
  });
  const takeRow = { id: takeId, player_id: a.user.id, song_id: "smoke-test", chart_sha256: "x", judge_version: 1, contract_version: 1, started_at: new Date().toISOString(), input_device: "keys", latency_offset_ms: 0, bar_from: null, bar_to: null, tempo_pct: 100, perfect: 0, great: 1, miss: 0, extras: 0, accuracy: 0.5, max_combo: 1, rank: "D", take: {}, results: {} };
  const notes = [{ take_id: takeId, note_id: "n1", pitch: 60, hand: "R", bar: 1, beat: 0, judgment: "GREAT", offset_ms: 30, velocity: 80 }];
  const save = () => rest("rpc/save_take", SECRET, null, { method: "POST", body: JSON.stringify({ p_take: takeRow, p_notes: notes }) }).then(async (r) => { assert.ok(r.ok, `save_take ${r.status} ${await r.clone().text()} (run 0002_supabase_auth.sql)`); return r.json(); });
  await check("save_take (v2) saves, then reports a retry as duplicate", async () => {
    assert.equal(await save(), "saved");
    assert.equal(await save(), "duplicate");
  });
  await check("the player reads their own take, notes and trends", async () => {
    assert.equal((await (await rest(`takes?id=eq.${takeId}&select=id`, PUB, a.access_token)).json()).length, 1);
    assert.equal((await (await rest(`note_judgments?take_id=eq.${takeId}&select=note_id`, PUB, a.access_token)).json()).length, 1);
    const bars = await (await rest(`bar_trends?song_id=eq.smoke-test&select=*`, PUB, a.access_token)).json();
    assert.equal(bars[0].mean_offset_ms, 30);
  });
  await check("another player sees none of it", async () => {
    for (const t of ["takes", "note_judgments", "bar_trends", "take_history", "players"])
      assert.deepEqual(await (await rest(`${t}?select=*`, PUB, b.access_token)).json(), [], t);
  });
  await check("the public key alone reads songs only", async () => {
    assert.equal((await rest("songs?select=id", PUB)).status, 200);
    for (const t of ["takes", "players", "note_judgments", "coach_feedback", "bar_trends", "take_history"])
      assert.notEqual((await rest(`${t}?select=*`, PUB)).status, 200, `${t} is readable with the public key`);
  });
  await check("players can't write directly or call save_take", async () => {
    assert.ok((await rest("takes", PUB, a.access_token, { method: "POST", body: JSON.stringify({ id: randomUUID() }) })).status >= 400);
    assert.ok((await rest("rpc/save_take", PUB, a.access_token, { method: "POST", body: JSON.stringify({ p_take: {}, p_notes: [] }) })).status >= 400);
  });
  say("pass: the live project is set up right");
} finally {
  // Clean up: the test take and song, then the anonymous users (cascades to players).
  await rest(`takes?song_id=eq.smoke-test`, SECRET, null, { method: "DELETE" });
  await rest(`songs?id=eq.smoke-test`, SECRET, null, { method: "DELETE" });
  for (const id of users) await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SECRET } });
}
