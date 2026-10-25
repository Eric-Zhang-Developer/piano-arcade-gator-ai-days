// Every migration, applied in order to a throwaway in-memory Postgres (PGlite), then the rules every table must keep.
// No Docker, no database password, no network. Run before pushing anything to the live project:
//   npm --prefix supabase/tests ci && node supabase/tests/migrations.mjs
// A new table without RLS, a browser write grant, or a view that skips RLS fails here, not in production.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const say = (s) => process.stdout.write(s + "\n");
const db = new PGlite();

// What Supabase gives every project and our SQL relies on: the API roles and a stub of auth.
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, is_anonymous boolean not null default true, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);

for (const f of files) {
  assert.match(f, /^\d{14}_[a-z0-9_]+\.sql$/, `${f}: name it <14-digit timestamp>_<snake_case>.sql (npx supabase migration new <name>)`);
  // PGlite has pgcrypto's gen_random_uuid built in; the extension itself isn't bundled.
  const sql = readFileSync(new URL(f, dir), "utf8").replace(/create extension[^;]*;/gi, "");
  try {
    await db.exec(sql);
  } catch (e) {
    throw new Error(`${f} failed to apply: ${e.message}`);
  }
  say(`ok  applied ${f}`);
}

const rows = async (sql) => (await db.query(sql)).rows;

