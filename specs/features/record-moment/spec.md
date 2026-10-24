---
name: "Record moment: NEW RECORD stamps in gold after the rank, with an arcade high-score entry"
depends_on: ["records", "rank-stamp", "results-layout"]
owns: ["web/src/game/record-moment/"]
assignee: "eric"
---

# Record moment

A new record is one of the screen's loud moments (`specs/context/visual-direction.md`), and today it's a blinking
28 px line inside the records card, below the fold (`changes/results-layout.md`, Gaps). Its initials prompt is a
monospace "Your initials: _ _ _". This makes it a moment in the first view. Once the rank has stamped, NEW RECORD
stamps in gold, and the initials entry reads like an arcade high-score table: three big letter cells, the current one
lit. It's a strong beat for the video and for a judge's first try.

Issue: #380

## Plan
Five small PRs, in this order, the done note last. The order keeps main from ever showing two initials entries, or
none, on a NEW RECORD take.
1. `refactor(records)`: export the take's `Outcome` for the moment to read, and move the key handling into an
   exported `useInitials(chartId, date)` hook. No behavior change; the pin is `verify-records.mjs`, passing before and
   after. `chartId` is the key records saved the take under (easy-charts' `recordKey`, `<id>@easy`, once its
   `fix(records)` lands): the moment never builds its own key.
2. `feat(record-moment)`: `web/src/game/record-moment/` holds the timing (pure), `<RecordMoment />` and the plugin,
   with tests. The plugin's results panel shows the moment only for a recorded take with `newRecord`, and null
   otherwise. Not registered yet. No done note.
3. `fix(records)`: on a NEW RECORD take, the records card drops its own NEW RECORD line and its entry; it keeps the
   top 5, with this take's initials as they're typed. Any other top-5 take keeps today's entry in the card. The same
   PR adds record-moment's line to `layers.ts` (an open file), so the entry moves in one merge.
4. `fix(results-layout)`: `featured` becomes `["record-moment", "take-graph"]`, so the moment sits above the graph in
   the first view.
5. `feat(record-moment)`: `verify-moment.mjs`, the screenshots and the done note.

## Requirements
- **When:** a take records' `addTake` marks `newRecord`. Never on a practice take or when storage is blocked: records
  already decides both.
- **Timing:** it starts when the rank stamp ends (`stampStartMs() + stampSettings.durationMs`, 1.5 s after the
  results show). NEW RECORD stamps in Saira 900 italic, in `--pa-gold`, with rank-stamp's curve (`stampKeyframes`,
  about 300 ms, one overshoot). Then the three cells rise in, 150–250 ms ease-out. Everything has settled within 2 s
  of the moment's start. Nothing loops or blinks after that, except the lit cell's cursor.
- **Entry, keyboard first:** the same keys as today (A–Z, ↑ ↓ to cycle, Backspace, Enter saves three letters), live
  from the moment's first frame. Typing during the reveal isn't lost. Enter saves the initials rather than pressing
  Retry, as today, and then focus is back on Retry. Each cell is at least 24 px tall at 1920×1080. The saved state
  reads `ERI · saved`.
- **Test ids move with the entry:** the moment carries records' `data-testid="new-record"` and
  `data-testid="initials-entry"`, and the card drops them on a NEW RECORD take, so `verify-records.mjs` passes
  unchanged.
- **Reduced motion:** the stamp and the cells are shown at once in their end state. The cursor is a static underline.
- **First view:** the results still open with no scroll at 1280×720 and 1920×1080, Retry included
  (results-layout's check). If the graph no longer fits beside the moment, a NEW RECORD take moves the graph to the
  details for that take only.

## Validation
- `pnpm -C web test` (record-moment): the start is `stampStartMs() + 300` and the end at most 2 s later. The moment
  shows for `newRecord` and not for `inTop` alone, practice or blocked. The keys typed before the cells appear are
  kept.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/record-moment/verify-moment.mjs --out <dir>`. It prints `verify-moment: pass` and exits 0, or
  names each failed step and exits 1. One fresh profile, `/play?song=twinkle&input=test&beat=off&stage=off`, notes
  pressed as `records/verify-records.mjs` presses them, at 1280×720 and 1920×1080:
  1. A Perfect take -> `[data-testid=record-moment]` is inside the viewport with no scroll at 3.5 s after the
     results show. Type E, R, I during the reveal, then Enter -> the moment reads `ERI · saved`, the top 5 has ERI,
     and Retry is `document.activeElement`.
  2. A worse take -> no moment.
  3. Reduced motion, a fresh profile, a Perfect take -> the moment is visible with no running animation.
  On main today step 1 fails: there's no moment. Keep screenshots of each step and a 4 s video of step 1.
- `node web/src/game/records/verify-records.mjs --out <dir>` and `verify.py --slug record-moment` pass. Eric (mark it in the done note): two Twinkle takes on the piano, the better one second. Does the moment feel like
  an arcade's?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
`design-taste-frontend`'s step 8, "Look", at 1280×720 and 1920×1080 plus reduced motion, as frames at 1.5, 2.0 and
3.5 s. Before and after screenshots go in the PR.

## Defaults
- Silent: no new sound. ui-sounds or juice-sound may add one later in their own PR.
- A full combo and a new record on one take: the rank stamp, then the moment. clear-card ends before the results.
- Nothing is prefilled; leaving without Enter keeps `---`, as records does. Log choices in `specs/decisions/record-moment-*.md`.
