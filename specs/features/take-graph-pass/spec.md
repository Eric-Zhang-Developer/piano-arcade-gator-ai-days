---
name: "Take graph pass: a graph a player reads in five seconds, on the live windows, with trends and a readout"
depends_on: ["take-graph", "judging-tiers", "hand-colors", "duo-tokens", "duo-details"]
owns: ["specs/features/take-graph-pass/", "changes/take-graph-pass.md", "specs/decisions/take-graph-pass-"]
assignee: "eric"
---

# Take graph pass

Issue #1083. Eric, 2026-10-25, asked for polish pitches with hit-particles' depth on one thing. In #856's terms, this
is a **hero-tier** item. It's a normal game-lane change with the design pass, and it has no flag. take-graph is done
and in this lane, so this spec reaches `web/src/game/take-graph/` through the lane rule.

**Today (origin/main):**
- one dot per note at its offset, late up and early down, in its hand's color and shape (circle R, square L);
- shaded PERFECT and GREAT bands and dashed GOOD lines;
- a MISS is an × on the zero line, a WRONG a red tick at the top;
- a faint velocity line on a second, right-hand axis;
- native `<title>` tooltips;
- a fixed 900×196 px SVG (`TakeGraph.tsx:13-14`).

**One correction to the record:** `changes/take-graph.md` says the bands are ±25/50/100 ms. The code on main already
reads `PERFECT_MS`, `GREAT_MS` and `GOOD_MS` from `core/settings.ts` (40/80/120 since judging-tiers,
`TakeGraph.tsx:6,27`). So the bands are right, and the done note is stale. What's missing is a test that pins it, and
a y-axis that doesn't hide everything past GOOD: offsets clamp to ±`GOOD_MS` today (`TakeGraph.tsx:27`).

## The pass
1. **Correctness:**
   - the bands take the judge's windows as an input (default: core's settings), with a unit test showing that
     different windows move them;
   - an offset past ±`GOOD_MS` draws as a clipped mark at the edge with its true value in the readout, so nothing
     reads as GOOD that wasn't.
2. **Trend lines:**
   - a rolling median per hand over about 8 notes, in the hand's color (`handColor`);
   - **direct labels** at the right end in the kit's mono, instead of a legend: "RH +12 ms late · LH −4 ms early",
     from the last window's median;
   - a hand with fewer than 8 judged hits gets no line and no label.

   Values are computed from the take, never invented. The window size is logged.
3. **No dual axis:** velocity moves to its own small strip under the plot, on the same x axis. Takes without
   velocity (laptop keys) keep "no velocity" (`sensesVelocity`).
4. **The x axis is in bars:** hairline gridlines per bar, numbered at phrase starts (weak-bars' phrases) or every 4
   bars, whichever is sparser at that width.
5. **The readout:**
   - a crosshair with a mono card, "Bar 12 · beat 3 · +32 ms · GREAT · vel 74", from `describePoint`, replacing the
     native tooltips;
   - the arrow keys step through notes, and Home and End jump to the first and last;
   - the focused note sets the graph's accessible name (`aria-live="polite"` on the card);
   - "Show as table" stays, with the same rows.
6. **MISS and WRONG:** quiet marks, per miss-moment's principle (#1038): readable, never louder than a hit, in the
   miss and wrong tokens.
7. **Responsive:** the SVG fills its card at 1280×720 and 1920×1080 (the Details grid, duo-details), with no
   horizontal scroll, on Duo kit tokens. Use a `viewBox` and the card's measured width, not a fixed 900.
8. **Motion:** one draw-in over about 600 ms, left to right, when the graph first shows. If results-landing (#959) is
   on (`?x=results-landing`) and the graph is on screen during it, the draw-in starts after the landing's end state.
   Reduced motion draws it at once.

## How it's built
- **Skills, in order:** load the `dataviz` skill first (the chart's form, marks, color and interaction), then
  `frontend-design`, then `design-taste-frontend` (taste v2) for the look loop.
- **Pure first:** `graph.ts` gains `bands(windows)`, `rollingMedian(points, hand, n)`, `barTicks(chart, width)` and
  `velocityStrip(points)`, with tests. Then `TakeGraph.tsx` draws them.
- **Lane rule:** check open PRs on `web/src/game/take-graph/` and on the Details card's files first (`gh pr list`,
  then each PR's files). When this spec was written, only #600 (abbasi2010) touched `TakeGraph.tsx`. The planner
  reads #600 as stale, so it doesn't block. Keep the diff narrow.
- **Kept:** the panel's place in Details, its testids, and `verify-take-graph.mjs`'s checks. Update the script where
  the readout replaces `<title>`, and say why in the PR.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Take shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`).
- Score each round against `references/critique.md` and fix the top three problems. A hero item gets up to 5 rounds.
- The PR's Design section has the skills invoked (dataviz included), each round's score, the fixes, and the before
  and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Shots:** before and after at 1280×720 and 1920×1080, for `bot=perfect`, `bot=late` and `bot=sloppy` on Für
Elise, plus a reduced-motion set. All three bots exist in scenes' `BOTS`. They go in
`specs/features/take-graph-pass/shots/`.

**(b) Taste v2:** the score for each round in the PR, up to 5.

**(c) The 5-second read test:**
- **Three takes with a known answer,** made with `input=test` on Für Elise (as duo-results' check plants its weak
  bars):
  1. every note +40 ms late (as `bot=late`);
  2. the left hand about 30 ms early in bars 9–12, the rest on time;
  3. the right hand about 25 ms late in bars 5–8, the rest on time.

  The truth (direction, the mean in ms, the hand, the bars) is computed from each take's results and written down
  before the test.
- **The test:** for each take, a fresh subagent sees one after PNG of the graph alone (no title, no caption, no
  table), told to look for 5 seconds. It answers: early or late, roughly how much, which hand, and where (bars).
- **A right answer** gets the direction and the hand right, the amount within ±15 ms of the truth, and the place
  within ±2 bars.
- **Pass:** 3 of 3. The before PNGs get the same test, with fresh subagents, and both scores go in the PR.
- Never show a subagent the truth, the spec or the other answers.

**(d) Unit tests** (`pnpm -C web exec vitest run --passWithNoTests src/game/take-graph`):
- the bands follow the judge: other windows move them, and the default equals `PERFECT_MS`, `GREAT_MS` and
  `GOOD_MS`;
- the rolling median is right on a scripted take (hand-computed values in the test);
- no median, and no label, for a hand under 8 notes;
- an offset past GOOD is clipped in the plot with its true value in the readout;
- the bar ticks: one gridline per bar, labels at phrase starts or every 4 bars;
- the arrow keys step through notes in time order;
- take-graph's existing tests stay green.

**The browser check:** `verify-take-graph.mjs` is updated and still passes. Per AGENTS.md it doesn't run locally: the
done note says "not verified locally; covered by main's scheduled full run".

**Eric** (the morning page): `localhost:3001/play?song=fur-elise&bot=sloppy`, then Details → Take graph, and
`localhost:3001/play?song=fur-elise&bot=late`. Can he tell where he rushed? The done note says `not seen by Eric`
until he does.

## Gaps (accepted)
- No zoom or scrub along the song: one view of the whole take.
- The trend is a rolling median, not a tempo fit. tempo-curve's rubato view stays its own panel.

## Defaults
- **In `extras`,** after miss-moment.
- Log any choice this spec doesn't make in `specs/decisions/take-graph-pass-*.md`: the window size, tick spacing,
  the clip rule and the draw-in's easing.
- The smaller option; no chart library; no new dependency.
