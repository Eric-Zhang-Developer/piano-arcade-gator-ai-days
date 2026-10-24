---
name: "Difficulty: a level from 1 to 15 computed from each chart, shown and sorted in song select"
depends_on: []
owns: ["web/src/game/difficulty/"]
assignee: "eric"
---

# Difficulty

Song select still says "Difficulty —". This feature computes a level from 1 to 15 from the chart itself and never
makes one up. Song select shows the level and sorts by it. The top levels get a WARNING card before the count-in
(catalog G05).

## Plan
1. A pure `difficulty(chart)` in `web/src/game/difficulty/`, with its tests.
2. **A `fix(song-select)` PR:** each row shows `Lv N` in place of "Difficulty —", and the list sorts by level, then
   by title. `Song` gains `level`, which `loadSongs` computes at build time.
3. The WARNING card as a plugin in `layers.ts` (Requirements).

## Requirements
- **Inputs, all from the chart:** notes per second over the busiest 10 s window, the share of notes inside chords
  (2 or more notes at the same `beat`), the largest leap within a hand in semitones, the highest pitch minus the
  lowest, and whether both hands play.
- **The rule:** a weighted sum of those inputs, mapped to 1–15 and rounded. The weights live in
  `difficultySettings`. Calibrate them so the charts on `main` keep the order of the rungs their specs name
  (`song-pack-1`: Ode to Joy Easy, Chopin's Prelude Easy-medium, Für Elise Medium; `song-pack-2`'s table once its
  songs land). Twinkle, one hand and 42 notes, sits lowest. No spec gives the Minuet a rung, so it goes where the
  formula puts it. Write the weights and every chart's level in the done note.
- `difficulty` also returns its inputs, so song-preview can show notes per second without computing it again.
- **WARNING card:** at level 13 or above, a full-width card reading "WARNING" with the level shows during the first
  bar of the count-in, drawn on the plugin's own layer. No siren: `mission.md` allows event sounds, and a siren
  would be a new one. It goes in only if Eric asks.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: Twinkle gets the lowest level in the library. A chart with its notes at double speed scores
  higher than the original. Adding left-hand chords raises the level. Every chart under `web/public/songs/` gets an
  integer from 1 to 15. The charts with named rungs keep the rung order above.
- `verify.py --slug difficulty` passes.
- In Chrome:
  1. Open `/` -> every row shows `Lv N`, sorted easiest first.
  2. Open a chart at level 13 or above, or `/play?song=twinkle&warn=1` (a test switch) -> the WARNING card shows
     during the count-in.
- On the piano (Eric; mark it in the done note): play two songs and say whether their levels feel right.

## Defaults
- If the rung order and the formula disagree on one song, keep the formula and say so in the done note. Don't
  hand-set a level.
