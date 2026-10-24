---
name: "Practice report: after the last chunk, the run's chunks, tries, hardest bars and time"
depends_on: ["chunk-practice", "bar-loop", "results-layout"]
owns: ["web/src/game/practice-report/"]
assignee: "eric"
---

# Practice report

Clearing a song's last chunk ends on "Play the whole song" with no look back. A short report closes the practice
story: how many tries each chunk took, which bars took most (one click loops them with bar-loop), and the time spent.

Issue: #363

## Plan
Three small PRs, in this order:
1. `feat(practice-report)`: `web/src/game/practice-report/`: `run.ts` (pure: add a take to a run, summarize it),
   a plugin and its results panel, tests. One line in `layers.ts` right after `chunkPractice()`, so it sees the
   whole chart. It reuses chunk-practice's `chunksOf`, `practiceStep`, `nextAfter` and `barsLabel`
   (`web/src/game/chunk-practice/chunks.ts`) and changes none of chunk-practice's files. No done note.
2. `fix(results-layout)`: `practiceFeatured` becomes `["chunk-practice", "practice-report"]`, so the report shows
   in the first view with the rank. A practice step that isn't the end renders no report, so nothing else moves.
3. `feat(practice-report)`: `verify-report.mjs`, screenshots and the done note.

## Requirements
- **The run** (sessionStorage `pianoArcade.practiceRun`, this tab only): `{ chartId, hands, chunks: { [from]:
  { learn, play } }, ms }`. A chunk-practice step's `songEnd` adds one `learn` or `play` to its chunk and the take's
  wall time (`performance.now()` from its `songStart` to its `songEnd`, pauses included) to `ms`. A take quit from
  the pause menu has no `songEnd` and isn't counted. A step for another `chartId` or `hands`, or any step after a
  report was shown, starts a new run.
- **The report** shows only on the last chunk's play step when it clears (`nextAfter` gives `{ whole: true }`):
  - one line: `3 chunks · 7 tries · 4:12` (tries are play takes; time as m:ss);
  - a strip, one cell per chunk: its bars and its tries; a chunk with no takes in this run reads `—`, and the line
    then says `2 of 3 chunks practiced`;
  - the chunk with the most play tries (earliest on a tie) marked, with "Loop bars 5–8" linking to
    `/play?song=<song>&from=5&to=8&tempo=70` (bar-loop's own default passes; `hands` kept when set, no `practice`);
  - every chunk cleared on its first try: "Every chunk on the first try" and no link.
- Storage blocked: no report, and chunk-practice's panel is unchanged. Practice takes stay unrecorded (records).
- Test hook: `window.__pianoArcadeReport = { tries: number[], most: { from, to } | null, ms }` while the report
  shows, else `null`.

## Validation
- `pnpm -C web test`: tries `[2, 1, 1]` mark chunk 1; `[1, 3, 3]` mark chunk 2 (earliest tie); `[1, 1, 1]` gives no
  link; another `hands` starts a new run; a skipped chunk reads `—`; `ms` sums only the takes added; the link keeps
  `hands=L` and drops `practice` and `mode`.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/practice-report/verify-report.mjs --out <dir>`: prints `verify-report: pass` and exits 0, or
  names each failed step and exits 1. One tab, Twinkle's chunk play steps
  (`/play?song=twinkle&from=<a>&to=<b>&tempo=70&passes=1&practice=1&input=test`):
  1. Chunk 1 with `bot=rank-d` (below 85%), then `bot=perfect`; chunk 2 and chunk 3 with `bot=perfect`.
  2. On chunk 3's results: `__pianoArcadeReport.tries` is `[2, 1, 1]`, the link's href is
     `/play?song=twinkle&from=1&to=4&tempo=70`, and `ms` is above 0 and below the script's own elapsed time.
  3. Chunk 3 again with `bot=rank-d` -> no report (`__pianoArcadeReport` is `null`), so the check can fail.
  4. The report at 1280×720 with no scroll on the results screen's first view, and at 1920×1080, kept in `<dir>`.
- `verify.py --slug practice-report` passes.
- On the piano (Eric; mark it in the done note): a whole chunk run of Ode to Joy; does the marked chunk match the
  bars you stumbled on?

## How it's built and checked
Follow `specs/context/visual-direction.md`; the strip reads like weak-bars' cells, and nothing animates past a
1.2 s tally. Build with the `frontend-design` skill. Review with taste v2's step 8, "Look": 1280×720 and
1920×1080, plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- Tries count play takes only; learn takes add time. Wall time, not chart time: wait mode's holds are practice too.
- No history across tabs or days: the report is this run's. learn-progress keeps what lasts.
- Bot takes count here (unlike learn-progress, which lasts): a run is one tab's, and the headless check needs them.
- `fix(results-layout)` conflicts with sheet-review's one-line change to the same settings: rebase, keep both.
- Log choices the spec doesn't make in `specs/decisions/practice-report-*.md`.
