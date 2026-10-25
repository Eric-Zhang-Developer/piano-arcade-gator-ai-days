# duo-details: the groups' order, and the choices around them

**Context.** The spec asks for two groups under the results screen's first view, in a given order, and leaves the
exact layout to the worker.

**Choice.**
- **How I played** (`resultsLayoutSettings.played`): Timing (the page's `timing` card, always first), then
  `tempo-curve`, `evenness`, `dynamics`, `take-graph`, `bar-loop` (named Passes), `weak-bars` (Phrases), `chord-sync`,
  `records`. A results panel in neither list joins the end, in layers.ts order.
- **Do something** (`resultsLayoutSettings.doing`): `replay-view`, `take-midi`, as the kit's secondary Buttons in one
  row with no cards. The row and its heading hide when neither has a panel.
- **Two columns from 1100 px wide,** one below. The take graph spans both (`resultsLayoutSettings.wide`): at half
  width its 900-unit plot overflowed the card and gave the page a horizontal scroll at 1280×720 (before shot).
- **`grid-auto-flow: dense`:** a hidden panel can leave a half-width hole before the full-width graph; dense lets the
  next half card fill it. That can draw one card a slot earlier than the list says; the DOM order stays the list's.
- **The details run at the ceremony's width,** `min(1760px, 94vw)`, so the rank, the cells and the cards share one
  left edge. The readouts are left-aligned under their names, and their type is fluid up to 1920 for the video.
- **Options sits on How I played's heading row,** right-aligned, with the drawer's note saying Retry (the next take
  on this screen starts from Retry, not Start).
- **Phrases' weakest cell** is lit in primary, not red: red is for judgments only (visual direction).

**How to undo.** Reorder or empty `played` / `doing` / `wide` in `web/src/game/results-layout/index.tsx`.
