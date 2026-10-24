---
name: Arcade HUD with a giant combo, counters, score and multiplier
depends_on: ["core-loop"]
owns: ["web/src/game/hud/"]
assignee: "eric"
---

# HUD

The arcade numbers, kept off the notes. All five reference studies put the combo and counters above or beside the
highway, never in the lanes (`specs/context/references/*/README.md`). Register as one `GamePlugin` in
`web/src/game/layers.ts`.

## Plan
1. A top panel: the song card (title, composer, catalog) on the left, live judgment counters in the middle, and the
   score on the right (Chunithm chart study).
2. A giant translucent combo number, top center, drawn behind the notes (Nostalgia, Chunithm).
3. A multiplier that changes color by tier, with pips filling toward the next tier (Guitar Hero 3).

## Requirements
- Everything is driven by `GameEvent`s only; the HUD never reads judging internals.
- The counters show PERFECT, GREAT, MISS and extras, and update on every `noteHit`, `noteMiss` and `extra`.
- Score: PERFECT = 100 × multiplier, GREAT = 50 × multiplier, MISS = 0. Multiplier tiers: x1 from a combo of 0, x2
  from 10, x3 from 20, x4 from 30. Each tier has its own color, and the pips show progress to the next tier.
- The combo number only shows from a combo of 5. On each `comboMilestone` it swells and a translucent ghost of the
  number fades out behind it over about 1 s.
- Nothing in the HUD covers the lowest 40% of the highway, where notes are about to land.

## Validation
- Vitest: feed a scripted `GameEvent` list (10 PERFECT, 1 MISS, 25 GREAT) to the HUD's state reducer; the counters,
  combo, multiplier and score come out exact.
- `verify.py`: the verify run's results screenshot, plus a mid-song screenshot showing the HUD.
- Eric checks readability on the piano: is the combo readable without looking away from the notes?

## Defaults
- Fonts and colors: match the dark Synthesia base; ask nothing, log the choice in a decision file.
