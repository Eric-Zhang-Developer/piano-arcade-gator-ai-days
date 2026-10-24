-- The profile page: every session a player has played, newest first, across all songs. One row per take with the
-- song's title, when it was played and for how long (chart time from 0 to the last key, from the stored Take).
create view public.session_history with (security_invoker = true) as
select t.player_id,
       t.id as take_id,
       t.song_id,
       s.title,
       s.composer,
       t.started_at,
       t.created_at,
       coalesce((select round(max(greatest((e->>'timeMs')::numeric, coalesce((e->>'offTimeMs')::numeric, 0))))
                 from jsonb_array_elements(t.take->'events') e), 0)::int as duration_ms,
       t.accuracy, t.rank, t.perfect, t.great, t.good, t.miss, t.wrong, t.extras, t.max_combo,
       t.input_device, t.bar_from, t.bar_to, t.tempo_pct
from public.takes t
join public.songs s on s.id = t.song_id;

-- Players read their own sessions (RLS on takes applies through security_invoker); the public key reads none.
revoke all on public.session_history from anon, authenticated;
grant select on public.session_history to authenticated, service_role;
