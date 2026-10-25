# hit-particles: juice's 300 cap, 1.5 s wisps and 500 ms clear zone

**Context.** Juice-visual caps its 2D particles at 300, lets wisps live about 1.5 s, and clips every effect out of
the rectangle of any note due within 500 ms. The spec wants thousands of specks lingering 2–3 s, in a haze over the
falling notes, dim near the hit line.

**Options.** A: keep the clip for the GPU dust too (it would cut a hole round every note near the line, so no haze
over notes). B: drop the clip for the dust and wisps, and keep the notes readable by dimming the dust near the line.
C: remove juice's 2D particles and the clip altogether.

**Choice.** B. The GPU layer is blitted after juice's clipped drawing, not clipped; the shader dims each particle to
15% at the line, rising to full 20% of the screen above it. The clip still guards juice's 2D effects (lane light,
miss flash, hit flare, the new held bloom), so a neighbour's next note is never under a bright glow. The 300 cap and
1.5 s wisps stay only for the no-WebGL fallback, where juice's 2D particles are drawn as before.

**How to undo.** For A, draw `gpu?.draw` before `ctx.restore()` in `juice/index.ts`, inside the clip.
