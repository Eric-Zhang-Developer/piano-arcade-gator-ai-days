# chunk-practice: one-bar labels and where the results panel scrolls

**Context.** The spec names links "Next: bars 9–12" and "Learn bars 5–8 again", but a chunk can be one bar (Für Elise's
bar 45). And focusing "Next" on /play's results screen scrolled it to the screen's top edge, under the HUD, hiding
"Chunk 1 clear" at 1280×720.

**Options.** (a) "bars 45–45"; (b) "bar 45". For focus: (a) plain `focus()`; (b) `focus({ preventScroll })`, then
centre the panel.

**Choice.** "bar 45" for a one-bar chunk (`barsLabel` in `chunks.ts`); every other chunk reads as the spec says.
Focus without scrolling, then centre the panel, so the verdict and the link are both in view.

**How to undo.** `barsLabel` returns `bars ${from}–${to}` always; the effect in `index.tsx` calls `focus()` alone.
