-- Signing in with Google on a second device: the takes that device played anonymously move to the Google account,
-- in one transaction, before the anonymous user is deleted. Called by the server only (/auth/merge), which checks
-- both sessions and that p_from is anonymous.

create function public.merge_player(p_from uuid, p_to uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare moved int;
begin
  if p_from = p_to then return 0; end if;
  insert into players(id) values (p_to) on conflict (id) do nothing;
  update takes set player_id = p_to where player_id = p_from;
  get diagnostics moved = row_count;
  update coach_feedback set player_id = p_to where player_id = p_from;
  delete from players where id = p_from;
  return moved;
end $$;
revoke execute on function public.merge_player(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_player(uuid, uuid) to service_role;
