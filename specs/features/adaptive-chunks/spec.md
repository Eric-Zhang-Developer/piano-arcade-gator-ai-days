---
name: "Adaptive chunks: practice shrinks onto the bars you miss and grows back as you prove them"
depends_on: ["chunk-practice", "bar-loop", "weak-bars", "wait-mode", "hand-mode"]
owns: ["specs/features/adaptive-chunks/", "changes/adaptive-chunks.md", "web/src/game/adaptive-chunks/", "web/src/game/chunk-practice/", "specs/decisions/adaptive-chunks-"]
assignee: "eric"
---

# Adaptive chunks

Issue #601. Eric, 2026-10-24: start with the whole song; if the student messes up, shrink to half, a quarter, an
eighth, "until they find a zone that they can play well". When they play it well, expand; if the expansion is too
much, shrink back and "shrink the improvements a little", then expand as they prove mastery. Chunking, as in real
piano practice.

chunk-practice today walks a song in fixed 4-bar chunks. This feature makes that walk adaptive. It reuses what
exists: bar-loop's `from`/`to`/`tempo` URLs and judged passes, chunk-practice's 85% gate, panels and learn step, and
weak-bars' per-phrase scores (`phrases`, `scorePhrases`). There's no new judging. The new parts are one pure
function that picks the next window, and a strip of the song with that window lit.

For the demo: a judge should see in 5 seconds that the app found the hard passage.

## Plan
1. **`feat(adaptive-chunks)`, part 1:** `web/src/game/adaptive-chunks/next.ts` and its tests. A pure function, no UI.
2. **`feat(adaptive-chunks)`, part 2:** the wiring in `web/src/game/chunk-practice/`, the strip, `verify-adaptive.mjs`,
   the shots and the done note. No other feature's files change, except one condition in results-layout's
   `featuredFor`: an adaptive step's panel is featured too, so its focused link scrolls nothing (#606, `fix(results-layout)`).

## The window rule (`next.ts`, pure)
Units are weak-bars' phrases: 2 bars each, from bar 1, the last maybe shorter, empty ones skipped. A window is a run
of consecutive phrases. A phrase with none of the played hand's notes (hand-mode's `handsSetting`, as
chunk-practice's `chunksOf` does) is skipped, never a window's edge.

`next(state, result) -> state`, where:
- `state = { from, to, ok, ko, clean }`: the window in phrase indexes, `ok` the longest length (in phrases) that
  passed twice, `ko` the shortest length that failed since then (or none), `clean` the clean passes in a row at
  this window.
- `result` is the take's accuracy and its per-phrase scores, from `scorePhrases` on the chart the take played (bar-
  loop's looped chart), mapped back to the song's phrases.

Rules, with `adaptSettings = { passAccuracy: 0.85, cleanToGrow: 2, tempo: 70 }`:
- **Start:** the whole song (every playable phrase), `ok` 0, `ko` none, `clean` 0, at 70%.
- **A pass is accuracy ≥ 85%** (chunk-practice's gate). A fail is under 85%, not one wrong note.
- **Pass:** `clean + 1`. At `cleanToGrow` (2), the length passed: `ok = length`, `clean = 0`, and if `ok ≥ ko` then
  `ko` is cleared. Then grow (below). A pass on the whole song, twice, is **done**.
- **Grow:** the new length is `min(total, 2 × ok)` if `ko` is none, else `ok + ceil((ko − ok) / 2)`. It grows
  forward: phrases after the window are added first. Once the window reaches the song's end, it adds phrases before.
- **Fail, before anything has passed** (`ok` 0): `ko = length`, and the window halves (rounded up) onto the half
  with more misses and wrongs, from the per-phrase scores. A tie takes the earlier half.
- **Fail after growing** (`ok` > 0): `ko = length`, and the window goes back to length `ok`, at the window's start.
  The next grow step is then half as big. That's the "shrink the improvements a little".
- **Floor: one phrase.** A fail at one phrase doesn't shrink. It offers "Learn bars X–Y" (chunk-practice's existing
  learn step, wait mode) and "Slower: 50%", a link to the same window at 50%. Tempo changes only on that click; no
  other step changes it.

Every rule here is a starting value for Eric to tune on the piano: 85%, 2 clean passes, the 2-bar phrase.

