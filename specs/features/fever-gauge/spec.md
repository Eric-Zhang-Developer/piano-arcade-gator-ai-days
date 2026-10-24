---
name: "Fever gauge: fever reachable on every song, scaled to its length"
depends_on: []
owns: ["web/src/game/fever-gauge/"]
assignee: "eric"
---

# Fever gauge

Today fever starts at a fixed combo of 50 (`FEVER_COMBO` in `web/src/game/core/settings.ts`), so it can't happen on
Twinkle (42 notes). This feature replaces that rule with a gauge that fills from PERFECT and GREAT hits and scales
with the song's length. It also draws the gauge, so players can see fever coming.

## Plan
1. A pure gauge in `web/src/game/fever-gauge/gauge.ts`, with its tests.
2. **A `fix(core-loop)` PR:** the judge emits `feverStart` when the gauge fills, using that function, in place of
   `combo === FEVER_COMBO`. `feverEnd` keeps its current rule, a combo break. `FEVER_COMBO` goes.
3. The gauge meter as a plugin in `layers.ts`. It runs the same function over the events it receives, so the meter
   and the judge always agree.

## Requirements
- **Filling:** a PERFECT adds 1 and a GREAT adds 0.5. A GOOD adds nothing and breaks nothing.
- **Size:** the gauge is full at `clamp(round(notes × fillShare), minFill, maxFill)`, where `notes` counts the chart
  after every `transformChart`. Defaults: `fillShare` 0.25, `minFill` 12, `maxFill` 50. Twinkle fills at 12.
- **Misses:** before fever, a MISS or WRONG halves the gauge. During fever, a combo break ends fever and empties the
  gauge, as fever ends today.
- **Once per fill:** fever can start again after it ends, once the gauge refills.
- **The meter:** drawn on the plugin's own layer, beside the HUD and never over the lowest 40% of the highway (the
  HUD's rule). It shows the fill, and a full, lit state during fever.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.
- **Other plugins:** they listen to `feverStart` and `feverEnd` and don't change. scenes' `fever` bot reads the
  threshold from here once this feature is on `main`.

## Validation
- `pnpm -C web test`: the gauge's size for 42, 200 and 1000 notes (12, 50, 50). Twelve PERFECTs fill Twinkle's
  gauge. A MISS at 10 leaves 5. A combo break during fever ends it and empties the gauge. The judge test in core
  shows a perfect Twinkle take emits `feverStart` once.
- `verify.py --slug fever-gauge`: the Perfect player is still all PERFECT on Twinkle, and fever now starts.
- In Chrome: on `/play`, play Twinkle well -> the meter fills, then fever starts (the stage and edges go hot, the
  sweep plays). Miss one note during fever -> fever ends. Keep a screenshot of fever on Twinkle in the PR.
- On the piano (Eric; mark it in the done note): on Twinkle, fever should come within the first half of a good take.

## Defaults
- Tune `fillShare` before changing the rule.
