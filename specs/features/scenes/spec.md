---
name: "Scenes: scripted takes so every state can be seen, tested and filmed"
depends_on: []
owns: ["web/src/game/scenes/"]
assignee: "eric"
---

# Scenes

Fever has never been on screen. Twinkle has 42 notes and fever needs a combo of 50 (`changes/juice-visual.md`,
`changes/juice-sound.md`). With `?bot=...`, `/play` plays a scripted take, so fever, full combo and every rank show
up on demand. That serves verify screenshots, video B-roll and later features' Validation.

This is one plugin in `layers.ts`. It uses `transformChart` and `wrapInput` only, and core doesn't change.

## Requirements
- `?bot=<name>` replaces the laptop-key input with a scripted device of kind `test`. MIDI stays live. The bot
  starts on its own after the count-in, timed from the `songStart` event, as piano-sim's bot is.
- **Bots**, each deterministic from a fixed seed, so a rerun gives the same results:
  - `perfect`: every note at offset 0.
  - `late`: every note at +40 ms, which is GREAT. The timing panel says late.
  - `sloppy`: a seeded mix of PERFECT, GREAT, GOOD and MISS, plus a few WRONG notes.
  - `rank-a`, `rank-b`, `rank-c`, `rank-d`: seeded mixes tuned so the take lands that rank on Twinkle. `perfect`
    gives S.
  - `fever`: `perfect` on the chart repeated end to end (in `transformChart`) until it holds the fever threshold
    plus 10 notes, so fever starts and runs. It adds no new notes, so never-invent-data holds. If `fever-gauge` is
    on `main`, read the threshold from it.
- `?bot=` with an unknown name shows the names it accepts and plays normally.
- With a piano output and `&audible=1`, the bot's presses also go to the piano as note on and off. Find the output
  the way beat-track does (`name` includes "Portable Grand"). Local Control stays untouched, so a demo sounds like
  someone playing.
- The bot's notes go through core's normal input path, so judging, the HUD, juice and sounds react as they would to
  a person.

## Validation
- `pnpm -C web test`: each bot's press list for Twinkle is the same on two runs. Judged through
  `web/src/game/core/judge.ts`, `perfect` gives S, `late` gives all GREAT with a +40 ms mean, and each `rank-x` lands
  its rank. `fever` reaches `feverStart`. An unknown name falls back to normal play.
- `verify.py --slug scenes` passes (no `?bot` there, so nothing changes).
- In Chrome, with a screenshot of each kept in the PR:
  1. `/play?bot=fever` -> fever starts and the stage and edges go hot.
  2. `/play?bot=perfect` -> FULL COMBO, then rank S.
  3. `/play?bot=rank-c` -> rank C on the results screen.
  4. `/play?bot=late` -> the timing panel says late, by about 40 ms.
- On the piano (Eric; mark it in the done note): `/play?bot=perfect&audible=1` plays Twinkle on the DGX in time
  with the highway.

## Defaults
- Prefer fewer bots over more. B-roll needs `fever`, `perfect` and one rank below S.
- The seeds and mixes live in `scenesSettings` in `web/src/game/scenes/`.
