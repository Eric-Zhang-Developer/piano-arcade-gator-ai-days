-- The learning lane's attempts carry `revealed` (a hint was shown). 0009 left it out, so every direct insert from
-- /learn/api/attempts was refused ("column revealed does not exist") and fell back to the device. Additive: old rows
-- are false. save_learning_attempt takes the field from the request and defaults it, so older callers still work.
alter table public.learning_attempts add column revealed boolean not null default false;

create or replace function public.save_learning_attempt(p jsonb) returns text
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
    jsonb_build_object('created_at', now(), 'help_share', 0, 'revealed', false) || p)
  on conflict (id) do nothing;
  if not found then
    select player_id into owner from learning_attempts where id = (p->>'id')::uuid;
    return case when owner = (p->>'player_id')::uuid then 'duplicate' else 'conflict' end;
  end if;
  return 'saved';
end $$;
revoke execute on function public.save_learning_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.save_learning_attempt(jsonb) to service_role;
