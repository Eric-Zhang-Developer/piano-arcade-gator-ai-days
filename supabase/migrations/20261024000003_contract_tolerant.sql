-- Let the schema follow the game's contracts instead of copying today's rules.
-- The server re-judges every take with the game's own judge before saving, so the judging rules live there.
-- When a contract: PR adds a judgment (GOOD is next), widens a timing window or adds a rank, takes keep saving
-- without a migration. What stays here: shape and sanity bounds that no rule change should ever cross.

-- Drop the old checks by what they say, not by name, so this works whatever Postgres named them.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.note_judgments'::regclass, 'public.takes'::regclass)
      and (pg_get_constraintdef(oid) ~ '''PERFECT''.*''GREAT'''       -- judgment in (PERFECT, GREAT, MISS)
        or (conrelid = 'public.note_judgments'::regclass               -- offset_ms between -50 and 50
            and pg_get_constraintdef(oid) ~ 'offset_ms.*[^0-9]50\M')    -- (not takes.latency_offset_ms ±150)
        or pg_get_constraintdef(oid) ~ 'rank.*''S''.*''D''')         -- rank in (S, A, B, C, D)
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.note_judgments drop constraint if exists note_judgments_judgment_name;
alter table public.note_judgments add constraint note_judgments_judgment_name
  check (judgment ~ '^[A-Z][A-Z_]{0,15}$');                    -- any judgment name the contract defines
alter table public.note_judgments drop constraint if exists note_judgments_offset_sane;
alter table public.note_judgments add constraint note_judgments_offset_sane
  check (offset_ms between -1000 and 1000);                    -- sanity bound, not the timing window
alter table public.takes drop constraint if exists takes_rank_name;
alter table public.takes add constraint takes_rank_name
  check (rank ~ '^[A-Z][A-Z+-]{0,2}$');                        -- S, A … D today; SS or A+ later

-- Kept on purpose: a MISS has no offset, pitch 21–108, input_device midi|keys, counts >= 0, accuracy 0–1.
