# select-stage: no scene, just the ground

**Context.** Contract #728 (Eric, 2026-10-25) retires the synthwave sun, the grid floor and `--pa-sky` everywhere.
duo-select (#714) took `<SelectStage />` off `/`, but `/auth/login` (#567) still mounts it. With the sun, the grid and
the sky gone (fever-stage, #743), what's left of the scene outside fever is a still field of dim 1 px stars, on a
gradient to the retired `--pa-sky`.

**Options.**
- A. Keep the stars: the component keeps its WebGL scene and rAF loop, and the gradient becomes `--pa-bg`.
- B. Draw no scene: the component is a fixed layer on `--pa-bg`. The driver and its test go.

**Choice: B.** Outside fever the stars don't move, so A spends a WebGL context and a render every frame on a login
page to draw faint dots behind a form. B is what the page looks like with `?stage=off` today, minus the gradient. It
also stops select-stage reading fever-stage's `gridPhase`, so fever-stage can drop its dead grid state in a refactor.
`verify-select-stage.mjs` is unchanged: since #714 it checks `/` mounts no stage and stops there.

**How to undo.** Revert this PR. It brings back the scene, the driver and the gradient (with `--pa-sky`).
