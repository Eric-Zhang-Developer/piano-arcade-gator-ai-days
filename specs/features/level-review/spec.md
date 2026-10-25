---
name: "Level review: every song's level checked against a published grade, one cited line per song, the formula kept"
depends_on: ["difficulty", "easy-charts"]
owns: ["specs/features/level-review/", "changes/level-review.md", "specs/decisions/level-review-"]
assignee: "eric"
---

# Level review

Issue #1379. Eric, 2026-10-25: "why ... is Fantasy Impromptu level 11? ... We need a manual lookover at the leveling.
There's no way Prelude in C Sharp Minor is ... the same level as Fantasy Impromptu." Then: "Correct. A manual review
is in order." Then: "I'll just approve it, man. We don't have much time for manual overview again. Human attention is
the bottleneck."

So **the worker does the review, not Eric**. Every song in the select gets a level checked against a published grade,
one cited line per song. The table merges on green like any reversible change: there's no review page and no wait for
a person (docs/incidents/2026-10-25-duo-hud-merge-gate.md: no spec holds a merge for a person's pick). The old-to-new
table goes in the PR body, so Eric can glance at it later.

**What's wrong today.** A run of `difficulty.ts` on main (a port of it over every chart, 2026-10-25) gives:
- `chopin-fantaisie-impromptu` 11 = `rachmaninoff-prelude-cs` 11 = `debussy-arabesque-1` 11;
- `entertainer` 12 and `maple-leaf-rag` 14 sit above the Fantaisie-Impromptu, while Henle rates it 7 of 9 (below);
- `clair-de-lune` 3 = `ode-to-joy` 3. The Clair de lune chart is a 79-note opening excerpt at 60 BPM, though its
  `catalog` doesn't say so.

The formula reads speed and reach from the chart, so it can't see what makes a piece hard to play: voicing,
four-against-three, and how hard it is to read. Published grades can.

## Plan
1. **One `feat(level-review)` PR.** `check_ownership.py` widens a feature's PR to the `owns` of the other features in
   its lane, and `difficulty` (which owns `web/src/game/difficulty/`) is `eric`'s like this one. So that title may
   change the difficulty folder. Before you start, check that no open PR touches `web/src/game/difficulty/`
   (`gh pr list`, then each PR's files); none did on 2026-10-25. A `fix(difficulty)` title would allow the code but
   not `changes/level-review.md`, so the feature could never be done, and packs 9 and 10 wait on it.
2. **Look up each song's grade** (Requirements). Each lookup is research: spawn subagents for it, a batch of songs
   each, and have each one return the URL it read and the grade printed there. Don't take a grade from memory, a
   forum or a retailer.
3. **Write the table and the shift** in `web/src/game/difficulty/`, with the unit test.
4. **The PR body** carries the whole table, sorted by new level: id, title, old level, new level, the grade and its
   URL. That's Eric's later glance; it waits on nobody.

## Requirements
- **Where it lives:** a new `web/src/game/difficulty/reviewed.ts` next to `difficulty.ts`, with one row per song:
  ```ts
  // id -> the reviewed level. old: the formula's level when the row was written.
  export const reviewedLevels: Record<string, { old: number; level: number; grade?: Grade; note?: string }> = {
    "chopin-fantaisie-impromptu": { old: 11, level: 14, grade: { scale: "henle", value: 7, url: "https://www.henle.de/de/Fantaisie-Impromptu-cis-moll-op.-post.-66/HN-1320" } },
  };
  ```
  The planner read that example's page: Henle's HN 1320 gives "Schwierigkeitsgrad 7 schwer". Its level is the
  mapped grade before any excerpt step (below), which is yours to set. `Grade` is
  `{ scale: "henle" | "rcm" | "abrsm"; value: number; url: string }`.
- **Which grade, in order:**
  1. **Henle**, levels 1 to 9 ([Henle's guide](https://www.henle.de/Levels-of-Difficulty/), devised by Rolf Koenen:
     1–3 easy, 4–6 medium, 7–9 difficult). Each edition's page on henle.de prints the level. Use the level of the
     piece or the movement the chart is from, not a volume's range.
  2. **RCM** (Royal Conservatory, Celebration Series or the Piano Syllabus): the grade the syllabus lists the piece
     at.
  3. **ABRSM**: the grade of a syllabus that lists the piece.
  4. **None found:** the formula's level stays. The row says where you looked (`note`), and has no `grade`.

  Each grade is cited by a URL you read. A retailer's copy of a grade doesn't count; Henle's own page does.
- **Grade to level** (the planner's mapping: a judgment, not a published equivalence; log it in
  `specs/decisions/level-review-mapping.md`). Level 1 stays for tunes under any grade, like Twinkle and pack 9:
  - Henle h: level = min(15, 2h). So 1→2, 4→8, 6→12, 7→14, 8 and 9→15.
  - RCM g (Preparatory = 0, Grades 1–10, ARCT = 11): level = 1 + g.
  - ABRSM g (Initial = 0, Grades 1–8): level = 1 + g. A diploma-only piece goes to the next scale or to none.
- **Excerpts:** a grade rates the whole piece or movement, and most charts are an excerpt, many under tempo. A row
  may sit up to 2 levels below its mapped grade, never above, with a `note` saying why (the bars, the tempo against
  the marking). Clair de lune's row says it's the opening only.
- **How the level is applied:** `difficulty(chart)` returns `{ level, formula, inputs }`. `formula` is today's
  computation, unchanged. `level` is `formula + (row.level − row.old)`, clamped to 1–15, for a chart whose id has a
  row; otherwise `formula`.
  - This is a shift, not a lookup. The published chart gets exactly `row.level`, and the Easy chart from
    `easyChart()` (same id) moves by the same amount. So the Easy toggle stays at or under Normal with no change to
    `easy-charts`.
  - Every reader goes through `difficulty()`, so none of them changes:
    - song select's `Lv` and its sort (`song-select/load.ts`, `select-layout`, `song-finder`, `main-page`);
    - the Duo select's LV cell, which reads `Song.level`;
    - the stage card;
    - `play-modes`' WARNING gate and the WARNING card (`warnFrom` 13);
    - the Easy toggle (`easy-charts/level.tsx`).
- **The formula isn't retuned:** `difficultySettings`, the inputs and the weights stay as they are.
- **Which songs:** every chart song select lists. That's each `web/public/songs/<id>/chart.json` outside `LAB_ONLY`
  (`rounds`, `x`). On 2026-10-25 that's 40 songs. Lab charts keep the formula and get no row.
- **Packs 9 and 10 take their levels from this table.** Each pack's PR adds its own rows, by the same rules (the same
  lane widening lets it). The unit test fails a chart with no row, so a pack can't skip it.
- **Existing tests:**
  - "keeps the named rungs in order" calibrates the formula, so it reads `formula`.
  - "puts Twinkle lowest" becomes "no chart's formula level is below Twinkle's", on `formula` too. **Why it's not a
    weakening:** pack 9's very easy tunes sit at Twinkle's level 1, the floor, by Eric's ask. A tie at the floor
    can't be broken. Say this in the PR.
- **`verify-warning.mjs`** expects `moonlight-3` at level 15 with the card shown. If the table moves it, set the
  expectation to the table's level, which must still be 13 or more. Otherwise use the select song with the highest
  reviewed level. It's a scheduled-run check: don't run it locally (AGENTS.md load rule).
- **Not in this PR:**
  - Learning-lane files: no file under `web/src/learn/`. Nothing there reads the level.
    `web/src/learn/frontend/graph/data.ts` mentions only mastery levels, and `song-titles.ts` copies titles.
    `seeko-codes`' open PR #1263 doesn't touch any of these paths.
  - Chart edits. Clair de lune's `catalog` lacks "excerpt"; that's a `fix(song-pack-2)` PR, not this one.
- **No visible-change pass:** this changes the data behind a number already shown, not a `.tsx`, `.css` or draw
  code, so the design rule doesn't apply.

## Validation
- `pnpm -C web exec vitest run src/game/difficulty src/game/easy-charts src/game/song-select src/game/songs`:
  everything passes, plus the new unit test for the table (`reviewed.test.ts`):
  - every select chart has a row, and every row names a select chart;
  - each row's `old` equals that chart's `formula` today, so a re-chart flags its row as stale;
  - each `level` is an integer from 1 to 15;
  - a row with a `grade` has an `https://` URL, and its level is the mapped grade or up to 2 below it with a `note`;
  - a row without a `grade` has `level === old` and a `note`;
  - `difficulty(chart).level === row.level` for each select chart, and `difficulty(easyChart(chart)).level` is at
    most that.
- The worker's spot checks, written in the done note:
  - `chopin-fantaisie-impromptu` sits above `rachmaninoff-prelude-cs`, unless their cited grades say otherwise;
  - `clair-de-lune` sits above `ode-to-joy`;
  - `entertainer` and `maple-leaf-rag` sit where their grades put them.
  A spot check that fails is reported, with the grades that cause it; don't bend a row to pass it.
- `/play?song=moonlight-3`: the WARNING card still shows at the table's level. Not verified locally; main's scheduled
  full run covers it.

## Done note
`changes/level-review.md`, in the usual 3–8 lines. It says where the table lives, how many rows have a Henle, RCM or
ABRSM grade, and how many have none. Its Gaps name every song whose grade couldn't be found, and every row more than 3
levels from its old level. The full old-to-new table is in the PR body, not in the note.

## Defaults
- Two sources disagree (Henle 6, RCM 9, say): Henle wins, and the row's `note` gives the other.
- Several Henle editions print different levels for the same piece: take the one for the edition closest to the
  chart's source, and note the others.