const noRls = await rows(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
assert.deepEqual(noRls.map((r) => r.relname), [], "every public table needs: alter table ... enable row level security");
say("ok  every table has row level security on");

const browserWrites = await rows(`select table_name, grantee, privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')`);
assert.deepEqual(browserWrites, [], "the browser never writes: only server routes (service_role) do");
say("ok  the browser keys can't write any table");

const unsafeViews = await rows(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce('security_invoker=true' = any(c.reloptions), false)`);
assert.deepEqual(unsafeViews.map((r) => r.relname), [], "views need: with (security_invoker = true), or they bypass RLS");
say("ok  every view respects row level security");

const openFns = await rows(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'execute')
    or has_function_privilege('authenticated', p.oid, 'execute'))`);
assert.deepEqual(openFns.map((r) => r.proname), [], "revoke execute on public functions from public, anon, authenticated");
say("ok  the browser keys can't call any function");

const anonReads = await rows(`select table_name from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT'`);
assert.deepEqual(anonReads.map((r) => r.table_name), ["songs"], "only songs is public; anything else the public key can read needs a decision");
say("ok  the public key reads songs only");

// The take store end to end: save, retry, a judgment added to the contract later, and the guards that stay.
const player = randomUUID();
await db.exec(`insert into auth.users(id) values ('${player}'); insert into players(id) values ('${player}');
  insert into songs(id, title, composer, bpm, beats_per_bar, note_count, chart_sha256) values ('twinkle','Twinkle','trad',100,4,2,'abc');`);
const take = (extra = {}) => ({ id: randomUUID(), player_id: player, song_id: "twinkle", chart_sha256: "abc", judge_version: 1,
  contract_version: 1, started_at: "2026-10-24T05:00:00Z", input_device: "midi", latency_offset_ms: 10, tempo_pct: 100,
  perfect: 0, great: 1, miss: 1, extras: 0, accuracy: 0.25, max_combo: 1, rank: "D", take: {}, results: {}, ...extra });
const note = (t, judgment, offset_ms, extra = {}) =>
  ({ take_id: t.id, note_id: randomUUID(), pitch: 60, hand: "R", bar: 1, beat: 0, judgment, offset_ms, velocity: 80, ...extra });
const save = async (t, notes) => (await db.query("select save_take($1::jsonb, $2::jsonb) as r", [t, JSON.stringify(notes)])).rows[0].r;
const refused = async (name, t, notes) => {
  await assert.rejects(() => save(t, notes), undefined, `${name} should be refused`);
  say(`ok  refused: ${name}`);
};

const t1 = take();
assert.equal(await save(t1, [note(t1, "GREAT", 32), note(t1, "MISS", null)]), "saved");
assert.equal(await save(t1, [note(t1, "GREAT", 32)]), "duplicate");
say("ok  save_take saves, and a retry is a duplicate");
const t2 = take({ rank: "A+" });
assert.equal(await save(t2, [note(t2, "GOOD", 70)]), "saved");
say("ok  a judgment and rank the contract adds later save with no migration");
const t4 = take({ good: 2, wrong: 1 });
assert.equal(await save(t4, [note(t4, "GOOD", 60)]), "saved");
const t5 = take(); // a take from code that predates the good/wrong columns
assert.equal(await save(t5, [note(t5, "PERFECT", 1)]), "saved");
const counts = await rows(`select id, good, wrong from takes where id in ('${t4.id}', '${t5.id}') order by good desc`);
assert.deepEqual(counts.map((r) => [r.good, r.wrong]), [[2, 1], [0, 0]]);
say("ok  GOOD and WRONG counts are stored, and older payloads without them still save");
await db.exec(`insert into songs(id, title, composer, bpm, beats_per_bar, note_count, chart_sha256) values ('fur-elise','Fur Elise','Beethoven',72,4.5,1,'x'), ('chopin','Prelude','Chopin',60,1.5,1,'x');`);
await assert.rejects(() => db.exec(`insert into songs(id, title, composer, bpm, beats_per_bar, note_count, chart_sha256) values ('zero','z','z',60,0,1,'x');`));
say("ok  songs in compound meters (4.5 and 1.5 beats per bar) are stored; zero is refused");
let t = take(); await refused("a MISS with an offset", t, [note(t, "MISS", 10)]);
t = take(); await refused("a hit without an offset", t, [note(t, "GREAT", null)]);
t = take(); await refused("an offset of 5 seconds", t, [note(t, "GOOD", 5000)]);
t = take(); await refused("a pitch off the piano", t, [note(t, "PERFECT", 1, { pitch: 10 })]);
t = take({ latency_offset_ms: 200 }); await refused("latency over 150 ms", t, [note(t, "PERFECT", 1)]);
t = take({ input_device: "test" }); await refused("a test take", t, [note(t, "PERFECT", 1)]);

// A second device's anonymous takes move to the Google account, and the anonymous player row goes away.
const other = randomUUID();
await db.exec(`insert into auth.users(id) values ('${other}'); insert into players(id) values ('${other}');`);
const t3 = { ...take(), player_id: other };
assert.equal(await save(t3, [note(t3, "PERFECT", 2)]), "saved");
assert.equal((await rows(`select merge_player('${other}', '${player}') as n`))[0].n, 1);
assert.equal((await rows(`select count(*)::int as n from takes where player_id = '${other}'`))[0].n, 0);
assert.equal((await rows(`select count(*)::int as n from players where id = '${other}'`))[0].n, 0);
assert.equal((await rows(`select merge_player('${player}', '${player}') as n`))[0].n, 0);
say("ok  merge_player moves a device's takes to the signed-in player");

// session_history: one row per take with the song's title and how long it was played.
const t6 = take({ song_id: "fur-elise", take: { events: [{ pitch: 60, velocity: 80, timeMs: 1000, offTimeMs: 1200 }, { pitch: 62, velocity: 80, timeMs: 61500, offTimeMs: null }] } });
assert.equal(await save(t6, [note(t6, "PERFECT", 1)]), "saved");
const [sess] = await rows(`select title, duration_ms, rank from session_history where take_id = '${t6.id}'`);
assert.deepEqual([sess.title, sess.duration_ms, sess.rank], ["Fur Elise", 61500, "D"]);
const [empty] = await rows(`select duration_ms from session_history where take_id = '${t1.id}'`);
assert.equal(empty.duration_ms, 0);
say("ok  session_history lists each take with its song title and how long it was played");

// hand_stats: per player, song and hand, every judged note.
const hs = await rows(`select hand, notes, perfect, great, good, miss, mean_offset_ms from hand_stats where player_id = '${player}' and song_id = 'twinkle' order by hand`);
assert.ok(hs.length >= 1 && hs.every((h) => Number(h.notes) === Number(h.perfect) + Number(h.great) + Number(h.good) + Number(h.miss)), "every note is one judgment");
say("ok  hand_stats counts each hand's notes by judgment, with timing");

// Save limit: 20 new takes per player in 5 minutes; a retry still answers 'duplicate'; other players are unaffected.
const busy = randomUUID();
await db.exec(`insert into auth.users(id) values ('${busy}'); insert into players(id) values ('${busy}');`);
const burst = [];
for (let i = 0; i < 20; i++) {
  const t = { ...take(), player_id: busy };
  burst.push(t);
  assert.equal(await save(t, [note(t, "PERFECT", 1)]), "saved");
}
const t21 = { ...take(), player_id: busy };
assert.equal(await save(t21, [note(t21, "PERFECT", 1)]), "limited");
assert.equal((await rows(`select count(*)::int as n from takes where id = '${t21.id}'`))[0].n, 0);
assert.equal(await save(burst[0], [note(burst[0], "PERFECT", 1)]), "duplicate");
const calm = { ...take({ song_id: "fur-elise" }), player_id: player };
assert.equal(await save(calm, [note(calm, "PERFECT", 1)]), "saved");
await db.exec(`update takes set created_at = now() - interval '6 minutes' where player_id = '${busy}'`);
assert.equal(await save(t21, [note(t21, "PERFECT", 1)]), "saved");
say("ok  20 saves per player per 5 minutes; a retry is still a duplicate; others and later saves go through");

// Guest cleanup: only anonymous users idle for 30 days (no sign-in, no take). Google users and active guests stay.
const [idleGuest, activeGuest, oldGoogle, recentPlayer] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await db.exec(`insert into auth.users(id, is_anonymous, created_at, last_sign_in_at) values
  ('${idleGuest}', true, now() - interval '40 days', now() - interval '40 days'),
  ('${activeGuest}', true, now() - interval '40 days', now() - interval '2 days'),
  ('${oldGoogle}', false, now() - interval '400 days', now() - interval '400 days'),
  ('${recentPlayer}', true, now() - interval '40 days', now() - interval '40 days');
  insert into players(id) values ('${idleGuest}'), ('${activeGuest}'), ('${oldGoogle}'), ('${recentPlayer}');`);
const oldTake = { ...take({ created_at: new Date(Date.now() - 35 * 86400000).toISOString() }), player_id: idleGuest };
assert.equal(await save(oldTake, [note(oldTake, "PERFECT", 1)]), "saved");
const freshTake = { ...take(), player_id: recentPlayer };
assert.equal(await save(freshTake, [note(freshTake, "PERFECT", 1)]), "saved");
await assert.rejects(() => db.query("select cleanup_stale_guests(1)"), /at least 7 days/);
assert.equal((await rows("select cleanup_stale_guests() as n"))[0].n, 1);
const left = (await rows(`select id from auth.users where id in ('${idleGuest}', '${activeGuest}', '${oldGoogle}', '${recentPlayer}')`)).map((r) => r.id).sort();
assert.deepEqual(left, [activeGuest, oldGoogle, recentPlayer].sort());
assert.equal((await rows(`select count(*)::int as n from takes where player_id = '${idleGuest}'`))[0].n, 0, "the idle guest's takes cascade");
say("ok  cleanup removes only guests idle 30 days; Google users, recent sign-ins and recent players stay");

// Learning lane (#753): append-only attempts and goals, saved by the server, read only by their player.
const learner = randomUUID(), guest2 = randomUUID();
await db.exec(`insert into auth.users(id) values ('${learner}'), ('${guest2}');`);
const attempt = (extra = {}) => ({ id: randomUUID(), player_id: learner, item_id: "q-intervals-3", node_id: "intervals", kind: "theory",
  mode: "diagnostic", correct: true, cold: true, help_share: 0, details: { answer: "M3" }, ...extra });
const saveAttempt = async (a) => (await db.query("select save_learning_attempt($1::jsonb) as r", [a])).rows[0].r;
const a1 = attempt();
assert.equal(await saveAttempt(a1), "saved");
assert.equal(await saveAttempt(a1), "duplicate");
assert.equal(await saveAttempt({ ...a1, player_id: guest2 }), "conflict");
for (const [why, bad] of [["kind", { kind: "quiz" }], ["mode", { mode: "exam" }], ["help_share", { help_share: 1.5 }],
  ["details over 8 KB", { details: { blob: "x".repeat(9000) } }], ["empty item", { item_id: "" }]]) {
  await assert.rejects(() => saveAttempt(attempt(bad)), undefined, `refused: ${why}`);
}
assert.deepEqual((await rows(`select set_learner_goals('${learner}', array['twinkle','fur-elise']) as g`))[0].g, ["twinkle", "fur-elise"]);
await assert.rejects(() => db.query(`select set_learner_goals('${learner}', array['a','b','c','d'])`), undefined, "at most 3 goals");
say("ok  learning attempts save once, refuse bad values, and goals hold at most 3 songs");

for (let i = 0; i < 299; i++) assert.equal(await saveAttempt(attempt({ node_id: `n${i % 7}` })), "saved");
assert.equal(await saveAttempt(attempt()), "limited");
await db.exec(`update learning_attempts set created_at = now() - interval '6 minutes' where player_id = '${learner}'`);
assert.equal(await saveAttempt(attempt()), "saved");
say("ok  300 learning attempts per player per 5 minutes, then 'limited'");
const withHint = attempt({ revealed: true });
assert.equal(await saveAttempt(withHint), "saved");
assert.equal((await rows(`select revealed from learning_attempts where id = '${withHint.id}'`))[0].revealed, true);
assert.equal((await rows(`select revealed from learning_attempts where id = '${a1.id}'`))[0].revealed, false, "default is false");
say("ok  an attempt's revealed flag is stored; it defaults to false");

const g2a = attempt({ player_id: guest2 });
assert.equal(await saveAttempt(g2a), "saved");
await db.query(`select set_learner_goals('${guest2}', array['minuet-g'])`);
const [{ n: movedTakes }] = await rows(`select merge_player('${guest2}', '${learner}') as n`);
assert.equal(movedTakes, 0);
assert.equal((await rows(`select count(*)::int as n from learning_attempts where player_id = '${learner}' and id = '${g2a.id}'`))[0].n, 1);
assert.deepEqual((await rows(`select song_ids from learner_goals where player_id = '${learner}'`))[0].song_ids, ["twinkle", "fur-elise"], "the account's goals win");
say("ok  a guest's attempts merge into the account; the account's goals win");

const studious = randomUUID();
await db.exec(`insert into auth.users(id, is_anonymous, created_at, last_sign_in_at) values ('${studious}', true, now() - interval '40 days', now() - interval '40 days');`);
assert.equal(await saveAttempt(attempt({ player_id: studious })), "saved");
await db.query("select cleanup_stale_guests()");
assert.equal((await rows(`select count(*)::int as n from auth.users where id = '${studious}'`))[0].n, 1);
say("ok  cleanup keeps a guest who answered theory recently");

const [trend] = await rows(`select notes, misses from bar_trends where player_id = '${player}' and song_id = 'twinkle'`);
assert.deepEqual([Number(trend.notes), Number(trend.misses)], [6, 1]);
say("ok  bar_trends counts the saved notes");
say(`pass: ${files.length} migrations apply and keep the rules`);
