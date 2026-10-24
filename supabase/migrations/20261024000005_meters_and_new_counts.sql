-- Compound meters: beatsPerBar counts quarter notes, so 3/8 is 1.5 (Fur Elise) and 9/8 is 4.5 (Clair de Lune).
-- The column was int, so every save of those songs failed. Any positive number up to 32 now; the old 1–16 integer
-- check goes with the type.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.songs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'beats_per_bar'
  loop
    execute format('alter table public.songs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.songs alter column beats_per_bar type numeric;
alter table public.songs add constraint songs_beats_per_bar_positive check (beats_per_bar > 0 and beats_per_bar <= 32);

-- judging-tiers added GOOD and WRONG to Results.counts. Both were already kept in takes.results (JSON);
-- columns make them queryable like perfect/great/miss. Older takes have neither: 0.
alter table public.takes add column good  int not null default 0 check (good  >= 0);
alter table public.takes add column wrong int not null default 0 check (wrong >= 0);

-- Older takes saved before this migration: fill the columns from their stored Results.
update public.takes
set good  = coalesce((results #>> '{counts,GOOD}')::int, 0),
    wrong = coalesce((results #>> '{counts,wrong}')::int, 0);

-- save_take v3: jsonb_populate_record turns a missing key into NULL, not the column default, so a take from code
-- that predates these columns (or an old outbox entry) would fail NOT NULL. Fill them in, like created_at.
create or replace function public.save_take(p_take jsonb, p_notes jsonb) returns text
language plpgsql security invoker set search_path = public as $$
declare owner uuid;
begin
  insert into takes select * from jsonb_populate_record(null::takes,
    jsonb_build_object('created_at', now(), 'good', 0, 'wrong', 0) || p_take)
  on conflict (id) do nothing;
  if not found then
    select player_id into owner from takes where id = (p_take->>'id')::uuid;
    return case when owner = (p_take->>'player_id')::uuid then 'duplicate' else 'conflict' end;
  end if;
  insert into note_judgments select * from jsonb_populate_recordset(null::note_judgments, p_notes);
  return 'saved';
end $$;
revoke execute on function public.save_take(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_take(jsonb, jsonb) to service_role;
