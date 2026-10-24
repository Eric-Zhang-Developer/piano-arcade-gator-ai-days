---
name: "Bar lines: a faint line and the bar number at each bar start, like Synthesia"
depends_on: ["core-loop", "bar-loop"]
owns: ["web/src/game/bar-lines/"]
assignee: "eric"
---

# Bar lines

A faint line across the highway at each bar start, with the bar number at the left edge, as Synthesia draws them.
When weak-bars says bar 7 is the weakest, or bar-loop plays bars 5–8, the player can see where bar 7 is. Calm, per
`specs/context/visual-direction.md`: never brighter than the dimmest note, and under the notes.

Issue: #260

## Plan
Two code PRs, then the done note, as key-skin and note-pills did:
1. `feat(bar-lines)`: in `web/src/game/bar-lines/`, a pure `barLines(chart, params)` returning one `{ atMs, label }`
   per bar (`label` null for an unnumbered bar), `drawBarLines(ctx, layout, lines, nowMs)`, `barLineSettings`, tests.
2. **A `fix(core-loop)` PR:** `HighwayState` gets an optional `barLines`. `start()` in `web/src/app/play/page.tsx`
   sets it once per take from `barLines(chart, params)`, and `drawHighway` (`web/src/game/core/highway.ts`) calls
   `drawBarLines` after the octave lines and before the notes. Without the field nothing changes.
3. `feat(bar-lines)`: screenshots and the done note.

## Requirements
- **Where:** bar n (1-based) starts at beat (n − 1) × `beatsPerBar` of the chart /play plays, at
  (n − 1) × `beatsPerBar` × `msPerBeat(bpm)`, computed per bar, not summed (`beatsPerBar` is 1.5 in Für Elise and
  4.5 in Clair de lune). Bars 1 to the last bar get a line (last bar = `ceil(last note end / beatsPerBar)`, as
  `loopChart` and weak-bars' `phrases` count). None before bar 1, so the count-in shows bar 1's line arriving. A line
  sits where a note head due at that time would, and draws only on the highway: never over the keys.
- **Look:** a 1 px line across the highway at that y (`project(0, y)` to `project(width, y)`), white at
  `barLineSettings.lineAlpha` (0.12; the octave lines are 0.08). The number sits just above its line at the highway's
  left edge, in `ink` at `labelAlpha` (0.2), `labelPx` 12 at 720 px tall, scaled with the canvas height.
- **Calm rule:** over the plain black highway, the line's luma and the number's are each at most the dimmest note's:
  note-pills' `farBrightness` (0.35) × the lowest luma of the hand colors and `settings.noteColor` (Rec. 709 weights
  on sRGB values, as fever-stage measures). Today that's 0.35 × luma(`#6aa8ff`) ≈ 0.22; the line is 0.12 and the
  number 0.2 × 0.95 ≈ 0.19.
- **Inside a bar-loop take** (`from`/`to` in the URL): the numbers are the song's bars, not the loop's. A pass is
  `to − from + 1` bars plus one empty bar, so a loop of 5–6 reads 5, 6, an unnumbered line, 5, 6. `tempo` changes
  the spacing, never the numbers.
- Every other chart change (scenes' `bot=fever` copies, `hands`, `versus`, wait mode's held clock) keeps the plain
  rule on the chart /play plays. highway-zoom and `?perspective` don't move a line's y. Replay view builds its own
  highway state, so a replay shows no bar lines.

## Validation
- `pnpm -C web test`:
  - Bar 1 at 0 ms and bar n at (n − 1) × `beatsPerBar` beats, at two bpms and at `beatsPerBar` 1.5. One entry per
    bar up to the last, none past it. `from=5&to=6&passes=2` labels 5, 6, null, 5, 6, and `&tempo=50` keeps them.
  - The calm rule, computed from `pillSettings`, `handColorSettings` and `ink`, so a brighter setting fails it.
  - `drawBarLines` with a fake context strokes only the lines on the highway and labels each numbered one.
  - Core: with a list in the state, the bar lines stroke after the octave lines and before the first note's fill;
    without one, the draw calls match today's.
- `verify.py --slug bar-lines` passes (Twinkle 42/42 PERFECT, unchanged).
- Headless Chrome at 1920×1080, screenshots in the PR:
  1. `/play?song=fur-elise&bot=perfect` -> in the count-in, bar 1's line coming down; mid-song, numbers rising in
     order at the left edge, under the pills.
  2. `/play?song=twinkle&from=5&to=6&passes=2&bot=perfect` -> 5, 6, an unnumbered line, 5, 6.
- On the piano (Eric; mark it in the done note): play Für Elise. Do the bar lines help you keep your place, or
  clutter? `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's
(`design-taste-frontend`) step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots go in
the PR.

## Defaults
- Calm wins. If a line or number competes with the notes in a screenshot, lower its alpha before anything else. The
  numbers are a player's aid, not text the viewer must read, so the 24 px video rule doesn't apply to them.
- Bar starts only: no beat lines, no closing line after the last bar, and no off switch (add `?bars=off`, like
  `?ghost=off`, if Eric finds them cluttering).
- Numbers follow bar-loop's count, not the printed score: Für Elise's pickup is bar 1, so `from=7` and the label agree.
- A bar-loop take played with `bot=fever` isn't handled (its copies don't keep the pass rhythm), so labels may drift.
- black-key-lanes edits the same spot in `drawHighway`. Whichever lands second rebases and keeps the order: backdrop,
  black lanes, octave lines, bar lines, notes.
- Log a choice the spec doesn't make in `specs/decisions/bar-lines-*.md`.
