# hit-particles: where the particle layer renders

**Context.** The spec wants the dust drawn over the falling notes and under the HUD, with or without fever-stage, on
the GPU at DPR 1. Fever-stage's three.js renderer is a `background()` layer *behind* the highway canvas, so drawing
the dust there puts it under the notes; it's also off with `?stage=off` and only drawn during fever (Eric,
2026-10-25: plain black otherwise). So the dust can't reuse the stage's renderer.

**Options.**
- (a) Juice owns its own offscreen `THREE.WebGLRenderer` at DPR 1, never in the DOM, and blits it into /play's shared
  overlay inside `juice.draw()` with `drawImage` (`lighter`), after its clipped 2D effects.
- (b) A second DOM canvas above the highway and under the HUD. Needs a new mount point in /play or the contracts (a
  `contract:` PR) for one plugin.
- (c) Fold fever-stage into the particle layer: one context, but the stage's sky and stars would then draw over the
  notes, or the layer would need two passes and the stage's freeze guard would freeze the dust too.

**Choice.** (a), the planner's call on #750. Fever-stage stays as it is, behind the highway, in its own context: two
WebGL contexts during fever, one otherwise. The blit's main-thread cost is in perf.mjs's before and after numbers.
Code: `web/src/game/hit-particles/gl.ts`; the hookup is in `web/src/game/juice/index.ts`.

**`?stage=off` and no WebGL.** `?stage=off` and `localStorage["pianoArcade.stage"]="off"` turn off the stage only; the
particles don't read them. Without WebGL (the renderer throws), juice keeps its 2D wisps and sparks, unchanged.

**How to undo.** Delete the `gpu` lines in `juice/index.ts`: juice is back to its 2D particles, and nothing else
imports `hit-particles/`.
