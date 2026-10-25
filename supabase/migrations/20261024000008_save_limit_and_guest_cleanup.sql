-- Two safeguards before many players arrive.
--
-- 1. A save limit per player, in the database so every server instance shares it: at most 20 new takes in 5 minutes.
--    A real player can't finish songs faster than that; a script can. The take isn't lost: save_take answers
--    'limited', /api/takes answers 429, and the browser keeps it in the outbox and sends it later.
-- 2. Cleanup of guest accounts nobody uses: anonymous users with no sign-in and no take in 30 days. Google accounts and
--    any guest who played recently are never touched. Their players row, takes and notes cascade.

-- save_take v4: a retry of a saved take is still 'duplicate' (or 'conflict') before the limit is checked, so a player
-- over the limit can always finish resending what they already played.
create or replace function public.save_take(p_take jsonb, p_notes jsonb) returns text
language plpgsql security invoker set search_path = public as $$
declare owner uuid;
declare recent int;
begin
  select player_id into owner from takes where id = (p_take->>'id')::uuid;
  if found then
    return case when owner = (p_take->>'player_id')::uuid then 'duplicate' else 'conflict' end;
  end if;
  select count(*) into recent from takes
  where player_id = (p_take->>'player_id')::uuid and created_at > now() - interval '5 minutes';
  if recent >= 20 then
    return 'limited';
  end if;
  insert into takes select * from jsonb_populate_record(null::takes,
    jsonb_build_object('created_at', now(), 'good', 0, 'wrong', 0) || p_take)
  on conflict (id) do nothing;
  if not found then
    -- Lost a race with a concurrent save of the same id.
    select player_id into owner from takes where id = (p_take->>'id')::uuid;
    return case when owner = (p_take->>'player_id')::uuid then 'duplicate' else 'conflict' end;
  end if;
  insert into note_judgments select * from jsonb_populate_recordset(null::note_judgments, p_notes);
  return 'saved';
end $$;
revoke execute on function public.save_take(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_take(jsonb, jsonb) to service_role;

-- Guests idle for p_days: anonymous, created and last signed in before the cutoff, and no take after it.
-- security definer: deleting from auth.users needs the owner's rights; only the server role may call it.
create or replace function public.cleanup_stale_guests(p_days int default 30) returns int
language plpgsql security definer set search_path = public as $$
declare removed int;
begin
  if p_days < 7 then
    raise exception 'cleanup_stale_guests: keep guests at least 7 days (asked for %)', p_days;
  end if;
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - make_interval(days => p_days)
    and coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => p_days)
    and not exists (
      select 1 from public.takes t where t.player_id = u.id and t.created_at >= now() - make_interval(days => p_days)
    );
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke execute on function public.cleanup_stale_guests(int) from public, anon, authenticated;
grant execute on function public.cleanup_stale_guests(int) to service_role;

-- Nightly at 04:17 UTC where Supabase's scheduler (pg_cron) is available; skipped elsewhere (local Postgres, tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('cleanup-stale-guests', '17 4 * * *', 'select public.cleanup_stale_guests()');
  end if;
end $$;
