---
name: "Replay view: watch your take on the highway while the piano plays it"
depends_on: ["play-slots"]
owns: ["web/src/game/replay-view/"]
assignee: "eric"
---

# Replay view

A "Watch replay" button on the results screen draws your presses over the chart's notes on the highway, in sync
with `piano-out` playing the take back on the DGX. Together with the take graph, it shows a player exactly how they
played (`mission.md`, What). It's a `resultsPanel` (play-slots).

## Requirements
- **The button:** "Watch replay" shows when the take has at least one press.
- **The overlay:** clicking it opens a full-screen canvas over the results screen. The overlay draws the highway
  with core's own `makeLayout` and `drawHighway` from `web/src/game/core/highway.ts` (import them; don't copy them),
  on the chart the take was played on.
- **What's drawn:** the chart's notes, colored by their judgment in the results, as the highway colors them in play.
  On top go the presses, each a marker in its pitch's lane at its played time (`take.events`), with its key lit
  while held.
- **The clock:** starts one bar before the first press, at 1×, and ends one bar after the last release.
- **Sound:** if piano-out can replay (`getReplayState().canReplay`), the overlay starts `startReplay()` and runs its
  clock off the same start. piano-out plays the first press `leadMs` after start, so press markers cross the line as
  the piano sounds them. Without a piano the replay is silent and says so.
- **Stopping:** Esc, a Stop button or the end of the replay closes the overlay and calls `stopReplay()`.
- **Read-only:** nothing is judged or recorded during a replay.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: the pure replay clock (start, `leadMs` and the first press time give the chart time at a
  given `performance.now()`). The highway state at a chart time: which notes show as hit or missed, and which keys
  are lit by presses held then.
- `verify.py --slug replay-view` passes.
- In Chrome, on `/sim` with the fake piano: watch the bot to the results, then Watch replay -> the highway plays the
  take back, with presses on the notes. The sim's log shows each replayed note within 20 ms of its marker crossing
  the line. Esc closes it. Keep a screenshot mid-replay.
- On the piano (Eric; mark it in the done note): watch a real take back. The DGX and the markers are together, and
  nothing hangs after Stop.

## Defaults
- No scrubbing and no speed control. 1× from start to end.
