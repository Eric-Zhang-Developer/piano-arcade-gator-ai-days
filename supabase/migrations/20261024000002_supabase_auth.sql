-- Players become Supabase Auth users (anonymous first, Google linked later with the same id).
-- Replaces the hand-rolled token hash from 0001. Writes stay server-only; reads of your OWN rows
-- are allowed straight from the browser with the publishable key + the user's session.

alter table public.players drop column token_sha256;
alter table public.players
  add constraint players_id_is_auth_user foreign key (id) references auth.users(id) on delete cascade;

-- Own-row reads for signed-in players (anonymous users are 'authenticated' too).
grant select on public.players, public.takes, public.note_judgments, public.coach_feedback,
                public.bar_trends, public.take_history to authenticated;

create policy "read own player" on public.players for select to authenticated
  using (id = (select auth.uid()));
create policy "read own takes" on public.takes for select to authenticated
  using (player_id = (select auth.uid()));
create policy "read own notes" on public.note_judgments for select to authenticated
  using (exists (select 1 from public.takes t where t.id = take_id and t.player_id = (select auth.uid())));
create policy "read own feedback" on public.coach_feedback for select to authenticated
  using (player_id = (select auth.uid()));

-- Optional, run by hand after the event: anonymous users who never linked Google and are older than 30 days.
-- delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';

-- The server role's grants again, in case 0001 ran before they were added to it (idempotent).
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

-- save_take v2: fills created_at when left out, and says what happened so the server can answer honestly:
-- 'saved' (new), 'duplicate' (a retry of this player's own take), 'conflict' (that id belongs to another player).
drop function public.save_take(jsonb, jsonb);
create function public.save_take(p_take jsonb, p_notes jsonb) returns text
language plpgsql security invoker set search_path = public as $$
declare owner uuid;
begin
  insert into takes select * from jsonb_populate_record(null::takes, jsonb_build_object('created_at', now()) || p_take)
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
