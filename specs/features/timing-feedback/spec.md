---
name: "Timing feedback: how early or late you played, on the results screen"
depends_on: ["core-loop"]
owns: ["web/src/game/timing/", "web/src/app/play/page.tsx"]
assignee: "eric"
---

# Timing feedback

With the beat, Eric scored 71.4% on Twinkle (`specs/context/findings.md`): 6 MISS and 7 extras, so nearly every
miss was the right key pressed just outside ±50 ms. The results screen only said MISS, so he couldn't tell whether he
was early or late, or whether it was latency or his hands. This adds the answer after the song, when the eyes are
free (during the song they belong on the piano: findings, first playtest). It also gives the data for two open
decisions: whether to add a GOOD tier, and whether the latency offset is wrong.

## Requirements
- **A pure function** in `web/src/game/timing/` takes a `Chart`, a `Take` and its `Results` and returns the summary
  below. No React, no clock; the learning lane can reuse it.
- **Timed presses:** every hit (its `offsetMs`), plus every **near miss**: a chart note judged MISS and an extra key
  press of the same pitch within ±`NEAR_MISS_MS` (150 ms, osu!'s outermost window at OD 5) of it. Each extra counts
  for at most one note, the nearest; each MISS note takes at most one extra. Wrong-pitch extras are never timed.
- **The summary:** the number of timed presses; the mean signed offset (negative is early) and the standard
  deviation, in whole ms; how many presses were early and how many late (exactly 0 counts as neither); and of the
  MISS notes, how many had a near miss within 100 ms and within 150 ms.
- **On the results screen**, under the counts: one line in words ("Late by 38 ms on average, spread ±21 ms"), the
  early/late counts, and the near-miss line ("5 of 6 misses were within 100 ms"). With fewer than 3 timed presses,
  show "Not enough timed presses" instead of numbers. Never show a number that wasn't computed from this take.
- **Latency suggestion:** when there are at least 10 timed presses and |mean| ≥ 10 ms, a button "Set latency offset
  to N ms" (N = the current offset + the mean, rounded, clamped to −150…150). It saves the offset like the slider
  does; the player presses Retry to use it. The screen says it shifts every press, so it also hides a player's own
  habit of rushing or dragging.
- Tuning numbers (`NEAR_MISS_MS`, the 100 ms line, the 3 and 10 press minimums, the 10 ms threshold) are named
  constants in `web/src/game/timing/` (decision 000 D1).
- `/play` keeps the `Take` of the last song so the results screen can pass it in. No other change to the play loop.

## Validation
- `pnpm -C web test`, against the Twinkle chart with synthetic takes:
  - Perfect player: 42 timed presses, mean 0, SD 0, 0 early, 0 late, no misses.
  - Late40: mean +40, SD 0, 42 late; the suggestion is "set latency to 40" from an offset of 0.
  - Near miss: one note at +120 ms → that note is a MISS with one near miss within 150 ms but not within 100 ms;
    mean and SD include +120.
  - Far miss: one note at +200 ms → MISS, no near miss, +200 not in the mean.
  - Wrong pitch: one note a semitone off at 0 ms → MISS, no near miss.
  - Two presses near one missed note: only the nearest counts.
  - Fewer than 3 timed presses: the summary says so and has no mean.
- `[verify].command` still passes, and its results screenshot shows the timing line (Perfect player: "On time on
  average, spread ±0 ms").
- On the piano (Eric): play once, read the timing line, apply the suggestion if one appears, play again; record both
  runs in `findings.md`.

## Out of scope
Live FAST/SLOW labels during play, a GOOD tier, per-bar breakdowns, saving takes. Each can follow from this data.
