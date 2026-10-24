# easy-charts: an Easy take keeps the song's keyboard

**Context.** easy-charts' spec asked for an Easy take's keyboard to come from the Easy chart (after every
`transformChart`). static-keyboard, which landed first, computes it from the chart as loaded
(`web/src/app/play/page.tsx`, `keysRef = staticRange(raw)`), so hands=, loops and practice keep the song's keyboard.
An Easy take therefore shows the Normal song's keyboard.

**Options.** A: keep it; the keyboard is the same at either level. B: compute `keysRef` after the easy-charts
transform only, so Easy shows the Easy chart's range.

**Choice.** A (the planner, 2026-10-24, under Eric's delegation of reversible calls). It matches Eric's direction
that the keyboard keep a steady size and not move around, and a player moving up from Easy to Normal keeps the same
key positions. With the four-octave minimum most Easy charts would land on C2–C6 anyway.

**How to undo.** B: in `page.tsx`, set `keysRef.current = staticRange(easyCharts().transformChart(raw, params))`
(the Easy chart when `level=easy`, else the chart as loaded), a `fix(core-loop)`; restore this spec's Default.
