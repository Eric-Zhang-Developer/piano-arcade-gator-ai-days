---
name: "Learn progress: chunks cleared of total and the last practice date on the music select"
depends_on: ["chunk-practice", "song-preview"]
owns: ["web/src/game/learn-progress/"]
assignee: "eric"
---

# Learn progress

Chunk practice walks a song in pieces, but nothing remembers how far you got: the select shows the best grade and
nothing about practice. Eric wants the game to teach; progress you can see is what brings a learner back.

Issue: #362

## Plan
Three small PRs, in this order:
1. `feat(learn-progress)`: `web/src/game/learn-progress/`: `store.ts` (pure add and read over one localStorage key,
   as records' `store.ts` is), a plugin that writes it, `<LearnProgress id />` for the select, tests. One line in
   `layers.ts` right after `chunkPractice()`, so its `transformChart` sees the whole chart. No done note.
2. `fix(song-preview)`: `SongPreview` renders `<LearnProgress id={id} />` in its row, after Best.
3. `feat(learn-progress)`: `verify-progress.mjs`, screenshots and the done note.

The write is this feature's own plugin, not a `fix(chunk-practice)`: it reuses chunk-practice's exported `chunksOf`,
`practiceStep` and `nextAfter` (`web/src/game/chunk-practice/chunks.ts`) and changes none of its files, so the store
and its only writer sit in one folder. To undo, move the `onEvent` into chunk-practice's plugin.

## Requirements
- **Store** (`pianoArcade.learnProgress`): `{ [chartId]: { [hands]: { cleared: number[], of: number, bars: number,
  at: string } } }`, keyed by `chart.id` as records is. `cleared` is the cleared chunks' `from` bars, unique and
  sorted; `of` the chunk count; `bars` is `chunkSettings.bars` when written; `at` is ISO.
- **Written** on `songEnd` of a chunk-practice step (`practiceStep` not null), for that take's `hands` (`both`
  when absent): any step sets `of`, `bars` and `at`; a play step at the gate (`nextAfter` not null) also adds its
  chunk. A miss below the gate never removes a clear. Nothing else writes: plain takes, bar-loop takes without
  `practice=1` and bots (`bot`) don't count, as records skips them.
- **Shown** on `/`, in the focused song's preview row after Best: `Chunks 3/12 · today` (`yesterday`, else `Oct 24`
  in local time), from the hands entry with the latest `at`; one hand adds its letter: `Chunks 2/12 R · today`.
  An entry whose `bars` isn't today's `chunkSettings.bars` is ignored. Never practiced, corrupt or blocked
  storage: nothing shows, and the row doesn't shift. The level badge and the cards don't change.
- Another tab's write updates the select (a `storage` subscription, as `useBestGrades` does).
- Test hook: the element has `data-testid="learn-progress"`.

## Validation
- `pnpm -C web test`: clearing chunk 5 twice stores `[5]` once; a learn step sets `at` only; below the gate adds
  nothing; a `bot` take writes nothing; `bars: 8` is ignored; the label reads `today`, `yesterday` and `Oct 24` for
  dates on a fixed clock; corrupt JSON and a throwing `localStorage` show nothing and don't throw.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/learn-progress/verify-progress.mjs --out <dir>`: prints `verify-progress: pass` and exits 0,
  or names each failed step and exits 1. Fresh profile, Twinkle (3 chunks):
  1. `/`, focus Twinkle -> no `learn-progress` element.
  2. Chunk 1's play step (`/play?song=twinkle&from=1&to=4&tempo=70&passes=1&practice=1&input=test`), every note
     pressed on time through `__pianoArcade.press` -> results; `/`, focus Twinkle -> `Chunks 1/3 · today`.
  3. Chunk 2's play step with no notes pressed (below 85%) -> `/` still reads `Chunks 1/3`.
  4. The same step with `bot=perfect` -> still `Chunks 1/3` (bots don't count), so the check can fail.
  5. Screenshots of the focused column at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug learn-progress` passes.
- On the piano (Eric; mark it in the done note): clear Für Elise's first chunk, then see `Chunks 1/12` on `/`.

## How it's built and checked
Follow `specs/context/visual-direction.md` (the label style of Best, ink not hand colors). Build with the
`frontend-design` skill. Review with taste v2's step 8, "Look": 1280×720 and 1920×1080, plus reduced motion.
Before and after screenshots of `/` go in the PR.

## Defaults
- The focused preview only, not every card: the cards' Best, Notes and Level columns are full.
- No reset control and no sync between devices: one browser's localStorage, as records.
- Log choices the spec doesn't make in `specs/decisions/learn-progress-*.md`.
