---
name: "Flow mode: the song waits for you and follows your tempo, judging only what a listener would hear"
depends_on: ["core-loop", "judging-tiers", "wait-mode", "hand-mode", "hud", "results-layout"]
owns: ["specs/features/flow-mode/", "changes/flow-mode.md", "web/src/game/flow-mode/", "specs/decisions/flow-mode-"]
assignee: "eric"
---

# Flow mode

Issue #618. Eric, 2026-10-24, after playing Flower Dance on the DGX, relayed by eric-asking-agent after a grill round
("let's ship this", yes to all 10 decisions). Strict mode is "completely undemoable". He's a real pianist (he learned
all of Clair de Lune), yet he scored 10–20%, got lost, and couldn't rejoin because "the song was already ahead". Judging
a fixed tempo at ±25 ms is sight-reading at performance tempo: an expert's exam.

**The audience rule (Eric):** "you can fuck up pretty hard in piano. As long as you don't completely fuck up a wrong
chord or get lost and stop, most people won't even notice if you're a little off in dynamics or your tempo." So Flow
punishes what a listener hears (wrong notes, skipped notes, stopping) and forgives what they don't (tempo drift,
dynamics).

Strict mode stays as it is; renaming it Expert is a later issue.

**Parked by Eric, don't build:** "Magic" mode (any key plays the right note) and any 5-lane zoom. He wants to design
the booth's look first.

## What exists (origin/main, 2026-10-24)
- **Wait mode** (`?mode=wait`, `web/src/game/wait-mode/index.ts`): `holdClock(chart, noteState)` stops chart time at
  the earliest due unjudged note. `app/play/page.tsx` builds the clock (about :174–180), calls `wait.update` each
  frame (:332), judges a press during a hold at the held time (:188), and skips `judge.advance`, so there's never a MISS (:339).
- **Plugins can't drive the clock.** `GamePlugin` (`contracts/index.ts:131`) sees only `Frame.nowMs` and the
  songStart/pause/resume events. So the clock and judge choice happen in `page.tsx` (core-loop's), as wait mode's does.
- **The judge** (`game/core/judge.ts`, judging-tiers): windows of 25/50/100 ms, a MISS past 100 ms in `advance`, and WRONG
  for an unmatched press (`extra()`), which breaks the combo through `breakCombo`. Each chart has one `bpm`.
- **Hand mode** in wait mode sends the other hand's notes as `frame.nowMs` passes them (`waitSends`,
  `game/hand-mode/hands.ts:54`), so it works with any clock that moves.
- **The beat** (`game/beat/index.ts`) schedules at wall time `zero + atMs`, so chart time must run 1:1. It's off in wait mode.
- **The test hook** `window.__pianoArcade.press(pitch, chartTimeMs)` (`?input=test`) maps chart time to wall time
  through `clock.toPerf`.

## Plan
1. **`feat(flow-mode)`, part 1:** `web/src/game/flow-mode/clock.ts`, `judge.ts` and `steady.ts`, all pure, with their
   tests (Validation 1). No UI.
2. **`fix(core-loop)`:**
   - `?mode=flow` in `app/play/page.tsx` uses the flow clock and the flow judge, and the take is scored.
   - The test hook gets `pressNow(pitch, velocity?)`, which presses at the current wall time.
   - `fix(hand-mode)`, if needed: hand mode treats `mode=flow` as it treats `mode=wait`.
3. **`feat(flow-mode)`, part 2:**
   - the plugin: the HUD tempo readout, the waiting-note glow, "Take your time", a start-screen way in, and the
     results headline;
   - `verify-flow.mjs`;
   - the look pass;
   - the done note.
4. **Only if time allows, `fix(beat-track)`:** the beat follows the flow clock (Requirements, The beat).

## Requirements
**The clock (`clock.ts`)**
- Chart time moves at `rate ×` wall time. `rate` is the player's tempo as a fraction of the chart's.
- `rate` starts at 1.0 (or `tempo/100` with `?tempo=`) and stays between 0.5 and 1.3.
- **It waits for you.** Over the last quarter beat before the next unplayed onset of the judged hand, the clock eases
  linearly to a stop, and it holds exactly on that onset until it's played. It never passes an unplayed note.
- **It follows you.** After each played onset, `rate` updates from the time since the previous played onset:
  `chartΔ / wallΔ`. That's smoothed over the last 4 onsets (a mean, or an EMA the worker picks and logs), so one late
  note doesn't lurch it, then clamped to 0.5–1.3. Time spent waiting at a hold past 2 beats doesn't count toward
  the tempo (a fermata isn't a tempo change).
- **It catches up.** If you play a note before the clock reaches it, the clock moves forward to it within half a
  beat, faster than `rate` but without a jump.
- API like `holdClock`: `update(outerMs)`, `now(outerMs)`, `toOuter(chartMs)`, `seek(chartMs, outerMs)`, and
  `rate`, `holding` and `heldMs`. Pauses work as they do today: the outer clock is `pauses.now(perf)`.

**The judge (`judge.ts`)**
Same shape as `Judge` (`press`, `advance`, `finish`, `rewind`) and the same `Results` contract, so `page.tsx` and
the results panels need no new types.

The **front** is the earliest onset of the judged hand with notes still unplayed. The **lookahead** is the next 4
onsets after it.
- **A right note:** a press of a front pitch hits it. Timing never makes a MISS: the tier is **steadiness**, the press's
  distance from where the player's own tempo predicted it. Predicted = the previous played onset's wall time plus
  `chartΔ / rate`. The tiers: within 0.10 beat PERFECT, within 0.20 GREAT, else GOOD.
- **WRONG:** a press matching no front or lookahead pitch. It breaks the combo, and the note keeps waiting.
- **A skipped note:** a press matching a lookahead pitch while the front still has unplayed notes. Those front notes,
  and any onsets between, become MISS (each breaks the combo). The press hits its note, and the clock catches up to it.
- **A chord's inner note:** when the player moves past a front chord (one hand, at least 3 notes, at one beat, as
  chord-sync defines it) with its lowest and highest notes played and an inner note unplayed, that note is GOOD,
  not MISS, and the combo holds.
