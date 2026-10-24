-- The profile's hand and timing panel: per player, song and hand, every note they were judged on.
-- Counts per judgment, mean signed offset (+ late, - early), spread, mean velocity. Real counts only.
create view public.hand_stats with (security_invoker = true) as
select t.player_id,
       t.song_id,
       j.hand,
       count(*)                                        as notes,
       count(*) filter (where j.judgment = 'PERFECT')  as perfect,
       count(*) filter (where j.judgment = 'GREAT')    as great,
       count(*) filter (where j.judgment = 'GOOD')     as good,
       count(*) filter (where j.judgment = 'MISS')     as miss,
       round(avg(j.offset_ms), 1)                      as mean_offset_ms,
       round(stddev_samp(j.offset_ms), 1)              as spread_ms,
       round(avg(j.velocity))                          as mean_velocity
from public.takes t
join public.note_judgments j on j.take_id = t.id
group by t.player_id, t.song_id, j.hand;

revoke all on public.hand_stats from anon, authenticated;
grant select on public.hand_stats to authenticated, service_role;
