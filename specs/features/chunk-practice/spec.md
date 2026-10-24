---
name: "Chunk practice: learn a song 4 bars at a time, then play each chunk judged at 70%"
depends_on: ["wait-mode", "bar-loop", "hand-mode"]
owns: ["web/src/game/chunk-practice/"]
assignee: "eric"
---

# Chunk practice

The quick practice mode Eric asked for: "learning mode at least a short quick practice version" (2026-10-24). Wait
mode and bar-loop both exist, but nothing walks a song in pieces from learning it to playing it judged.

Issue: #254

## Plan
One PR: one plugin in `web/src/game/chunk-practice/`, one line in `layers.ts` **before** `barLoop()`, so its
`transformChart` sees the whole chart (and returns it unchanged). No other feature's files change: every step is a
URL bar-loop and wait-mode already read. **Learn** is `from=<a>&to=<b>&tempo=70&passes=1&mode=wait&practice=1`;
**play** is the same without `mode`. Wait-mode's panels already move between the two, keeping every other param:
"Play it judged" after a learn step opens the play step, and "Learn it first" opens the learn step. Chunk bounds
reuse song-preview's `lastBar` (`web/src/game/song-preview/opening.ts`), the same count bar-loop checks `to`
against. Accuracy is the judge's `results.accuracy`. There's no new judging.

## Requirements
- **Chunks** (`chunkSettings = { bars: 4, tempo: 70, passAccuracy: 0.85 }`): bars 1–4, 5–8, and so on, to the
  chart's last bar; the last may be shorter, down to one bar, and a song shorter than a chunk is one chunk. They
  count the played hand's notes (hand-mode's `handsSetting` and `splitHands`): a chunk where no such note starts is
  skipped, since bar-loop rejects a range with no notes and hand-mode would leave it empty.
- **Way in:** on a plain take's start screen (no `from`, `to`, `mode` or `practice`), a "Practice in chunks" link
  opens chunk 1's learn step. Step links keep every other param (`song`, `hands`), as wait-mode's do.
- **Where you are:** a practice step's start screen reads `Chunk 2 of 3 · learn` or `Chunk 2 of 3 · play at 70%`.
  In the take, the HUD's song card already shows bar-loop's title (`… · bars 5–8 at 70%`). Test hook:
  `window.__pianoArcadeChunk = { from, to, step, chunk, of }` on a practice step, else `null`.
- **After a play step** (results panel): at ≥ 85% accuracy, "Next: bars 9–12" links to the next chunk's learn step;
  after the last chunk, "Play the whole song" links to `/play` keeping only `song` and `hands`. Either one takes
  focus in an effect after mount, so Enter moves on (Retry's `autoFocus` mounts after the panels and would win).
  Below 85%: the accuracy, "85% moves you on", and "Learn bars 5–8 again"; Retry keeps focus. After a learn step,
  wait-mode's "Play it judged" is the next step.
- **Not saved:** practice takes are never records. records' `practiceReason` already skips any URL with `from`.

## Validation
- `pnpm -C web test`: Twinkle (12 bars) gives 1–4, 5–8, 9–12; Für Elise (45 bars) gives 12 chunks, the last bar
  45 alone. No notes in bars 5–8 skips that chunk; a 3-bar chart gives 1–3; with `hands=L`, a right-hand-only chunk
  is skipped. Step URLs keep `hands`. The next step after 0.85 is the next chunk; after 0.849 it isn't.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/chunk-practice/verify-chunks.mjs --out <dir>`. It starts its own dev server, prints
  `verify-chunks: pass` and exits 0, or names each failed step and exits 1. On Twinkle:
  1. `/play?song=twinkle` (no `input=test`, so the start screen stays) -> click "Practice in chunks" -> the URL's
     params are `song=twinkle&from=1&to=4&tempo=70&passes=1&mode=wait&practice=1`, and the start screen reads
     `Chunk 1 of 3 · learn`.
  2. That URL with `input=test`, every note pressed -> results show "Play it judged"; it opens the same URL without
     `mode`, where `__pianoArcadeChunk.step` is `play` and `__pianoArcade.chart.bpm` is 70.
  3. That play step with `bot=perfect` -> "Next: bars 5–8" is `document.activeElement`. With `bot=rank-d` -> no
     Next, "Learn bars 1–4 again" shows, and Retry is focused.
  4. Chunk 9–12's play step with `bot=perfect` -> "Play the whole song", focused, opens `/play?song=twinkle`.
  5. Screenshots of the start screen line and both results panels at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug chunk-practice` passes, plain mode unchanged.
- On the piano (Eric; mark it in the done note): Für Elise's first chunk: learn it, play it at 70%, move on at 85%.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's step 8,
"Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- **4 bars, 70% and the 85% gate are starting values,** not findings: Eric tunes them on the piano (Für Elise's
  4 bars of 3/8 are only 6 beats).
- The learn step runs at 70% too, so "Play it judged" (which keeps `tempo`) lands on the play step with no change
  to wait-mode. To undo, drop `tempo` from the learn URL and add it in a `fix(wait-mode)`.
- No auto-advance: the player moves on with the focused link. No `mode=practice` URL either: nothing outside
  `/play` links to chunks yet. Add one when something does (L on the select), starting at chunk 1.
- A learn step's bar-loop Passes list ("100.0%") goes with wait-hud's fix; this feature doesn't wait for it.
- Log any choice the spec doesn't make in `specs/decisions/chunk-practice-*.md`.
