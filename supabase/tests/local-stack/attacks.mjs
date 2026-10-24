// Abuse checks against the local stack (app on :3100, gateway on :54321). Each line must say "ok".
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const APP = "http://localhost:3100", SB = "http://localhost:54321", PUB = "sb_publishable_test";
const chart = JSON.parse(readFileSync(new URL("../../../web/public/songs/twinkle/chart.json", import.meta.url)));
const mpb = 60000 / chart.bpm;
const perfect = (extra = {}) => ({
  chartId: "twinkle", startedAt: new Date().toISOString(), latencyOffsetMs: 0, inputDevice: "keys",
  events: chart.notes.map((n) => ({ pitch: n.pitch, velocity: 80, timeMs: n.beat * mpb, offTimeMs: null })), ...extra,
});
const signup = async () => (await (await fetch(`${SB}/auth/v1/signup`, { method: "POST", headers: { apikey: PUB }, body: "{}" })).json()).access_token;
const post = (token, body, headers = {}) =>
  fetch(`${APP}/api/takes`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const rest = (path, token, init = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: PUB, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
const check = async (name, fn) => { await fn(); process.stdout.write(`ok  ${name}\n`); };

const a = await signup(), b = await signup();
const idA = randomUUID();

await check("no session -> 401", async () => assert.equal((await post(null, { id: randomUUID(), take: perfect() })).status, 401));
await check("forged token -> 401", async () => assert.equal((await post(a.slice(0, -4) + "AAAA", { id: randomUUID(), take: perfect() })).status, 401));
await check("test input is never stored -> 422", async () => assert.equal((await post(a, { id: randomUUID(), take: perfect({ inputDevice: "test" }) })).status, 422));
await check("unknown song / path tricks -> 400", async () => assert.equal((await post(a, { id: randomUUID(), take: perfect({ chartId: "../../etc" }) })).status, 400));
await check("oversized body -> 413", async () => assert.equal((await post(a, JSON.stringify({ id: randomUUID(), take: perfect(), pad: "x".repeat(600000) }))).status, 413));
await check("spoofed Host can't swap the chart", async () => {
  const r = await post(a, { id: randomUUID(), take: perfect() }, { Host: "evil.example" });
  assert.equal(r.status, 201); // judged against the app's own chart file, so the honest perfect take scores S
  assert.equal((await r.json()).rank, "S");
});
await check("client-sent scores are ignored: server re-judges", async () => {
  const lying = perfect({ events: [] }); // no notes played
  const r = await post(a, { id: idA, take: { ...lying, results: { accuracy: 1, rank: "S" } } });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.rank, "D");
  assert.equal(j.counts.MISS, chart.notes.length);
});
await check("extra fields are stripped before storing", async () => {
  const rows = await (await rest(`takes?id=eq.${idA}&select=take`, a)).json();
  assert.equal(rows.length, 1);
  assert.equal("results" in rows[0].take, false);
});
await check("retry of the same id makes no duplicate", async () => {
  assert.equal((await post(a, { id: idA, take: perfect({ events: [] }) })).status, 200);
  assert.equal((await (await rest(`takes?id=eq.${idA}&select=id`, a)).json()).length, 1);
});
await check("player B can't read player A's takes, notes or trends", async () => {
  for (const t of ["takes", "note_judgments", "bar_trends", "take_history", "players"]) assert.deepEqual(await (await rest(`${t}?select=*`, b)).json(), [], t);
});
await check("player B can't overwrite A's take by reusing its id -> 409", async () => {
  assert.equal((await post(b, { id: idA, take: perfect() })).status, 409);
  const rows = await (await rest(`takes?id=eq.${idA}&select=rank`, a)).json();
  assert.equal(rows[0].rank, "D");
});
await check("public key alone reads songs and nothing else", async () => {
  assert.ok((await (await rest("songs?select=id")).json()).length >= 1);
  for (const t of ["takes", "players", "note_judgments", "coach_feedback", "bar_trends"]) assert.notEqual((await rest(`${t}?select=*`)).status, 200, t);
});
await check("signed-in players can't write rows directly", async () => {
  const r = await rest("takes", a, { method: "POST", body: JSON.stringify({ id: randomUUID() }) });
  assert.ok(r.status >= 400, `status ${r.status}`);
  const r2 = await rest("rpc/save_take", a, { method: "POST", body: JSON.stringify({ p_take: {}, p_notes: [] }) });
  assert.ok(r2.status >= 400, `rpc status ${r2.status}`);
});
await check("progress API returns only the caller's rows", async () => {
  const pa = await (await fetch(`${APP}/api/progress?song=twinkle`, { headers: { Authorization: `Bearer ${a}` } })).json();
  const pb = await (await fetch(`${APP}/api/progress?song=twinkle`, { headers: { Authorization: `Bearer ${b}` } })).json();
  assert.equal(pa.history.length, 2); // the spoofed-Host take and the lying take
  assert.equal(pb.history.length, 0); // B never saved anything of its own
});
