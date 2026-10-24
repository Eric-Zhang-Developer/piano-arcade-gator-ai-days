---
name: "Pedal lamp: a sustain lamp in the HUD band, and Ped. marks under the bass staff on the sheet"
depends_on: ["hud", "sheet-view", "sheet-xml", "piano-sim"]
owns: ["web/src/game/pedal-lamp/"]
assignee: "eric"
---

# Pedal lamp

The DGX-660 sends its sustain pedal as CC 64, but core's MIDI input drops every CC
(`web/src/game/core/input.ts:23`, "pedal and other CCs aren't judged"). Showing the pedal, live in the HUD and on
the take's score, makes real piano playing visible. Input only: the pedal is never judged.

Issue: #370

## Plan
No core or contract change: the plugin listens to the raw port itself, as midi-watchdog already does
(`web/src/game/midi-watchdog/index.ts:94-110`: the same port pick as core, `addEventListener("midimessage")`, so
core's `onmidimessage` keeps working). Three small PRs, in this order:
1. `fix(sheet-xml)`: `chartToMusicXml(chart, song, pedal?)` takes `{ startBeat, endBeat }[]` and writes each span
   as a `<pedal type="start" line="no" sign="yes"/>` and a `type="stop"` direction, `placement="below"`, staff 2,
   at its 16th. Without `pedal` the output is byte for byte today's.
2. `fix(sheet-view)`: `SheetMessage` gains `{ type: "pedal"; spans: { startMs, endMs }[] }`; the sheet re-renders
   the shown chart with those spans (once, as a zoom does, judgments repainted); a new take clears them. Its
   `__pianoArcadeSheet` gains `pedals`: the count of OSMD's rendered pedals (`StaffLine.Pedals`, OSMD 2.2.0).
3. `feat(pedal-lamp)`: `web/src/game/pedal-lamp/` (the CC rule, the plugin, the lamp, tests,
   `verify-pedal.mjs`), one line in `layers.ts` after `hud()`, and the done note.

## Requirements
- **The rule**, from the spike (`spikes/piano-midi/RESULTS.md`, Sustain pedal): CC 64 comes as a ramp of values on
  channel 1 and a copy on channel 2. Only `0xB0` (channel 1), controller 64 counts: down at a value of 64 or more,
  up below 64. Channel 2's copy, CC 67 and every other message change nothing.
- **Attach** when /play's MIDI device starts (`wrapInput` on the `midi` device, as midi-watchdog), detach at
  `songEnd` and `quit`. Laptop keys and `input=test` never light it.
- **The lamp:** while the pedal is down, `Ped.` (the score's mark) lit in ink in the HUD band's top-right gutter
  (`hudSettings.statusGutterPx`), under beat-track's status line; up, nothing is drawn. At least 24 px at 1920×1080.
  It's game, not setup: capture mode keeps it. Test hook: `window.__pianoArcadePedal = { down, spans }`.
- **Spans:** each down–up pair in chart time, the clock of the first drawn frame after the message (`frame.nowMs`),
  clamped to 0 during the count-in; a pedal still down at `songEnd` ends there. At `songEnd` the plugin posts the
  spans on sheet-view's channel (`pianoArcade.sheet`), in the chart's beats; a span under one 16th after rounding is
  dropped.

## Validation
- `pnpm -C web test`: the rule on the spike's ramps (`03 14 25 37 3F 7F` is down at `7F` only; `4A 3A 22 0B 00` is up
  at `3A`); `B1 40 7F` and `B0 43 7F` change nothing. sheet-xml: Ode to Joy with a span over beats 0–4 has one start
  and one stop on staff 2; with no span, every existing sheet-xml test passes unchanged.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/pedal-lamp/verify-pedal.mjs --out <dir>`: prints `verify-pedal: pass` and exits 0, or names
  each failed step and exits 1. One context: `/sheet?song=ode-to-joy` open, then
  `/play?song=ode-to-joy&from=1&to=4&passes=1&midi=sim`, Start. Bytes go in as piano-sim's `send` command on its
  channel (`pianoArcade.sim`):
  1. `B1 40 7F` alone -> `__pianoArcadePedal.down` stays `false` (so the check can fail).
  2. `B0 40 7F` in bar 1 -> `down` is `true`; screenshot of the HUD band. `B0 40 00` in bar 3 -> `false`.
  3. The take ends by itself -> `spans` has one entry; the sheet's `__pianoArcadeSheet.pedals` is 1. The same run
     with no CC sent gives 0. Screenshots of the band (lamp on) and the sheet at 1280×720 and 1920×1080.
- `verify.py --slug pedal-lamp` passes, and `node web/src/game/sheet-view/verify-sheet.mjs` still passes.
- On the piano (Eric; mark it in the done note): hold the pedal through Ode to Joy's first two bars; does the lamp
  follow your foot, and do Ped. and the star land under those bars?

## How it's built and checked
Follow `specs/context/visual-direction.md`: ink, no new color, and the lamp doesn't move. Build with the
`frontend-design` skill. Review with taste v2's step 8, "Look": 1280×720 and 1920×1080, plus reduced motion.
Before and after screenshots of the HUD band and `/sheet` go in the PR.

## Defaults
- Marks come at the take's end, not live: one re-render, since OSMD renders a dense chart slowly.
- If OSMD draws a bracket instead of the text marks, keep what it draws and log it.
- No latency offset on pedal times: marks are rounded to 16ths. sheet-review's stored reviews carry no pedal.
- Log choices the spec doesn't make in `specs/decisions/pedal-lamp-*.md`.
