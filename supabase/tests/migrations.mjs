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
  create table auth.users (id uuid primary key, is_anonymous boolean not null default true, created_at timestamptz default now());
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

const [trend] = await rows(`select notes, misses from bar_trends where player_id = '${player}'`);
assert.deepEqual([Number(trend.notes), Number(trend.misses)], [6, 1]);
say("ok  bar_trends counts the saved notes");
say(`pass: ${files.length} migrations apply and keep the rules`);
