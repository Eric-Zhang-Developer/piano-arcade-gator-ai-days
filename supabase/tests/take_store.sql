-- Run from the repo root on a fresh Postgres 16: psql -f supabase/tests/take_store.sql
-- Creates Supabase-like roles and an auth stub, applies the migrations, and checks access and the views.
\set ON_ERROR_STOP 1
create role anon; create role authenticated; create role service_role bypassrls;
create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key, is_anonymous boolean not null default true, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
\i supabase/migrations/20261024000001_take_store.sql
\i supabase/migrations/20261024000002_supabase_auth.sql
\i supabase/migrations/20261024000003_contract_tolerant.sql
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
grant usage on schema public to anon, authenticated, service_role;
set role service_role;
insert into players(id, handle) values ('00000000-0000-0000-0000-000000000001','sharan'), ('00000000-0000-0000-0000-000000000002','judge');
insert into songs values ('twinkle','Twinkle','trad',100,4,2,'abc');
\set take '{"id":"10000000-0000-0000-0000-000000000001","player_id":"00000000-0000-0000-0000-000000000001","song_id":"twinkle","chart_sha256":"abc","judge_version":1,"contract_version":1,"started_at":"2026-10-24T05:00:00Z","input_device":"midi","latency_offset_ms":10,"tempo_pct":100,"perfect":0,"great":1,"miss":1,"extras":0,"accuracy":0.25,"max_combo":1,"rank":"D","take":{},"results":{},"created_at":"2026-10-24T05:00:00Z"}'
\set notes '[{"take_id":"10000000-0000-0000-0000-000000000001","note_id":"n1","pitch":60,"hand":"R","bar":1,"beat":0,"judgment":"GREAT","offset_ms":32,"velocity":80},{"take_id":"10000000-0000-0000-0000-000000000001","note_id":"n2","pitch":60,"hand":"R","bar":1,"beat":1,"judgment":"MISS","offset_ms":null,"velocity":null}]'
select save_take(:'take', :'notes');
-- retry (same payload) is a no-op: 'duplicate'
select save_take(:'take', :'notes');
-- the same id from another player: 'conflict', nothing changes
select save_take(jsonb_set(:'take'::jsonb, '{player_id}', '"00000000-0000-0000-0000-000000000002"'), '[]');
-- a judgment the contract adds later (GOOD at +70 ms) and a new rank save with no migration: 'saved'
select save_take(jsonb_set(jsonb_set(:'take'::jsonb, '{id}', '"10000000-0000-0000-0000-000000000009"'), '{rank}', '"A+"'),
  '[{"take_id":"10000000-0000-0000-0000-000000000009","note_id":"n1","pitch":60,"hand":"R","bar":1,"beat":0,"judgment":"GOOD","offset_ms":70,"velocity":80}]');
delete from takes where id = '10000000-0000-0000-0000-000000000009';
select 'takes', count(*) from takes union all select 'notes', count(*) from note_judgments;
select bar, notes, misses, mean_offset_ms from bar_trends;
select accuracy, mean_abs_offset_ms from take_history;
reset role;
\echo 'Next: 5 permission-denied errors are EXPECTED (the public key reads songs only)'
set role anon;
select id from songs;
\set ON_ERROR_STOP 0
select * from takes;
select * from players;
select * from bar_trends;
insert into songs values ('x','x','x',1,1,1,'x');
select save_take('{}','[]');
\set ON_ERROR_STOP 1
reset role;
-- player 1 sees own data, player 2 sees none of it
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select 'p1 takes', count(*) from takes union all select 'p1 notes', count(*) from note_judgments union all select 'p1 trends', count(*) from bar_trends;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select 'p2 takes', count(*) from takes union all select 'p2 notes', count(*) from note_judgments union all select 'p2 trends', count(*) from bar_trends;
\echo 'Next: 1 permission-denied error is EXPECTED (players cannot write)'
\set ON_ERROR_STOP 0
insert into players(id, handle) values ('00000000-0000-0000-0000-000000000002','x');
