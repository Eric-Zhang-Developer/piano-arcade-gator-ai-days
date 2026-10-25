## What shipped
/musicbox: your take as a brass music-box cylinder in three.js, one revolution for the whole take, over a steel comb with one tooth per pitch (L ∝ 1/√f) that lifts and rings. Turn the crank plays it on laptop audio through a cantilever voice (β² partials); Macro moves in on the pluck point with depth of field; Export STL writes a watertight binary model. With Pinned on in the Lab, /play's results link to `/musicbox?take=last`; without a saved take the page pins a scripted perfect Twinkle and says so.
## Where it lives
`web/src/game/x/pinned/` (cylinder, voice, stl, scene, take, Pinned, the registry entry), `web/src/app/musicbox/page.tsx`, decisions `specs/decisions/pinned-{model,voice,movement}.md`, shots `specs/features/experiments/shots/pinned/`.
## How to check it
`pnpm -C web exec vitest run src/game/x/pinned`: 9 pass (angles, comb, watertight STL, parse-back, cap, β ratios, fit refusal). Frame work at 1920×1080 while turning, probe.js pasted in, 3 runs each: wide p95 0.4 / 0.5 / 0.6 ms, macro 0.7 / 0.8 / 0.7 ms (budget 6); rAF interval p95 18.2 to 18.5 ms. GPU time isn't measured. The perf gate (`perf.mjs --params x=pinned`) was not run locally; main's scheduled run covers it.
## Gaps
Fit mode doesn't ship: no cited tooth list (decision pinned-movement). The STL hasn't been opened in a viewer or printed, and the voice hasn't had a listen: both are on the morning page with the macro shot for video-shots (#975). The STL is a model, with no draft or tolerances.
