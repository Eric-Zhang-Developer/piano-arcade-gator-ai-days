---
name: "Attract scores: one timed HIGH SCORES screen of records' top entries between cabinet demos"
depends_on: ["cabinet", "records"]
owns: ["web/src/game/attract-scores/"]
assignee: "eric"
---

# Attract scores

The cabinet's loop is title, attract (`/attract`), the demo, then the title again (`changes/cabinet.md`). It never
shows what the booth's players scored. An arcade cabinet shows its high-score table after the demo, and that's what
invites the next player. Games started from the cabinet (`?cabinet=1`) are records, and the demo bot isn't, so the
table holds only people.

Issue: #376

## Plan
1. **`feat(attract-scores)`:** add `web/src/game/attract-scores/` with a pure `scoreRows(records, charts)` and a
   `<HighScores rows>` screen, with tests. Nothing mounts it yet.
2. **`fix(cabinet)`:** `loop.ts` gains a `scores` phase: demo, then scores, then title. `Timers` gains `scoresMs`,
   `?scores=N` shortens it for checks, and it's 0 when there are no rows. At 0, the demo goes straight to the title.
   `page.tsx` reads records once per scores phase (`loadRecords(browserStorage())`), fetches
   `/songs/<id>/chart.json` for each id in them, and renders `<HighScores>` in place of an iframe. Keys and the piano
   act as in every phase: a laptop key opens song select, a piano key starts a game. That's the skip.
3. **`feat(attract-scores)`:** the verify script, screenshots and the done note.

## Requirements
- **Rows** (`scoreRows`): one per song with at least one entry in its `top`, using records' `byScore` first entry:
  the song's title, the entry's initials as stored (`---` stays `---`), its score and its rank. Songs are in the
  music select's order (`difficulty(chart).level`, then title), and there are at most 10 rows. An id whose chart
  doesn't load is dropped. Blocked or corrupt storage gives no rows. A score is never made up.
- **Timing:** `scoresSeconds: 10` in `cabinetSettings`, beside `resultsSeconds`.
- **The screen:** HIGH SCORES in the display face (Saira 900 italic), on the cabinet's sky gradient. Rows are title
  (left), initials, score (tabular figures, `en-US` grouping) and rank. Ranks are in `--pa-gold`, the records color.
  Chrome is in `--pa-magenta` and `--pa-cyan`, never mint or azure. Ten rows fit at 1280×720 with no scroll, and every
  word is at least 24 px at 1920×1080. Rows come in with a short stagger (150–250 ms, ease-out, at most 1.2 s in
  total). With reduced motion they're all shown at once.
- `data-testid="cabinet-scores"` on the screen. `data-phase` on `/cabinet` reads `scores` during it.

## Validation
- `pnpm -C web test`. Two songs with entries and one with none give two rows, in level order. The higher score leads
  over the later date, and `---` stays. Eleven songs give 10 rows. Empty, `null` and corrupt records give []. In
  the loop, after the demo's results it's scores, then the title after `scoresMs`. With `scoresMs` 0 it's demo to
  title. A key in scores goes to `keyUrl`. Cabinet's existing tests pass.
- Headless, from a clone: `node web/src/game/attract-scores/verify-scores.mjs --out <dir>` starts its own dev server
  and prints `verify-scores: pass` (exit 0), or names each failure (exit 1):
  1. Seed `pianoArcade.records` with Twinkle (ERI 10,800 S, and a `---` below it) and Für Elise (`---` 5,250 B). Open
     `/cabinet?title=1&attract=1&scores=4`. After the demo, `data-phase` is `scores`, with two rows in level order:
     Twinkle ERI 10,800 S, then Für Elise `---` 5,250 B. Four seconds later it's `title`.
  2. A laptop key during scores opens `/`.
  3. With empty storage, `data-phase` never reads `scores`.
  4. Screenshots at 1280×720 and 1920×1080, plus reduced motion, with 10 seeded rows, kept in `<dir>`.
- `node web/src/game/cabinet/verify-cabinet.mjs --out <dir>` passes (fresh profile: no records, so no scores phase).
  So does `verify.py --slug attract-scores`.
- At the booth (Eric; mark it in the done note): play Twinkle from `/cabinet`, enter initials, and leave it. The
  next loop shows your score after the demo.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2
(`design-taste-frontend`) step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots
go in the PR.

## Defaults
- Each song's top entry only: one screen. A per-song top 5 is records' results panel.
- 10 s is a starting value, and Eric tunes it at the booth. With more than 10 songs played, the first 10 in select
  order show.
- No sound on this screen, so the piano stays quiet between the demo and the title.
