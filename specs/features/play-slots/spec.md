---
name: "Play slots: plugins add panels to the start and results screens, plus Pause and Quit"
depends_on: []
owns: ["web/src/game/play-slots/"]
assignee: "eric"
---

# Play slots

So far every results-screen feature has edited `/play` itself (timing-feedback, piano-out, and the gaps in
`changes/bar-loop.md` and `changes/midi-watchdog.md`), and `/play` is core-loop's file. This feature wires the
contract's `startPanel` and `resultsPanel` into `/play` and gives Esc a Pause menu. Later features then land in
their own folders.

## Plan
1. **First:** the overnight `contract:` batch (#143) must be on `main`. If `web/src/contracts/index.ts` has no
   `startPanel`, this feature is blocked: take the next ready feature.
2. **A `fix(core-loop)` PR:** `/play` renders the slots and handles Esc (Requirements). With no panels, `/play`
   looks and plays as before, and `verify.py` passes unchanged.
3. **`fix(beat-track)` and `fix(midi-watchdog)` PRs:** each one honors `pause`, `resume` and `quit` (below).
4. **A `fix(piano-out)` PR:** `ReplayOnPiano` moves into piano-out's `resultsPanel`, and `/play` stops importing it.
   This is the first real panel.
5. The pause menu and the pure pause-clock math go in `web/src/game/play-slots/`. Core imports them.

## Requirements
- **Slots:** the start screen renders each plugin's `startPanel(ctx)` under Start. The results screen renders each
  `resultsPanel(ctx)` under the score and the timing panel, above Retry. Both follow `layers.ts` order, and each
  panel sits in a wrapper with `data-testid="slot-<plugin id>"`. A `null` panel gets no wrapper.
- `ctx.chart` is the chart after every `transformChart`. `ctx.take` and `ctx.results` belong to the finished take.
  `ctx.retry()` does what Retry does.
- If a panel throws, an error boundary around its wrapper catches it and logs one console line naming the plugin.
  The rest of the screen still renders.
- **Pause:** Esc during a take emits `pause` at the current chart time. The clock, judging and the highway stop, and
  a menu shows **Resume**, **Retry** and **Quit**. Pressing Esc again resumes.
- **Resume:** a one-bar countdown at the chart's tempo runs while the clock stays stopped, then `resume` fires at
  the same chart time. No note becomes a MISS because of time spent paused.
- **Keys while paused** are ignored: not judged, not recorded in the take.
- **Retry** emits `quit`, then starts a new take with `songStart`. **Quit** emits `quit` and returns to the start
  screen.
- **Ignored:** Esc before Start and on the results screen. `?input=test` never pauses.
- **Plugins with their own timers:** beat-track goes silent on `pause` and `quit`, and comes back on the beat after
  `resume`. midi-watchdog counts no stall while paused. The other plugins read `Frame.nowMs`, which stops.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: the pause clock. Pause at t, wait 5 s of wall time, resume -> the chart time is still t, and a
  note due during the pause isn't missed. The menu's state machine: Esc then Esc resumes; Quit opens `/` (the
  music select; issue #267, pause-skin).
- `verify.py --slug play-slots` passes. After the `fix(core-loop)` PR, `web/e2e/verify.mjs` also checks that the
  results screen renders without errors when no plugin has a panel.
- In Chrome:
  1. Press Esc mid-song -> notes freeze and the menu shows. Wait 5 s, then Resume -> a countdown, then play goes
     on with no MISS for the wait.
  2. Press Esc, then Quit -> `/`. Press Esc, then Retry -> a new count-in.
  3. Open `/sim`, watch the bot, and reach the results -> "Replay on piano" shows inside `slot-piano-out`.
- On the piano (Eric; mark it in the done note): pause mid-song while the beat plays. The beat stops, no note
  hangs, and the beat comes back on the beat after Resume.

## Defaults
- Moving `SfxControls` into juice-sound's `startPanel` is optional. If someone does it, it's a separate
  `fix(juice-sound)` PR.
- If Esc conflicts with something on the page, keep Esc and the button, and log the conflict in
  `specs/decisions/play-slots-*.md`.
