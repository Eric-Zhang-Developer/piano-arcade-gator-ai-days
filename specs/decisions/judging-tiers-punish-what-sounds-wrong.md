# judging-tiers: punish what a listener hears as wrong

- Date: 2026-10-24   Decided by: Eric, with eric-agent-1   Feature: judging-tiers
- **Context:** With the beat, Eric scored 71.4% (`specs/context/findings.md`); the misses were right keys just past
  ±50 ms. A right key 60 ms late scored the same as silence, plus an extra (double penalty), while a wrong key was
  only an extra that didn't touch the combo. Eric: punish wrong notes and outright misses; slightly-off timing on
  one-hand Twinkle shouldn't be this harsh.
- **Options:** A: a GOOD tier to 100 ms that keeps the combo, WRONG notes that break it, early/late as labels /
  B: a separate LATE tier (and EARLY) / C: widen GREAT.
- **Choice:** A. Early and late are the same error in opposite directions, so they're a label, not a tier. Widening
  GREAT would erase the skill ceiling; PERFECT and GREAT stay exact. In osu! the lowest scoring tier also keeps the
  combo and only a miss breaks it. The 100 ms window and the 0.25 weight are starting values; timing-feedback's
  near-miss counts tune them.
- **How to undo:** set `GOOD_MS` to 50 (GOOD never happens) and restore the mission lines; WRONG is one condition in
  the judge.
