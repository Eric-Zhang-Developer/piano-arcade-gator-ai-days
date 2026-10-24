---
name: "Veritas: a /veritas page where test players plant mistakes and the real judge finds exactly those"
depends_on: ["core-loop", "chord-sync", "tempo-curve", "piano-sim", "ui-tokens"]
owns: ["specs/features/veritas/", "changes/veritas.md", "specs/decisions/veritas-", "web/src/veritas/", "web/src/app/veritas/", "web/public/veritas/"]
assignee: "eric-foreman-agent"
---

# Veritas

Issue #514. The writeup's Veritas section (`specs/context/raw/piano-arcade-writeup.md`, "Veritas: tests that never
trust an answer they didn't already know") says synthetic pianists play with planted mistakes, and the scorer has to
report exactly those and nothing else. Eric, 2026-10-24: `/veritas` is a page for the demo video. The hero is a live
run: test players play real library songs with planted mistakes, and the judge marks exactly those, shown as
"2 planted, 2 found, 0 false alarms". Below it, a dashboard from the last real CI run. It joins eric-foreman-agent's
lane (`/operator`, `/attract`, `/how`), so nothing here lives in `web/src/game/`: it imports the game's pure
functions read-only and edits no game-lane file. Every export it needs exists today (listed under Players).

## Plan
1. **`fix(ci-browser)`, by an eric-agent-N, first:** `web/e2e/run-checks.mjs` also writes its rows
   (`check`, `result`, `seconds`, `knownRed`) and the shard as `results.json` in `--out`. Not in veritas's owns.
