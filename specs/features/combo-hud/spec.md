---
name: "Combo in the HUD: the combo moves off the lanes into the panel's center"
depends_on: ["hud", "hud-skin"]
owns: ["web/src/game/combo-hud/"]
assignee: "eric"
---

# Combo in the HUD

The giant combo draws over the notes at 20% (`changes/hud.md`), against the direction's "judgments and combo off
the lanes". Since #245 the judgment word sits top center just under the HUD band and the fever strip, over that
combo, and its ms readout overlaps the combo's digits. Moving the combo into the band clears both.

## Plan
1. **A `fix(hud)` PR** (`web/src/game/hud/index.ts`, `hud.test.ts`): today the song card fills 0–30% of the width
   and the counters 30–64%, so the panel has no center. `hudLayout` returns each slot's x-range, the combo draws in
   the center slot, and `drawHud` fits each slot's text with `fitText`. The swell stays in hud's code.
2. **`feat(combo-hud)`:** the done note and screenshots, as hud-skin did (#200 after its `fix(hud)` #206).
   `web/src/game/combo-hud/` stays empty unless a helper outgrows hud.
- **drawHud order:** this `fix(hud)` lands first. score-rollup depends on combo-hud, so its `fix(hud)` starts from
  this one. wait-hud's `fix(hud)` can land before or between them: the later PR rebases and keeps both.

## Requirements
- The combo (number and its "COMBO" label) draws inside the band, `0 ≤ y ≤ hudLayout(...).panel.h`, centered at
  half the width, swell and ghost clipped to its slot. In the opaque band it draws at full strength, not 20%: Saira
  900 italic, the band's biggest number (bigger than the multiplier's `h × 0.5`). It shows from a combo of 5, as now.
  After this the HUD draws nothing below `panel.h`.
- **No overlaps:** at 1024×768, 1280×720 and 1920×1080 the song card, counter, combo, score and multiplier slots
  don't intersect. Size the score's slot for the widest library score, 214,800 (maple-leaf-rag, 552 notes, all
  PERFECT), and the combo's for three digits. The judgment word and its readout (`judgmentPlace` in
  `core/highway.ts`) stay under the fever strip, so the combo can't meet them.
- **The song card keeps its title readable:** "Twinkle, Twinkle, Little Star" (the default song) draws without
  `fitText` shrinking it at 1280×720 and 1920×1080.
- The band's height, the fever strip's place and the judgment word's place don't change, so fever-gauge's and
  difficulty's layout tests pass unchanged.
- **Swell:** on `comboMilestone` at 50, 100 and 200 (and each later hundred the judge sends), the number swells and
  its ghost fades in the tier color, as today. 25 no longer swells (juice-sound's stinger at 25 stays).
- **Reduced motion:** no swell and no ghost; the number changes in place.
- Every number unchanged: `reduceHud`, hud's reducer tests and `verify-hud.mjs` pass unchanged.

## Validation
- `pnpm -C web test`, at the three sizes: the slots don't intersect and the combo's is centered; the draw, recorded
  with a fake context (`hud.test.ts`'s Proxy, recording `fillText` too) at combo 120, 100 ms after the 100
  milestone: every fill's bottom is ≤ `panel.h`, the combo's number is drawn at `x = width / 2` at full alpha, and no
  fill uses the old 0.2 alpha. A milestone at 25 gives no swell, at 50 one. Under reduced motion the swell scale is 1
  and no ghost is drawn.
- `node web/src/game/hud/verify-hud.mjs --out <dir>` passes unchanged.
- Headless screenshots, kept in the PR: `/play?bot=perfect&beat=off` (Twinkle, max combo 42, so no swell) mid-song
  with a judgment word showing, at 1024×768, 1280×720 and 1920×1080, logging the title's `measureText` width (HUD
  font, in the page) against the card's slot; `/play?song=minuet-g&bot=perfect&beat=off` at
  the 50 and 100 swells (22.2 s and 44.4 s after the first note, well after fever's start at 12.6 s); the Twinkle shot
  again with `reducedMotion: "reduce"`.
- `verify.py --slug combo-hud` passes.
- Eric's eye (mark it in the done note): can you read the combo without looking away from the notes.
  `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with
`design-taste-frontend`'s step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots.

## Defaults
- **The slots:** song card 0–28% of the width; PERFECT, GREAT and GOOD 28–44%; the combo 44–56%; MISS and WRONG
  56–66%; score and multiplier from 66% to beat-track's 120 px gutter. Left to right it still reads PERFECT to WRONG,
  with the combo between what builds it and what breaks it. A narrower card (the first draft's 18%) would shrink
  Twinkle's 29-character title: measure it in the look review before moving the bounds; the no-overlap test holds.
- The combo is much smaller than today's (an em of `min(0.26 × line, 0.22 × width)`: 146 px at 1280×720, 219 px at
  1920×1080) inside a 62–84 px band. If Eric wants it bigger, the band grows in a later spec.
- No new dependencies. Log a choice the spec doesn't make in `specs/decisions/combo-hud-*.md`.

Issue: #257.
