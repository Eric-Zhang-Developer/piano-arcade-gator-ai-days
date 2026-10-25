## What shipped
The song select moves on one spring and never queues: keys, held keys, the wheel, chips and hover all go through `moveFocus`. The FocusBar glides to the focused row, Find's reflow glides rows to their new places, and the panel and headers settle as the focus lands. Reduced motion jumps straight to the end state.
## Where it lives
`web/src/game/select-motion/` (spring, flip, motion, recorder, FocusBar), `web/src/game/select-layout/index.tsx` (the swap to `moveFocus`), `specs/decisions/select-motion-*`, shots in `specs/features/select-motion/shots/`.
## How to check it
not verified locally: browser checks (`verify-select`, `verify-main`, `verify-finder`, `verify-move`) are covered by main's scheduled full run. Unit tests: `vitest run src/game/select-layout src/game/select-motion` 21/21.
## Gaps
Not verified, because the in-app pane was hidden and its frame timing can't be trusted: keydown-to-frame latency, hold and wheel p95, and Find's reflow at 40 songs under 200 ms. No 60 fps WebMs: nothing here records the page at that rate. Not seen by Eric.