- **Dynamics are not scored.**
- **Lost:** a pause of up to 2 beats at the current `rate` while a note waits is free (fermatas, breathing). Past 2
  beats, the combo breaks once for that stop and it counts as a slip. The song keeps waiting, so the player can
  always rejoin.
- `advance` never makes a MISS from time. `finish` marks every still-unplayed note MISS, for a take ended early.

**Steadiness (`steady.ts`)**
From each hit's signed deviation in beats:
- **"steady"**, if the median |deviation| ≤ 0.10;
- else **"a bit rushed"**, if the mean deviation is under −0.05 (early);
- else **"a bit uneven"**.

**Hands, the HUD, the look**
- **Hands:** both by default. `hands=R` or `hands=L` works as in wait mode: the other hand is played for you, and only
  the judged hand's notes hold the clock.
- **The highway:** today's normal one with all lanes. **No zoom**, and no other new furniture besides these two:
  - **A tempo readout** in the HUD: `♩ 92 · 115%`, the current bpm (chart bpm × rate, rounded) and the rate as a percent.
  - **A soft glow** on the waiting note at the hit line while the clock holds.
- **Lost:** after the 2 free beats, the HUD reads a calm "Take your time" instead of a red MISS, with the note still
  glowing. That matches PRODUCT_PHILOSOPHY.md's "I got you", without hiding that the combo broke.
- **The way in:** the start screen offers "Play in Flow", which opens the same URL with `mode=flow`, beside wait
  mode's "Learn it first". The worker places it within `specs/context/visual-direction.md`, and lab (#619) lists it.

**Results**
The usual rank and combo, plus one teacher-style headline on the results, such as `98% right notes · steady · 2 slips`:
- right notes = the judged hand's notes hit (any tier, inner-chord GOOD included) ÷ its notes;
- slips = WRONG + skipped notes + lost stops;
- the word comes from `steady.ts`.

**The beat**
- **v1: off in Flow,** as in wait mode. It drops out rather than going wrong.
- **Part 4, if time allows:** the beat follows the flow clock while it moves. Each frame it schedules the hits in the
  next ~100 ms of chart time at the current `rate`, and it's silent while the clock holds.
- The whole band following you is idea #519, not this.

**Test hook**
`window.__pianoArcadeFlow = { rate, holding, slips, front }` with `?mode=flow`, else `null`.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/flow-mode`, with scripted players (a function from the
   chart to timed presses, wall time) through the flow clock and flow judge together, on Twinkle and Für Elise:
   - **steady at 80%:** every note PERFECT, `rate` settles at 0.80 ± 0.03, and the word is "steady";
   - **drifting from 70% to 120%** across the song: no MISS, and no MISS from timing at any point;
   - **one wrong pitch:** a WRONG, the combo breaks, and that note still waits;
   - **one skipped note** (a later note played first): that note is a MISS;
   - **a 3-note chord** with its inner note missing: that note is GOOD and the combo holds;
   - **a 3-beat stop mid-song:** the combo breaks once, a slip counts, and the take still completes;
   - **a 1.5-beat stop:** the combo holds;
   - **the clock never passes an unplayed note:** with no presses, `now()` sampled every 16 ms for 10 s never goes
     past the first note's time;
   - **the cap:** a player at 200% leaves `rate` at 1.3;
   - **`hands=R`:** left-hand notes never hold the clock.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug flow-mode --worktree . --cmd "node {worktree}/web/src/game/flow-mode/verify-flow.mjs --out {out}"`.
   `/play?song=twinkle&mode=flow&input=test&stage=off`, pressing with `pressNow` at wall-clock intervals. It prints
   `verify-flow: pass` or names each failed step:
   1. **No presses for 3 s:** `__pianoArcade.now()` never passes the first note's time, `holding` is true, and "Take
      your time" shows after 2 beats.
   2. **The whole song at 80% tempo:** `rate` is within 0.80 ± 0.05 by the 8th note, the results show no MISS, and
      the headline says `steady`.
   3. **Screenshots** `flow-hold.png` (the glow and readout) and `flow-results.png` at 1280×720 and 1920×1080.
3. **On the piano** (Eric; mark it in the done note): Flower Dance and Clair de Lune in Flow. Does it feel like playing
   for a friend? Tune the starting values: 0.5–1.3, 4 onsets, 2 free beats, 0.10/0.20 beat, and the quarter-beat ease.

## How it's built and checked
One worker builds it. The look pass follows `specs/context/visual-direction.md`: build the readout, glow and headline with
the `frontend-design` skill, and review them with taste v2's step 8, "Look", at 1280×720 and 1920×1080 plus reduced motion.
Before and after screenshots go in the PR.

## Defaults
- **First in `extras` after laptop-sound,** which is already building. Cut by Sunday noon (2026-10-25 12:00 ET). If
  it isn't solid by then, Eric's video take falls back to strict mode with `hands=R` (the left played for you), plus
  wider windows through a `fix(judging-tiers)`. Eric decides that call, not an agent.
- **Records:** `records` already treats `mode` as practice (`game/records/store.ts:66`), so Flow takes aren't saved
  as records in v1. Saving them is a later issue.
- Any choice this spec doesn't make goes in `specs/decisions/flow-mode-*.md`.
