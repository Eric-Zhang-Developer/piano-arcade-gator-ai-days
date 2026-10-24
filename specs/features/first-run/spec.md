---
name: "First run: a 30-second guided Twinkle with laptop letters and text cues, one link and F away on /"
depends_on: ["song-select", "note-labels", "records", "hud", "stage-card"]
owns: ["web/src/game/first-run/"]
assignee: "eric"
---

# First run

A judge who has never played sits down at `/` and has to guess what falling notes mean. One guided song teaches it:
Twinkle (Lv 1, 42 notes, 12 bars at 100 bpm, about 29 s), with laptop letters on the keys and short text cues at the
moments they apply.

Issue: #357

## Plan
Small PRs, in order; the done note merges last.
1. `feat(first-run)`: in `web/src/game/first-run/`, `cues.ts` (pure: events and chart time to the cue), the plugin
   (start panel and cue layer) and `<FirstRunLink />`, with tests; one line in `layers.ts` after `hud()`.
2. `fix(song-select)`: `web/src/app/page.tsx` renders `<FirstRunLink />` beside `<OptionsDrawer />`.
3. `feat(first-run)`: `verify-first-run.mjs`, screenshots and the done note.

## Requirements
- **URL:** `/play?song=twinkle&firstrun=1&labels=keys`. note-labels' `?labels=keys` puts laptop letters on the keys
  and the notes, and doesn't store them. Without `firstrun=1` the plugin does nothing.
- **Start panel:** "Your first song · about 30 seconds · press the key shown on each note as it touches the line".
  Start keeps its focus.
- **Cues,** one at a time, each at most 2 s once shown (visual-direction: moments are short):
  1. From `songStart` until 1.5 s before the first note: "Notes fall toward the line".
  2. Then, until the first note's judgment: "Press A when it touches the line". The letter comes from note-labels'
     `laptopLetters(lowest pitch)` for the first note.
  3. The first judgment: PERFECT gives "That was PERFECT!". GREAT or GOOD gives its own word: "GREAT, a little early"
     or "GOOD, a little late" (by the sign of `offsetMs`). A MISS gives "Missed: press as it touches the line".
  4. The first `combo` of 5: "5 in a row. Keep going!" Hook: `window.__pianoArcadeFirstRun = { cue, seen }` (ids).
  Drawn on the plugin's layer, centered, between the HUD band's bottom and the height where a falling note is still
  1 s from the line (`judgmentLineY × (1 − 1000 / lookaheadMs)`: half-way with core's 2000 ms lookahead). So a cue
  never covers a note due within 500 ms (juice-visual's rule). Display face, at least 24 px at 1920×1080. They fade in 150–250 ms; under reduced motion they show and hide at once.
- **Results:** the normal results screen, with its own Retry and Songs. The take is recorded like any Twinkle take.
- **The link on `/`:** a small "First time? 30-second first song" link, always shown, that never takes focus and
  doesn't cover the song list, the focus panel or the Options button. F (no modifier, no repeat; ignored inside a
  `dialog`, `input` or `textarea`) opens the same URL. No stored flag and no offer panel: Eric's laptop has records,
  so an offer for empty records would never show at judging.

## Validation
- `pnpm -C web test`: on Twinkle's chart, a scripted event list gives cues in order `fall`, `press`, `perfect`,
  `combo5`. A first GREAT at +40 ms gives `late`, and a first MISS gives `miss`. The press cue's letter is A (C4 is
  Twinkle's lowest pitch). Without `firstrun=1` the plugin returns no cue.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/first-run/verify-first-run.mjs --out <dir>`. In a fresh profile, it prints
  `verify-first-run: pass` or names each failed step:
  1. `/` shows the link while `document.activeElement` is still `song-twinkle`, and ↓ still moves the list.
  2. The link opens the URL above. With `&input=test` and every note pressed on time, `seen` is
     `fall, press, perfect, combo5`, and the results screen shows.
  3. Back on `/`, F opens the first-run URL; F with the Options drawer open doesn't.
     `/play?song=twinkle&input=test` leaves `__pianoArcadeFirstRun` unset.
  4. Screenshots of the link, cues 1–3 and the results at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug first-run` passes. Stranger's run (Eric; mark it in the done note): someone who has never
  played gets the laptop at `/`. Unhelped, do they finish Twinkle? Which cue did they miss?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with design-taste-frontend's
step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- Cue wording and timing are starting values; Eric edits them after the stranger's run. Log choices the spec
  doesn't make in `specs/decisions/first-run-*.md`.
- Cut from the first draft: the one-time offer (it keyed on empty records, which Eric's laptop never has) and a
  first-run results panel (results already has Songs). Add either back only if the stranger's run asks for it.
- On the piano the cue still names the laptop letter. Twinkle at 100%: a slower tempo would make it practice.
