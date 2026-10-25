---
name: "Perf budget: frame time on the densest chart at 1920×1080, with fever and the stage on"
depends_on: ["fever-stage", "scenes", "fever-gauge"]
owns: ["web/src/game/perf-budget/"]
assignee: "eric"
---

# Perf budget

The video is shot at 1920×1080, and its loudest shot is fever on a dense passage with the stage behind. A dropped
frame there shows on camera. Today's only number is fever-stage's in-page 6.9 ms mean, taken on the dev server. This
feature makes the number repeatable in one command and holds a budget: p95 ≤ 16.7 ms, one 60 Hz frame.

Issue: #263

## Plan
1. `feat(perf-budget)`: `probe.js` (the frame timer), `perf.mjs` (the run) and their tests, all in
   `web/src/game/perf-budget/`. One PR; nothing outside the folder changes.
2. **Over budget:** rerun with one layer off at a time (`--params stage=off`, then `labels=off`, then `zoom=off`).
   The top offender is the layer whose removal drops p95 the most. Its fix is a separate `perf(<owner>)` PR with
   before and after numbers (runs, spread), per AGENTS.md; core's files go through `perf(core-loop)`. The done note
   doesn't wait for that fix: it links the PR, or a `blocked` issue after three failed tries.
3. The done note, with the numbers and Eric's run.

## Requirements
- **One command:** `node web/src/game/perf-budget/perf.mjs`, after `pnpm -C web install` and
  `pnpm -C web exec playwright install chromium`. It runs `next build`, serves it with `next start` on a free port,
  measures, and stops the server. `--base <url>` skips both and uses a running server. Options: `--song <id>`
  (default `maple-leaf-rag`), `--runs <n>` (3), `--params <query>` (sets those keys on the scene's URL, overriding
  its own), `--out <dir>` (default `<git common dir>/agent-evidence/perf-budget/<UTC stamp>/`, as verify.py: never
  committed). A failed build, a missing browser or an unreachable server exits 2 and says what to run.
- **What's timed:** frame work time. For each animation frame, it's the time the page's `requestAnimationFrame`
  callbacks take, summed over the callbacks that share a frame timestamp. `probe.js`, one plain script with no
  imports, wraps `window.requestAnimationFrame`. `/play` calls it by name every frame, so the wrap catches the loop
  whether it goes in before load or gets pasted mid-song. Not rAF-to-rAF intervals: an empty page already reads p95
  17.6 ms that way (Playwright's Chromium on Eric's Mac, 2026-10-24).
- **Which frames:** only while `window.__pianoArcadeFeverGauge.fever` is true and `[data-testid="results"]` isn't
  showing. The probe applies this itself, so a pasted probe counts what the script counts, and /play's idle loop
  behind the results screen can't pull p95 down.
- **The scene:** `/play?song=<id>&bot=fever&labels=notes&capture=1` in a 1920×1080 viewport at devicePixelRatio 1,
  everything else at its default, the stage included. `labels=notes` is what MIDI play shows (a bot alone gets laptop
  letters); `capture=1` is how the video is recorded (capture-mode; ignored until it ships). `maple-leaf-rag` is the
  densest chart by difficulty's notes per second: 17.3 over its busiest 10 s, then moonlight-3 at 7.0 (charts at
  0f0b790, rechecked at 2e1c3fd). A fresh page per run: Start, play to the results.
- **Output:** `<out>/perf.json` (per run: frames counted, p50, p95 and max in ms; the p95 spread; the commit, URL,
  viewport, devicePixelRatio, Chromium version and WebGL renderer string) and one line:
  `perf-budget: p95 <lo>–<hi> ms over <n> runs (p50 …, max …) at <sha>: pass | over budget`.
- **At a Retina screen's density too** (Eric's MacBook lagged at devicePixelRatio 2 and not at 1, 2026-10-25):
  `--dpr <n>` sets the context's deviceScaleFactor (default 1, the budget's scene). Each run also records the page's
  `<canvas>` count, their total backing size in megapixels and frame-to-frame intervals (`__perfProbe.intervals()`).
  Those show what the compositor blends, which callback time can't; intervals are noisy headless (above), so they
  compare two runs and never set the verdict.
- **Exit 1** when any run's p95 is over 16.7 ms, or a run is invalid: it counted no frames, never reached fever,
  fever-stage's frame-budget guard froze the stage (its `fever-stage: … frozen` console line), or it has no stage
  canvas (`main > div canvas`) while `--params` doesn't set `stage=off`.
- **The GPU caveat goes with the numbers:** headless Chromium draws WebGL in software (SwiftShader, in the renderer
  string), and GPU work isn't in a callback's time. The number covers the main thread; Eric's MacBook is the target.

## Validation
- `pnpm -C web test`, running `probe.js`'s text against a fake window: nearest-rank p50, p95 and max of a fixed list;
  two callbacks in one frame count as one frame; with a fake clock, a callback that takes 20 ms reads 20 ms; frames
  before fever or after the results show aren't counted. The verdict: p95 16.7 passes, 16.8 fails, no frames is invalid.
- From a clean shell: `node web/src/game/perf-budget/perf.mjs` -> its line, and `perf.json` where it says. Paste both
  in the PR, pass or over budget: an honest over-budget run is the feature working (Plan 2 takes it from there).
- `--base http://localhost:1` -> exit 2 within a few seconds, naming the URL.
- `verify.py --slug perf-budget` passes (`/play` doesn't change).
- Eric's check, one run in desktop Chrome on his MacBook (`not verified by Eric` in the done note until then):
  `pnpm -C web build && pnpm -C web start`, open the scene's URL at 1920×1080 or the nearest window (note its size
  and `devicePixelRatio`), paste `probe.js` into the console, press Start, and at the results run
  `__perfProbe.report()` -> p50, p95 and max.

## Defaults
- Every run's p95 must be within budget. Max is reported, not budgeted.
- If the headless run and Eric's disagree, Eric's wins, and the gap goes in the done note.
- Not in CI: it needs a build and minutes. No new dependencies. If song-sweep's build-and-serve code is on main,
  import it rather than copy it.
- fever-moment, and anything else that draws during fever, adds to this scene: rerun after it lands.
