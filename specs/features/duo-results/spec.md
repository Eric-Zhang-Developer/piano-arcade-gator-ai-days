---
name: "Duo results: data cells, a per-bar strip, a timing histogram and one PRACTICE BARS X–Y"
depends_on: ["duo-tokens", "results-layout", "weak-bars", "bar-loop", "timing-feedback"]
owns: ["specs/features/duo-results/", "changes/duo-results.md", "web/src/game/duo-results/", "specs/decisions/duo-results-"]
assignee: "eric"
---

# Duo results

Issue #648. The results in the Duo look (`specs/context/visual-direction.md`, frame `F-duo-3-results.jpg`). This is
where the tutor visibly decides. The dialogue (#640, Book IV) says the video's conceptual wow needs "one moment on
screen where the tutor visibly decides", and this screen is that moment. Every number on it comes from the take.

## What exists (origin/main, 2026-10-25)
- **`ResultsLayout`** (`results-layout/index.tsx:92-156`): the ceremony (song, rank, tally, score, accuracy, max
  combo), then `timing` (:132), the featured slots, the actions (Retry, the panel buttons, Songs), and a Details grid.
  Its settings are at :13-20.
- **Timing:** `TimingPanel` (`app/play/page.tsx:493`) shows text from `describeTiming` (`timing/index.ts:67`). There
  is **no histogram**. take-graph plots each note's timing.
- **Per-phrase strip:** weak-bars' cells (2 bars a phrase), with the weakest tinted red, and a `weak-bars-practice`
  link (`practiceUrl` :53) that loops it at 80%. `scorePhrases(chart, take, results)` is at `weak-bars/index.ts:36`.
- **Nothing is stored per bar** on the client. `records` keeps the best rank, accuracy and score only.

## Plan
1. **`feat(duo-results)`, part 1:** pure functions with tests in `web/src/game/duo-results/`:
   - `barScores`: weak-bars' scoring with a 1-bar phrase. Reuse `scorePhrases` with the phrase size as a parameter,
     through a `fix(weak-bars)` if needed.
   - `weakestRun`: the weakest run of 1–4 consecutive bars.
   - `histogram`: timing offsets in 10 ms bins, from −100 to +100 ms.
   - `tutorLine`: the template sentence (below).
2. **`fix(results-layout)`:**
   - **Top band:** the rank in corner brackets with the title and composer, then six hairline data cells: PERFECT,
     GREAT, GOOD, MISS, ACC, MAX COMBO.
   - **Middle band:** `BY BAR` and `TIMING`.
   - **Bottom band:** the tutor panel and the buttons.
   - The Details grid stays below for everything else.
3. **`feat(duo-results)`, part 2:** the three panels (`BY BAR`, `TIMING`, the tutor), saving "next for you",
   `verify-results.mjs`, the screenshots, the done note.

## Requirements
- **Use the Duo kit** (`web/src/game/duo-tokens/`, from duo-tokens, #645) for every panel, bracket, button, data
  cell and monospace label. Don't draw your own frames, buttons or cells. If the kit lacks something, add it to the kit
  through a `fix(duo-tokens)`, not locally.
- **Data cells:** labels in monospace caps, numbers in the condensed display face. PERFECT's number is gold and MISS's
  grey. Gold, red and grey appear only on judgment numbers, never on chrome. Practice and wait takes keep today's
  "not scored" rule.
- **`BY BAR`:**
  - one cell per bar of the judged hand's notes, filled by that bar's accuracy;
  - the weakest run bracketed in `--pa-primary`, with `BARS X–Y` above it;
  - bars with no notes are empty cells, never a score;
  - at least 8 px per cell at 1280 wide. Past that, it groups 2 bars a cell, and says so in the label.
- **`TIMING`:**
  - a histogram of every judged note's offset;
  - a dashed zero line;
  - the caption `AVG +N MS LATE` or `−N MS EARLY` from the mean offset.
  - It comes from the same per-note offsets take-graph plots. The existing `describeTiming` text and the latency
    button stay reachable.
- **The tutor panel:**
  - the gator from `web/public/learning/` (the existing art; no new drawing) and one or two lines;
  - one primary button, `PRACTICE BARS X–Y`, which opens bar-loop on the weakest run at 70%
    (`/play?song=…&from=X&to=Y&tempo=70`), keeping `hands`;
  - `RETRY` and `SONGS` as secondary buttons.
- **The template line,** from the take only:
  - `Your {left|right} hand {drags|rushes} in bars X–Y, about N ms {late|early}.` when one hand's mean offset in that
    run is past ±20 ms;
  - else `Bars X–Y were your weakest: N% of notes right.`;
  - then `Let's loop just those bars at 70%, then play it through.`;
  - with no weak run (every bar at least 95%), `Clean take. Try it faster, or pick the next song.`, and the primary
    button becomes `NEXT SONG`.
  - Every number in the line comes from the take: no invented values.
- **`nextStep` later:** when Andres's `nextStep(results)` lands (#642), the panel shows its line instead, and falls
  back to the template.
- **"Next for you":** after a scored take, save `{ song, from, to, hand }` of the weakest run to `localStorage`
  (`pianoArcade.nextFor.<songId>`) for duo-select's strip. Never save from a practice, bot or demo take.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/duo-results`:
   - `barScores` matches `scorePhrases` with 2-bar phrases when cells are paired;
   - `weakestRun` finds a planted weak run (bars 9–12 removed from a perfect Für Elise take);
   - the histogram bins sum to the number of judged notes;
   - `tutorLine` gives each of its sentence forms, with numbers equal to the inputs;
   - nothing is saved for a bot take.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug duo-results --worktree . --cmd "node {worktree}/web/src/game/duo-results/verify-results.mjs --out {out}"`.
   It prints `verify-results: pass` or names each failed step:
   1. `/play?song=fur-elise&input=test` to the end, every note pressed through the test hook except two in three of
      bars 9–12: the six cells read the same numbers as `__pianoArcade.results`, the strip has one cell per bar, and
      the bracket is on bars 9–12. (Was the rank-c bot: a bot's take has no known weak run to check the bracket against.)
   2. `PRACTICE BARS X–Y` opens a `/play` URL with `from=X&to=Y&tempo=70`, matching the bracket.
   3. Screenshots `results.png` at 1280×720 and 1920×1080, plus reduced motion, with no page scroll.
3. Eric plays one take on the DGX: does the tutor line name bars he'd agree were his weakest? Mark it in the done
   note.

## How it's built and checked
Follow `specs/context/visual-direction.md`, build with the `frontend-design` skill, and review with taste v2's step
8, "Look", at 1280×720 and 1920×1080 plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- **After duo-hud and duo-select in the restyle.** Cut by Sunday noon (2026-10-25 12:00 ET).
- **±20 ms, 95%, 1–4 bars, 70%:** starting values for Eric to tune.
- Log any choice this spec doesn't make in `specs/decisions/duo-results-*.md`.
