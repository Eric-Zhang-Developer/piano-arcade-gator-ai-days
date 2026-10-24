---
name: "Easy charts: every song gets an Easy level derived from its chart, picked with E on the select"
depends_on: ["difficulty", "select-layout", "records", "ghost", "core-loop"]
owns: ["web/src/game/easy-charts/"]
assignee: "eric"
---

# Easy charts

Most songs are Lv 10 and up, out of reach on laptop keys. A pure function derives an Easy chart from each one, with
no hand-edited data, so a judge can play Chopin on a laptop. Records stay separate per level.

Issue: #358

## Plan
Small PRs, in order; the done note merges last.
1. `feat(easy-charts)`: `easyChart` with tests on all ten charts; the plugin (`transformChart` on `level=easy`), one
   line in `layers.ts` **first**, before `chunkPractice()`, so every later plugin sees the Easy chart; `useLevel()`,
   `withLevel(href, level)` and `<LevelToggle />`.
2. `fix(records)`: a take's key is `recordKey(chart.id, params)`, `<id>@easy` with `level=easy`, else `<id>`.
   `fix(ghost)`: `level` joins `CHART_PARAMS`. One line each, either order.
3. `fix(select-layout)`: E toggles the level, `<LevelToggle />` sits by the focus panel's Level stat, card hrefs and
   L's URL go through `withLevel`, `best` is looked up by `recordKey`, and the hint gains `E easy`.
4. `feat(easy-charts)`: `verify-easy.mjs`, screenshots and the done note.

## Requirements
- **`easyChart(chart)`**, pure, in three steps:
  1. **Chords:** of one hand's notes that start on the same beat, keep the highest pitch.
  2. **Hands:** both only if every remaining pitch is on the laptop keys (the values of core's `keyMap(lowest pitch)`
     in `web/src/game/core/input.ts`, no Z/X); else the right hand, or the left if there's no right.
  3. **Runs:** in time order (right before left on a tie), drop any note that starts less than
     `1000 / easySettings.maxNps` ms (`maxNps: 4`) after the last kept one, at the chart's bpm.
  It returns `{ ...chart, notes }`, every kept note unchanged: no new pitch, moved note or new id.
- **On /play:** `level=easy` plays the Easy chart. Any other value, or none, leaves the chart alone. The stage card
  and the WARNING card show the Easy chart's level, since they compute it from the chart they get.
- **On the select:** the level is global, in `localStorage["pianoArcade.level"]` (`easy`, or absent for Normal). E
  (plain e or E, no Ctrl/Meta/Alt, no repeat) and the toggle switch it. The toggle reads `NORMAL Lv <n> · EASY Lv <m>`,
  with the Easy number from `difficulty(easyChart(chart))` once the focused chart has loaded. It's a button with
  `aria-pressed`, reachable with Tab. Blocked storage means it lasts for the page only.
- **Records:** an Easy take saves under `<id>@easy` (own best and top 5); with Easy on, the cards show the Easy best.

## Validation
- `pnpm -C web test`, on every `web/public/songs/*/chart.json`:
  - each Easy note deep-equals a Normal note;
  - no two kept notes start less than 250 ms apart, and no hand has two notes on one beat;
  - at least one note and no more than Normal, a level at most Normal's, and with both hands kept, all on the laptop;
  - Twinkle's Easy chart equals Normal, and `chopin-prelude-4`'s Easy pitches are all on the laptop keys.
  Synthetic: C-E-G on one beat keeps G; eight 16ths at 120 bpm keep four; two hands wider than the laptop keys keep
  the right. It prints each chart's Normal and Easy counts and levels. `recordKey`: `fur-elise@easy`, or `fur-elise`.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/easy-charts/verify-easy.mjs --out <dir>`. It prints `verify-easy: pass` or names each failed step:
  1. `/play?song=chopin-prelude-4&input=test` has as many notes as its `chart.json`. With `&level=easy` it has
     fewer, every id is in `chart.json`, and pressing every note gives 100%.
  2. After a perfect Easy take of Twinkle, records hold `twinkle@easy` and no `twinkle` entry.
  3. On `/`, E makes the toggle read Easy, and the focused card's href ends in `&level=easy`. After a reload it's
     still Easy. E again removes it.
  4. Screenshots of the toggle in both states at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug easy-charts` passes, Normal unchanged. Eric (mark it in the done note): Chopin Easy on laptop
  keys, Für Elise Easy on the piano. Fun, and still the song?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with design-taste-frontend's
step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- **The static keyboard (#384):** an Easy take keeps the song's own keyboard, the range of the chart as loaded, the
  same at either level (`specs/decisions/easy-charts-keyboard.md`). The laptop map starts at the Easy chart's lowest
  pitch, as /play builds the keys device from the chart it plays. Nothing here zooms or follows. A planner's scratch run of these rules on `c10fc30` left four Easy charts wider
  than the laptop map (clair-de-lune, maple-leaf-rag, moonlight-3, nocturne-op9-2): those need Z / X.
  Narrowing them to the laptop is not this spec.
- **4 notes per second is a starting value,** not a finding. The left hand keeps its top note too, as asked. If its
  bass sounds wrong to Eric, keep its lowest note instead.
- **Gaps until others carry the level** (song-options and watch-demo are backlog): the preview's LEARN and PRACTICE
  links, and weak-bars' and chunk-practice's whole-song links, which keep only `song` and `hands`. The cards' LEVEL
  boxes keep the Normal level. Log other choices in `specs/decisions/easy-charts-*.md`.
