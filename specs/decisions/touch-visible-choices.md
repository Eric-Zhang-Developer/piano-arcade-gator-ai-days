# touch-visible: the choices the spec left open

**Context.** The spec leaves the curve's numbers, the bands, the match window, the seed and the mount to the worker.

**Choices** (all in `touchSettings` and `ringSettings`, so each is one number to change):
- **Exponent 0.5.** It's a compressive curve: energy climbs fast from pp, then flattens toward ff. Stevens' brightness exponent for a point source is about 0.5, but I found it only in secondary tables (Wikipedia's Stevens's power law page; a course table). I didn't read the 1957 paper, so this is a design choice, not a citation.
- **Floor 0.25,** so ff:pp is 4×, inside the spec's 3–5×.
- **The bands.** The top tenth rings; the bottom tenth is one wisp with no dust (`wispOnly`).
- **Matching.** A hit takes the latest unmatched note-on of its pitch within 250 ms. Both sides are stamped on wall time, because `noteHit.atMs` is the chart's clock.
- **The seed.** It's the chart's velocities thinned to 16, or 64 ± 20 when the chart has none. The take's own notes outweigh it after a phrase.
- **The mount.** The plugin goes after `laptopOctaves()`, not right after `scenes()`. Plugins wrap input outward, so after laptop-octaves the note-ons it taps carry the shifted pitch that `noteHit` judges. Bots and the sim are mounted earlier, so it still sees them.

**Left as follow-ups.**
- **The juice call site:** `gpu.hit(..., touchFor(id)?.energy, touchFor(id)?.wispOnly)` in `juice/index.ts`, which #761 holds. Until then, `hitParticles.hit`'s energy defaults to today's burst.
- **The key light** in `core/highway.ts`.

**How to undo.** Remove the `touchVisible()` line from `layers.ts`. Nothing else reads it yet.
