-- The learning lane's evidence (#753): every theory answer and playing attempt, append-only, so a student's mastery
-- is computed by replaying them (mastery itself is never stored), plus each student's goal songs.
-- Same rules as takes: the browser never writes (the learning lane's server route calls save_learning_attempt with
-- the secret key), a player reads only their own rows, a save limit, and guest merge and cleanup include them.

create table public.learning_attempts (
  id          uuid primary key,                       -- made by the client: a retry is a duplicate, never a copy
  player_id   uuid not null references public.players(id) on delete cascade,
  created_at  timestamptz not null default now(),
  item_id     text not null check (length(item_id) between 1 and 128),
  node_id     text not null check (length(node_id) between 1 and 128),
  kind        text not null check (kind in ('theory', 'playing')),
  mode        text not null check (mode in ('diagnostic', 'activity')),
  correct     boolean not null,
  cold        boolean not null,                       -- first try at this item with no help
  help_share  real not null default 0 check (help_share between 0 and 1),
  details     jsonb check (details is null or octet_length(details::text) <= 8192)
);
create index learning_attempts_player_time on public.learning_attempts (player_id, created_at desc);
create index learning_attempts_player_node on public.learning_attempts (player_id, node_id, created_at);

create table public.learner_goals (
  player_id   uuid primary key references public.players(id) on delete cascade,
  song_ids    text[] not null default '{}' check (cardinality(song_ids) <= 3),
  updated_at  timestamptz not null default now()
);

alter table public.learning_attempts enable row level security;
alter table public.learner_goals enable row level security;
revoke all on public.learning_attempts, public.learner_goals from anon, authenticated;
grant select on public.learning_attempts, public.learner_goals to authenticated;
grant select, insert, update, delete on public.learning_attempts, public.learner_goals to service_role;
create policy "read own attempts" on public.learning_attempts for select to authenticated
  using (player_id = (select auth.uid()));
create policy "read own goals" on public.learner_goals for select to authenticated
  using (player_id = (select auth.uid()));

-- One attempt, from the server. 'saved', 'duplicate' (a retry of this player's own attempt), 'conflict' (that id
-- belongs to someone else), or 'limited' (over 300 new attempts in 5 minutes: theory answers come fast, scripts faster).
create function public.save_learning_attempt(p jsonb) returns text
language plpgsql security invoker set search_path = public as $$
declare owner uuid;
declare recent int;
begin
  select player_id into owner from learning_attempts where id = (p->>'id')::uuid;
  if found then
    return case when owner = (p->>'player_id')::uuid then 'duplicate' else 'conflict' end;
  end if;
  select count(*) into recent from learning_attempts
  where player_id = (p->>'player_id')::uuid and created_at > now() - interval '5 minutes';
  if recent >= 300 then
    return 'limited';
  end if;
  insert into players(id) values ((p->>'player_id')::uuid) on conflict (id) do nothing;
  insert into learning_attempts select * from jsonb_populate_record(null::learning_attempts,
    jsonb_build_object('created_at', now(), 'help_share', 0) || p)
  on conflict (id) do nothing;
  if not found then
    select player_id into owner from learning_attempts where id = (p->>'id')::uuid;
    return case when owner = (p->>'player_id')::uuid then 'duplicate' else 'conflict' end;
  end if;
  return 'saved';
end $$;
revoke execute on function public.save_learning_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.save_learning_attempt(jsonb) to service_role;

-- Goals: up to 3 song ids, replaced whole. Server only.
create function public.set_learner_goals(p_player uuid, p_song_ids text[]) returns text[]
language sql security invoker set search_path = public as $$
  insert into players(id) values (p_player) on conflict (id) do nothing;
  insert into learner_goals(player_id, song_ids, updated_at) values (p_player, p_song_ids, now())
  on conflict (player_id) do update set song_ids = excluded.song_ids, updated_at = now()
  returning song_ids;
$$;
revoke execute on function public.set_learner_goals(uuid, text[]) from public, anon, authenticated;
grant execute on function public.set_learner_goals(uuid, text[]) to service_role;

-- merge_player v2: a guest's learning evidence follows them into their Google account too. The account's own goals
-- win; the guest's are kept only when the account has none.
create or replace function public.merge_player(p_from uuid, p_to uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare moved int;
begin
  if p_from = p_to then return 0; end if;
  insert into players(id) values (p_to) on conflict (id) do nothing;
  update takes set player_id = p_to where player_id = p_from;
  get diagnostics moved = row_count;
  update coach_feedback set player_id = p_to where player_id = p_from;
  update learning_attempts set player_id = p_to where player_id = p_from;
  insert into learner_goals(player_id, song_ids, updated_at)
    select p_to, song_ids, updated_at from learner_goals where player_id = p_from
  on conflict (player_id) do nothing;
  delete from players where id = p_from;
  return moved;
end $$;
revoke execute on function public.merge_player(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_player(uuid, uuid) to service_role;

-- cleanup_stale_guests v2: a guest who answered a theory question recently is active, not idle.
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
    )
    and not exists (
      select 1 from public.learning_attempts a where a.player_id = u.id and a.created_at >= now() - make_interval(days => p_days)
    );
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke execute on function public.cleanup_stale_guests(int) from public, anon, authenticated;
grant execute on function public.cleanup_stale_guests(int) to service_role;
