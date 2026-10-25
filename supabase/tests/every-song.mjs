// Every committed song, saved through the real app path (POST /api/takes: re-judge, save_take) into the database the
// app points at. Per song: a perfect take and a messy one (late, very late and skipped notes), then the stored rows
// are checked against the server's verdict and read back through /api/progress. Deletes everything it creates.
// With the app running (pnpm -C web dev), from the repo root:
//   node supabase/tests/every-song.mjs [appOrigin=http://localhost:3000]
// Reads web/.env.local and prints no keys. One anonymous player per 5 songs (10 takes): 0008 allows a player 20 new
// takes in 5 minutes, and Auth's anonymous sign-ins are limited per IP.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";

const wt = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const app = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(readFileSync(`${wt}/web/.env.local`, "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = env.SUPABASE_SECRET_KEY;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };
const rest = (p, init = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...admin, ...init.headers } });

const say = (line) => process.stdout.write(line + "\n");
const songsDir = `${wt}/web/public/songs`;
const songs = readdirSync(songsDir).filter((d) => existsSync(`${songsDir}/${d}/chart.json`)).sort();
const users = [];
let failures = 0;

function take(chart, shape) {
  const mpb = 60000 / chart.bpm;
  const events = [];
  chart.notes.forEach((n, i) => {
    const off = shape(i);
    if (off === null) return;
    const t = n.beat * mpb + off;
    events.push({ pitch: n.pitch, velocity: 90, timeMs: t, offTimeMs: t + 120 });
  });
  events.sort((a, b) => a.timeMs - b.timeMs);
  return { chartId: chart.id, startedAt: new Date().toISOString(), latencyOffsetMs: 0, inputDevice: "keys", events };
}
const perfect = () => 0;
const messy = (i) => (i % 7 === 3 ? null : i % 5 === 1 ? 70 : i % 3 === 2 ? 35 : 0);

try {
  let s, auth;
  for (const [index, song] of songs.entries()) {
    if (index % 5 === 0) {
      const signup = await fetch(`${URL_}/auth/v1/signup`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: "{}" });
      s = await signup.json();
      assert.ok(signup.ok && s.user, `anonymous sign-up: ${signup.status} ${s.msg ?? ""} (429 = Auth's per-IP limit; raise it or wait)`);
      users.push(s.user.id);
      auth = { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" };
    }
    const chart = JSON.parse(readFileSync(`${songsDir}/${song}/chart.json`, "utf8"));
    try {
      const saved = [];
      for (const [name, shape] of [["perfect", perfect], ["messy", messy]]) {
        const id = randomUUID();
        const res = await fetch(`${app}/api/takes`, { method: "POST", headers: auth, body: JSON.stringify({ id, take: take(chart, shape) }) });
        const body = await res.json();
        assert.equal(res.status, 201, `${name}: ${res.status} ${JSON.stringify(body)}`);
        const [row] = await (await rest(`takes?id=eq.${id}&select=*`)).json()
          .catch(() => [null]);
        assert.ok(row, `${name}: no takes row`);
        assert.equal(row.player_id, s.user.id);
        assert.equal(row.song_id, chart.id);
        assert.equal(row.perfect, body.counts.PERFECT, `${name}: perfect`);
        assert.equal(row.great, body.counts.GREAT, `${name}: great`);
        assert.equal(row.miss, body.counts.MISS, `${name}: miss`);
        assert.equal(Number(row.accuracy), Math.round(body.accuracy * 10000) / 10000, `${name}: accuracy`);
        if ("good" in row) assert.equal(row.good, body.counts.GOOD ?? 0, `${name}: good`);
        const notes = await (await rest(`note_judgments?take_id=eq.${id}&select=note_id`, { headers: { Prefer: "count=exact" } })).json();
        assert.equal(notes.length, chart.notes.length, `${name}: one note_judgments row per chart note`);
        saved.push({ name, counts: body.counts, rank: body.rank });
      }
      assert.equal(saved[0].counts.PERFECT, chart.notes.length, "the perfect take is all PERFECT");
      const prog = await (await fetch(`${app}/api/progress?song=${encodeURIComponent(chart.id)}`, { headers: auth })).json();
      assert.equal(prog.history.length, 2, "progress shows both takes");
      assert.ok(prog.bars.length > 0, "progress has bar trends");
      const m = saved[1].counts;
      say(`ok  ${chart.id.padEnd(16)} ${String(chart.notes.length).padStart(4)} notes  perfect S, messy ${saved[1].rank} ` +
        `(P${m.PERFECT} G${m.GREAT} Gd${m.GOOD ?? 0} M${m.MISS})  progress ${prog.history.length} takes, ${prog.bars.length} bars`);
    } catch (e) {
      failures++;
      say(`FAIL ${song}: ${e.message}`);
    }
  }
} finally {
  for (const id of users) {
    await rest(`takes?player_id=eq.${id}`, { method: "DELETE" });
    await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });
  }
  const left = await (await rest(`takes?select=id&player_id=in.(${users.join(",")})`)).json();
  say(`cleanup: ${users.length} test players deleted, ${left.length} test takes left`);
}
say(failures ? `FAIL: ${failures} of ${songs.length} songs` : `pass: all ${songs.length} songs save and read back`);
process.exit(failures ? 1 : 0);
