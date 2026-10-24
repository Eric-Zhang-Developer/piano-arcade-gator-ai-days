## What shipped
`node web/src/game/perf-budget/perf.mjs` builds, serves and plays maple-leaf-rag with `bot=fever&labels=notes&capture=1` at 1920×1080 (DPR 1), 3 fresh pages. It times each frame's rAF work during fever only and writes `perf.json` and one line: pass, over budget or invalid. `probe.js` is the same timer, ready to paste into Chrome's console (`__perfProbe.report()`).
## Where it lives
`web/src/game/perf-budget/` (`probe.js`, `perf.mjs`, `perf-budget.test.ts`), `specs/decisions/perf-budget-gpu.md`.
## How to check it
`verify.py --slug perf-budget` pass at 3a0a523. `perf.mjs` (headless Chromium 156 on an M2, WebGL through Metal):
- Pass at 2514495 (same perf.mjs and probe): p95 2.2–2.4 ms, then 2.1–2.5 ms, over 3 runs each, against 16.7 ms.
- At 3a0a523: invalid, p95 4–4.3 ms; 2 of 3 runs froze the stage (17 s and 45 s after Start) with load average ~22 from other agents' browsers.
## Gaps
Not verified by Eric: his desktop-Chrome run of `probe.js` on his MacBook is the target number. Results are from a shared, busy machine. fever-stage's guard (mean rAF interval over 20 ms for 1 s) froze the stage in 3 of 12 GPU runs, all mid-song or cold-start under load. No run's p95 went over budget, so no `perf(<owner>)` fix was filed. If the stage ever freezes on Eric's quiet Mac, that guard is the thing to look at for the video. In SwiftShader (headless default) the stage froze in every run, hence the GPU flags.