2. **`contract: CI keeps unit and browser results as artifacts on every run`** (`.github/workflows/ci.yml`, frozen;
   Eric merges). Today the `ci` job keeps no test output: its log shows only vitest's totals (checked on run
   40115726143: "Test Files 88 passed (88)", "Tests 687 passed | 1 skipped (688)"), and the `browser` job (on main
   since #415) uploads evidence only `if: failure()`. The PR:
   - in `ci`'s Project checks, `pnpm -C web test --reporter=default --reporter=json
     --outputFile.json="$RUNNER_TEMP/unit/vitest.json"` (same tests, same verdict), plus an upload step
     `unit-results`, `if: always()`;
   - in `browser`, upload `browser-evidence-<shard>` with
     `if: always()`, so a green run keeps its screenshots and `results.json`.
3. **`feat(veritas)`:** the players and their tests (`web/src/veritas/players.ts`, `players.test.ts`). File the
   Rusher `needs-human` issue (Gaps) here.
4. **`feat(veritas)`:** `freeze.mjs` with its parse tests, the page, `verify-veritas.mjs`.
5. **`feat(veritas)`:** a snapshot frozen from main's latest run, then `changes/veritas.md`.
6. **Follow-up, not this feature:** `/how` links to `/veritas` in a `fix(how-it-works)` PR once
   `changes/how-it-works.md` is on main (it's in flight: #443, #460).

Steps 3–4 don't wait on 1–2: until they land, the snapshot's unit suites and browser checks are empty and say so.

## Players (`web/src/veritas/players.ts`, pure)
Each player takes a `Chart` and returns `{ take, planted }`: a `Take` and the list of what it planted. The judge is
`judgeTake` (`web/src/game/core/judge.ts`); windows are `web/src/game/core/settings.ts`: PERFECT ≤ 25 ms, GREAT
≤ 50, GOOD ≤ 100, `NEAR_MISS_MS` 150. Unplanted notes are pressed exactly on time.
- **Safe notes only:** a player plants on a note only if no other chart note of the same pitch lies within
  `NEAR_MISS_MS` of it, so the judge can't pair the press with a neighbour. It's a rule of the chart, never of the
  judge's output.
- **Rusher:** the whole take at 115%: each press at `t / 1.15`. Planted: the tempo.
- **Jitter:** each safe note offset by `(r() * 2 - 1) × 60` ms, `r = seededRandom(seed)` (`web/src/game/sim/fake.ts`,
  mulberry32), seed 1 unless given. Planted: each note with |offset| > 25 ms, as EARLY or LATE.
- **Fumbler:** every 10th note (index 9, 19, …) pressed one semitone up, or down if a chart note of the upper pitch
  lies within 150 ms; neither free: played right. Planted: those notes, as wrong.
- **Chord Roller:** each chord from chord-sync's `findChords` (2+ notes, one hand, one beat), all notes safe, played
  low to high, note k of m at `+60 × k / (m - 1)` ms. Planted: those chords, as rolled.
- **Golden:** Fumbler's rule on exactly two notes, the 10th and 20th it could plant on. The writeup's golden test.

## What the judge marks, and the gaps
`tally(chart, run, results)` gives `{ planted, found, falseAlarms }` from outputs that exist today:
- **Wrong (Fumbler, Golden):** found when that note is MISS and `results.wrong` holds the planted press. That's the
  red ✕ in play (`--pa-wrong`).
- **Early/late (Jitter):** found when the note is GREAT or GOOD with `offsetMs` equal to the planted offset; its sign
  is the EARLY/LATE label the highway draws (`web/src/game/core/highway.ts`). A jittered note within ±25 ms must be
  PERFECT.
- **Rolled (Chord Roller):** found when chord-sync's `scoreChords` + `isRolled` (spread > `maxSpreadMs`, 30 ms,
  `web/src/game/chord-sync/chords.ts`) marks that chord.
- **False alarm:** any unplanted note not PERFECT, any WRONG not planted, any unplanted chord rolled.
- **Rushing: no flag exists.** The judge has none. The nearest output is tempo-curve's `rubato()` BPM range
  (`web/src/game/tempo-curve/index.ts`), but it needs 8 strict hits (`minHits`). On Twinkle (100 BPM, a note per
  600 ms) a 115% take drifts 0, 78, then 157 ms, so only two notes land within GOOD of their own press. Rusher's test
  asserts the range anyway and is written `it.fails` with the issue number, so it turns red when a measure lands.
  The page shows Rusher's found as "no rushing flag yet (#N)", never a number.

## The snapshot (`web/src/veritas/freeze.mjs`, `web/public/veritas/`)
The /operator pattern: a committed file the page reads, no network, works offline. Never typed numbers.
- `node web/src/veritas/freeze.mjs [--run <id>]`, by a person or the builder. Default run: the newest completed
  `ci` run on main (`gh run list --workflow ci --branch main --event push --status completed --limit 1`), whatever
  its conclusion.
- It reads `gh run view <id> --json databaseId,url,headSha,createdAt,conclusion,jobs` (run and per-job verdicts),
  then `gh run download <id> --dir <tmp>`:
  - `unit-results/vitest.json`: per test file (path, tests, passed, failed, skipped) and the totals;
  - without it, only the totals, from the `ci` job's log (`gh run view --log --job <id>`, ANSI stripped, the
    "Test Files" and "Tests" lines), and suites `null`;
  - each `browser-evidence-*/results.json`: per check (path, result, seconds, known red);
  - per check, the first PNG by name in its passing attempt's folder (`<check path, / as _>` or its `-retry`),
    copied to `web/public/veritas/shots/`. It prints their total size.
- It writes `web/public/veritas/snapshot.json`: `frozenAt`, the run, the jobs, unit, browser, shots. A missing
  artifact or field is `null`, never a guess or a zero. The parsing is pure functions, tested.

## The page (`/veritas`)
- **Hero:** five runs in turn: Golden (Für Elise), Rusher (Twinkle), Jitter (Ode to Joy), Fumbler (Für Elise),
  Chord Roller (`chopin-prelude-4`). Each fetches `/songs/<id>/chart.json`, runs its player and `judgeTake` in the
  browser, and shows the song title and composer from the chart, the player's one-line behavior, and
  "N planted, N found, N false alarms" from `tally`. A playhead sweeps the take in 4 s: notes as ticks, planted ones
  ringed, the judge's mark (✕, EARLY/LATE, ROLLED) appearing as it passes. A line under it: "computed in your
  browser by the judge /play uses". Replay restarts it. Reduced motion: the end state at once.
- **Dashboard:** the run (short SHA, time, conclusion, link), unit totals, suites grouped by folder with pass/fail,
  browser checks with result and seconds (known red says so), the screenshots as a grid. Each `null` renders
  `unknown` in `--pa-ink-dim`, with what's missing ("CI didn't keep unit results for this run").
- No snapshot file: "No snapshot frozen yet: run node web/src/veritas/freeze.mjs". Never an error page.
- Look: `specs/context/visual-direction.md` (tokens, Saira for numbers, red only for WRONG, no state by color
  alone). **All styling lives in CSS modules** (`web/src/app/veritas/veritas.module.css`, one per component if
  needed): no inline `style` except CSS variables for data positions. So veritas-polish changes CSS only.
- Readable at 1280×720 and 1920×1080. Mobile is out.

## Validation
- `pnpm -C web exec vitest run --passWithNoTests src/veritas`:
  - every player on every committed chart (`web/public/songs/*/chart.json`, not `local/`): found = planted,
    0 false alarms. Fumbler plants on every chart of 10+ notes; Chord Roller on every chart with a safe chord;
  - Golden on Für Elise: 2 planted, 2 found, 0 false alarms, `counts.wrong` 2;
  - Jitter: the same seed gives the same take, another seed another;
  - Rusher on Twinkle: `rubato().bpmRange` within ±1 of `round(1.15 × bpm)`, as `it.fails` (gap above);
  - freeze's parsers on small synthetic inputs: full artifacts, the log-only fallback, a missing artifact as `null`.
- `node web/src/veritas/freeze.mjs`, once, on main's latest run: the snapshot's run id, SHA and conclusion equal
  `gh run view <id> --json`, and its unit totals equal the log's "Tests" line.
- `node web/src/veritas/verify-veritas.mjs --out <dir>` (one headless check; ci-browser's runner finds it by name),
  every non-localhost request aborted:
  1. `/veritas` -> each run's planted equals found and false alarms are 0, read from `data-*` attributes; Golden
     says "2 planted, 2 found, 0 false alarms"; no `pageerror` or `console.error`.
  2. The dashboard's SHA and unit totals equal `web/public/veritas/snapshot.json`'s, read by the script.
  3. A snapshot with `unit` removed (served by route interception) -> "unknown" there, the rest as before.
  4. Reduced motion -> every run's end state at load. Screenshots at 1280×720 and 1920×1080.
- `verify.py --slug veritas` passes.

## Gaps (accepted)
- **Rusher isn't flagged** until a rushing measure exists. The builder files `needs-human` for Eric: (A) a measure in
  tempo-curve that fits without 8 strict hits, (B) Rusher rushes one phrase, (C) show the gap. Default taken: C.
- Until the `contract:` PR lands, suites and browser checks are `unknown`; totals come from the log.
- The hero runs pure functions, not the mirror piano (`?midi=sim`): no MIDI timing in it.
- Skipper and Perfect already live in `web/src/game/core/judge.test.ts`; Rubato in tempo-curve's tests. Not copied.

## Defaults
- The smaller option; log choices in `specs/decisions/veritas-*.md`. No new dependency, no API route.
- The builder commits the snapshot; refreeze before the video is shot.
