## What shipped
On `/play` the lanes under black keys are a shade lighter than the white lanes (white at 0.04 over `#000`, about `#0a0a0a`), from the top of the highway to the judgment line, through the perspective. Octave lines, bar lines and notes draw over them; pills keep their colors and sizes. The fever stage draws about 8% dimmer, so a black lane stays under `maxLaneLuma` (0.35). `blackKeyLaneSettings.tint = 0` turns it off and gives back the old stage cap.
## Where it lives
`web/src/game/black-key-lanes/` (#387, #397), `stageOpacity` in `web/src/game/stage/index.ts` (#393), one `drawBlackKeyLanes` call in `web/src/game/core/highway.ts` (#403), `specs/decisions/black-key-lanes-stage-cap.md`, screenshots in `specs/features/black-key-lanes/screens/`.
## How to check it
verify: `pnpm -C web verify` + `verify-sim.mjs` pass at 9a437a6 (evidence: `.git/agent-evidence/black-key-lanes/20261024T152313Z`). `verify-stage.mjs` passed on #393 (42/42 PERFECT, stage on and off). Before/after headless Chrome at 1920×1080 (stage on and off), 1280×720 and reduced motion, mid-song on `/play?song=fur-elise&bot=perfect`: the black lanes read faintly lighter and the pills look the same.
## Gaps
- Not verified by Eric on the piano ("do you find a lane faster?").
- The screenshots predate #408 (static range from the chart as loaded); the lane code didn't change after them.
- The stage froze for its frame budget in the stage-on runs (this machine's load average was ~55), so those shots show a still stage.
