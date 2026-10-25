## What shipped
Each hit's MIDI velocity is matched by pitch and placed within the take's own range: per-take percentile, a 0.5-power curve, ff:pp 4×. The top tenth draws a thin shockwave ring on the hit line, in the hand's color and warmed by fever; there's no ring under reduced motion. `hitParticles.hit` takes an energy and a wisp-only flag for the juice call site.
## Where it lives
`web/src/game/touch-visible/` (`energy.ts`, `index.ts`, tests), `web/src/game/hit-particles/gl.ts`, the mount in `web/src/game/layers.ts`, `specs/decisions/touch-visible-choices.md`.
## How to check it
not verified locally; covered by CI. Unit tests: `vitest run src/game/touch-visible src/game/hit-particles` 19/19.
## Gaps
- The energy-scaled wisps and dust wait on juice's call site (#761 holds `juice/index.ts`). The key light (`core/highway.ts`) is a follow-up.
- Not measured, shipping on Eric's call to stop verification: the luma ratio (pp vs MISS, ff:pp) and perf.
- Not seen by Eric.
