# highway-field: the choices the spec left open

**Context.** The spec fixes the layers, the calm rule and the tests. It leaves the horizon's height and curve, the
seams, the spill's falloff, the dither's amplitude and the fever tint to the look loop, logged here
(eric-agent-7, 2026-10-25).

**Choices** (all in `fieldSettings`, `web/src/game/highway-field/index.ts`):
- **Overlaps: `lighten`.** Every layer draws as an opaque color premultiplied over black, composited with `lighten`,
  so where a bar line, an octave line and a spill cross, the pixel takes the brightest of them, not their sum.
  - The calm rule's per-layer test then also bounds every overlap.
  - Plain `source-over` lets a downbeat over an octave line reach about 0.25 luma, past the 0.19 ceiling.
- **The haze: anchored to the visible far end.** It holds its peak down to the bottom of fever-gauge's
  `meterLayout` bar, then fades over 12% of the highway's height with a (1 − t)² curve.
  - **Why:** round 1 anchored it at y = 0, and the HUD band hid almost all of it.
  - **Peak:** 0.08 luma in a cool `#7cb7ff` (ui-tokens' `good`), 0.12 in fever.
- **Seams:** E/F only, at 0.04. B/C is the C octave line itself. Hierarchy: bar 0.12 > octave 0.08 > seam 0.04, all
  scaled by the notes' own depth ramp (0.35 at the top, 1 at the line).
- **Downbeat:** a bar line ramps linearly from its depth alpha to 0.18 over the 120 ms before it reaches the line.
  - After it crosses, it's under the keys, so the flash can't sit after the crossing.
  - Under reduced motion there's no flash.
- **Spill:** 40 CSS px up the key's own lane, (1 − d/40)², 0.16 at the line × the key's light strength.
  - It's the same color and release fade as the key (highway.ts's `light()`), so they read as one light.
- **Dither:** interleaved gradient noise, 1% peak to peak, on the haze only. It's computed per pixel when baked, so
  no gradient is quantized first.
  - Row means across the band at 1920×1080 step at most 0.385 of an 8-bit level (bar: ≤ 1).
- **Fever tint:** fever-stage's star color `#cfd8ff`, since the stage exports no live tint.
  - The amber is fever-gauge's, not the stage's.
  - Heat comes from the field's own `feverStart`/`feverEnd` tracking with the stage's 400 ms ease. Importing
    `stage/index.ts` would pull three.js into every page that draws a highway.
- **Baking:** one shared cache slot keyed by geometry, since highlight-reel draws through a new scratch context each
  frame. Under highway-zoom the layout moves, so the field re-bakes while the view eases.

**Kept as is:**
- Black-key lanes stay off (`tint` 0, Eric's call).
- juice-visual's lane light still draws over the spill: #761 holds `juice/index.ts`.

**How to undo.** Each value is one setting in `fieldSettings`. To undo the whole pass, revert the PR:
`highway.ts` goes back to its flat fill and lines.
