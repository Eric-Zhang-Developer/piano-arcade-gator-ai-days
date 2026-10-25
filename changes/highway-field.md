## What shipped
The dark space the notes fall through gets a field, drawn by `highway.ts` under the notes:
- a cool haze at the far end, held under the HUD band;
- hairlines bar > octave > E/F seam, fading toward the top on the notes' own ramp;
- a 120 ms downbeat as a bar reaches the line;
- a held key's light pooling 40 px up its lane;
- a 1% dither in the haze;
- the haze warming in fever.

Every layer stays under the dimmest note's luma (the calm rule, as a test).
## Where it lives
`web/src/game/highway-field/`, the hook in `web/src/game/core/highway.ts`, `drawBarLabels` in `web/src/game/bar-lines/`, the fever follower's mount in `web/src/game/layers.ts`, `specs/decisions/highway-field-look.md`, shots in `specs/features/highway-field/shots/`.
## How to check it
not verified locally: no browser check of its own. perf-budget's `perf.mjs` is covered by main's scheduled full run. Unit tests: `vitest run src/game/highway-field src/game/bar-lines src/game/black-key-lanes src/game/core` 72/72.
## Gaps
- Perf not measured: the in-app pane was hidden, so rAF stalls and `__perfProbe` counts no honest frames.
- No 1280 shots for maple-leaf-rag or the held chord; 1920 covers them.
- juice's lane light still sits over the spill until #761 frees `juice/index.ts`.
- Black-key lanes stay off; back on is Eric's call.
- Not seen by Eric.
