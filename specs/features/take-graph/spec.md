---
name: "Take graph: every note's timing over the song on the results screen"
depends_on: ["play-slots"]
owns: ["web/src/game/take-graph/"]
assignee: "eric"
---

# Take graph

"See exactly how they played it" (`mission.md`, What). This is a results panel that plots every note's offset over
the song, per hand, with the judging bands and a velocity line. Hovering a point names its bar and beat. It's a
`resultsPanel` (play-slots), drawn as plain SVG with no chart library.

## Requirements
- **Points:** a pure `graphPoints(chart, take, results)` returns one point per chart note: its bar and beat, its
  hand, its judgment, its signed offset in ms (null for a MISS), and the played velocity from
  `take.events[eventIndex]`.
- **Axes:** x is chart time in bars, with a tick at each bar. y is the offset, from `-GOOD_MS` (early) at the bottom
  to `+GOOD_MS` (late) at the top, with zero in the middle.
- **Bands:** shaded at ±25 ms (PERFECT) and ±50 ms (GREAT), and a line at ±100 ms (GOOD). Import the windows from
  `web/src/game/core/settings.ts` rather than copying them.
- **Marks:** each hit is a dot in its hand's color, from `hand-colors`' `handColor` if that's on `main`, otherwise
  one color with a different shape per hand. Each MISS is an × on the x axis. WRONG notes are a small tick at the
  top edge, placed by their time.
- **Velocity line:** a thin line of played velocity, 1–127, on a right-hand axis. Only when the input senses velocity
  (`midi` or `test`); laptop keys get a one-line note instead.
- **Hover and focus:** each dot carries "Bar 5, beat 2 · +32 ms · GREAT · velocity 74" as its tooltip and accessible
  name. A "Show as table" toggle lists the same rows.
- **Size:** it fills the results screen's width up to 900 px, and stays readable at 1 280 × 720.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: in 4/4, beat 5 is bar 2, beat 2. One point per chart note. A MISS has a null offset. Each
  point's velocity is its event's. A laptop take gives no velocity line. Bar-loop's looped chart still gives one
  point per looped note.
- `verify.py --slug take-graph` passes.
- In Chrome, with screenshots in the PR:
  1. `/play?bot=sloppy` -> the graph shows dots above and below zero, and ×s for the misses.
  2. Hover a dot -> its bar, beat, offset and judgment.
  3. `/play?bot=late` -> every dot sits about 40 ms above zero.
- On the piano (Eric; mark it in the done note): after a real take, find one spot you know you rushed, and say
  whether the graph shows it.

## Defaults
- No zoom and no scrolling. The bands and the table cover the detail.
