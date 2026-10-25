## What shipped
Spike #913: `/highlight` (Lab, "Wow") renders a take into a 15 s broadcast replay WebM: a 0.5× cold open of the best run, the finish in real time, and a title card. The picture, sound and cut are deterministic. The `?x=highlight-reel` results link hands a `/play` take over. Answer: **no** on the encode. MediaRecorder dropped frames (662/900 VP9, 34–62 VP8) and put the sound 55–75 ms behind the picture. Recommendation: iterate with WebCodecs (FINDINGS.md).
## Where it lives
`web/src/game/x/highlight-reel/` (cut, draw, audio, encode, take, Highlight.tsx, reel-check.mjs, verify-highlight.mjs, FINDINGS.md), `web/src/app/highlight/page.tsx`, the registry line in `web/src/game/x/index.ts`, `spikes/highlight-reel/measure.mjs`, `specs/decisions/highlight-reel-choices.md`, shots in `specs/features/experiments/shots/highlight-reel/`.
## How to check it
`pnpm -C web exec vitest run src/game/x/highlight-reel` (13 pass). `spikes/highlight-reel/measure.mjs` ran twice locally as the earlier one-script check, numbers in FINDINGS.md. verify.py printed: `verify-highlight.mjs` (bars 1, 3, 6, 7) pass at b10c1b5 (one run after the split, granted by the planner).
## Gaps
Bars 2, 4 and 5 fail (FINDINGS.md). The perf gate (`perf.mjs --params x=highlight-reel`) wasn't run locally, and main's scheduled run doesn't pass that flag. `measure.mjs` hasn't run since the split (its bars ran as the earlier one-script check). CI's runner has no ffprobe, so its bars come from the page's fallback. Not seen by Eric.
