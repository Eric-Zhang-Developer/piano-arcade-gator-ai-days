# fever-stage: the sun, grid and sky retired; the stars stay

**Context.** Eric, 2026-10-25, seeing the sun in duo-hud #713's fever shot: "Did the sun come back? The synthwave sun.
I hate it. I thought it got nuked." Then: "reTire the damn grid too." Contract #728 says the sun, the grid floor and
`--pa-sky` are allowed nowhere, fever included, and that FEVER itself (the gauge, the word, the edge glow) stays. Once
those go, the stage's scene has one thing left: the star field, which streaks in fever.

**Options.**
- A. Keep only the stars: `scene.ts` draws them on a transparent canvas, and nothing else in the stage changes.
- B. Stop drawing the stage: `background()` returns `null` always. Unmounting it from `layers.ts` is outside
  `web/src/game/stage/`.

**Choice: A.** Eric named the sun and the grid, not the stars. The streak is the one part of the stage that is a
fever *moment*, not a backdrop. It's on the black ground at the lane cap's opacity, and it shows only in fever.
A keeps that and is the smaller change in what the player sees. Nothing reads the sky, grid or sun colors now, so
they're gone from `stageSettings`. The state machine's grid speed, glow, count-in flash and burst still compute
values nothing draws. They go in a refactor once select-stage stops reading `gridPhase`, which is outside this PR.

**How to undo.** For B: `?stage=off` or `localStorage["pianoArcade.stage"] = "off"` turns the stage off today, with
no code. For good, return `null` from `feverStage().background`, or drop `feverStage()` from `layers.ts`. To bring
the sun back, revert this PR.