## Requirements
- **URL state, like chunk-practice:** each step is a `/play` URL with bar-loop's `from`, `to`, `tempo=70` and
  `passes=1`, plus `practice=adapt&ok=<n>&ko=<n>&clean=<n>` (phrase lengths). Retry replays the same step. Every
  other param (`song`, `hands`) is kept.
- **Way in:** chunk-practice's "Practice in chunks" link on a plain take's start screen opens the adaptive start (the
  whole song). The fixed 4-bar walk's URLs (`practice=1`) still work as they do today.
- **Where you are:** the start screen reads `Practice · bars 21–28 · clean 1 of 2` (or `· whole song`). Test hook:
  `window.__pianoArcadeAdapt = { from, to, ok, ko, clean, phrases }` on an adaptive step, else `null`. `from`/`to`
  are bars; `phrases` is the song's phrase list.
- **The strip:** on the start screen and the results panel, one row of cells for the whole song, one per phrase. The
  window is lit. On the results panel, each phrase the take covered is shaded by its accuracy from that take.
  It fits at 1280×720 and 1920×1080 with no page scroll.
- **After a take** (results panel), the focused link moves on, as chunk-practice's does (Enter):
  - a pass short of `cleanToGrow`: "Again: clean 1 of 2";
  - a grow: "Next: bars 13–28";
  - a fail: "Smaller: bars 21–28", or after a grow, "Back to bars 21–24";
  - at the floor: "Learn bars 25–26" focused, and "Slower: 50%";
  - done: "You played the whole song", which links to `/play` keeping only `song` and `hands`.
- **Not saved:** practice takes are never records (records' `practiceReason` already skips a URL with `from`).

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/adaptive-chunks`. The tests use scripted players: a
   function from a window to per-phrase accuracies. These are not Veritas's players (#542), so the tests don't wait
   on it:
   - **A clean player** (every phrase 100%) on Für Elise: take 1 is the whole song, take 2 is done. No shrink.
   - **A player that fails only bars 21–28** (any window holding them is under 85%): within 5 takes the window lies
     inside bars 21–28. When the player then plays everything clean, the window grows back to the whole song and is
     done.
   - **A player who manages 6 phrases but not 7:** after it converges, it never fails a length ≤ 6, and the lengths
     it tries stay between 6 and 7.
   - The floor offers learn and slower, and never shrinks below one phrase.
   - With `hands=L`, a phrase with no left-hand notes is skipped and never a window's edge.
   - The URL round trip: `state → URL → state` is the same state.
   - **One test through the real judge:** the perfect bot's take on Für Elise with the notes in bars 21–28 removed,
     scored by `scorePhrases`, makes the first shrink pick the half holding bars 21–28.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug adaptive-chunks --worktree . --cmd "node {worktree}/web/src/game/adaptive-chunks/verify-adaptive.mjs --out {out}"`.
   It starts its own dev server, prints `verify-adaptive: pass` and exits 0, or names each failed step:
   1. `/play?song=twinkle` -> "Practice in chunks" -> the URL has `from=1&to=12&tempo=70&passes=1&practice=adapt`,
      and the start screen reads `Practice · whole song · clean 0 of 2`.
   2. With `bot=rank-d` -> "Smaller: …" is focused and halves the window. With `bot=perfect` twice on a 2-phrase
      window -> "Next: …" grows it.
   3. The strip at 1280×720 and 1920×1080 after each step, as numbered PNGs in `<dir>` (`strip-1.png`, …), and no
      page scroll.
3. On the piano (Eric; mark it in the done note): Für Elise from the whole song. Does it find his hard bars? Does the
   growth feel right? Tune 85%, 2 and the phrase size. Record one clip of the strip narrowing onto the hard bars,
   for the video.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build the strip with the `frontend-design` skill, and review it with
taste v2's step 8, "Look", at 1280×720 and 1920×1080 plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- **Last in `extras`, cut if it isn't done by Sunday noon** (2026-10-25 12:00 ET). Eric: "after the current extras".
- **Length only:** tempo stays at 70% unless the player clicks "Slower" at the floor.
- **Grow forward, then backward,** so a student who fails late in the song isn't sent back to bar 1 first.
- **Moving on is a focused link, not automatic,** as in chunk-practice. To make it automatic, add a count-in and a
  timer in a `fix(adaptive-chunks)`.
- The fixed 4-bar walk stays reachable by its URLs. To drop it, delete its link code in a `fix(chunk-practice)`.
- Log any choice this spec doesn't make in `specs/decisions/adaptive-chunks-*.md`.
