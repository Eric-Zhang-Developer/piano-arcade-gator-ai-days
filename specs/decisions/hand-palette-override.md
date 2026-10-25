# hand-palette: a runtime override, not a token edit

**Context:** the spec changes no token until Eric picks. To show a candidate on /play, the experiment writes it into the settings objects the readers look up at draw time:
- `handColorSettings.colors` (notes, lit keys);
- `hudSettings.judgmentColors` (the HUD's counters);
- `meterSettings.fill` (the fever gauge);
- `juiceSettings.feverColor` (the fever glow).

It does that in `transformChart`, and restores the snapshot on `songEnd`, `quit` and `pagehide`.

**What it can't reach, and stays today's color in the comparison:**
- The highway's judgment word: a module-private constant (`core/highway.ts`, `JUDGMENT_COLORS`).
- The start screen's song preview: it kept today's violet left hand under B in the look loop, so it reads its colors before the override.
- The DOM's CSS tokens (`--pa-hand-r`, `--pa-hand-l` in `globals.css`) and anything that reads them.
- A client-side navigation away mid-take carries the override until the next full load.

**The simulation:** `&sim=` puts Machado's matrix in an SVG `feColorMatrix` with `color-interpolation-filters="linearRGB"`, where the paper's matrices apply. It's a CSS filter on /play's canvases, re-applied every 250 ms so late canvases are covered too. The DOM panels aren't simulated.

**The cue:** a swallowtail notch, a black V cut into each left-hand note's leading end. It is 42% of the pill wide and 7 px deep at 720, drawn on the overlay (a `draw` plugin). It comes from note-pills' `pillRect` with perspective off, as note-labels assumes too, and only on two-hand charts. In the adoption PR it moves into the pill's own path in `note-pills` and `core/highway.ts`.

**How to undo:** drop `?x=hand-palette`. Nothing persists.
