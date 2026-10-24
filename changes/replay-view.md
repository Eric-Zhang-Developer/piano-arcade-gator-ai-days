## What shipped
**Watch replay** on the results screen (for any take with a press). It opens a full-screen highway, drawn with core's own `makeLayout` and `drawHighway`:
- **What it shows:** each note turns to its judgment once it was judged, each press is a ring in its lane, and keys light while held.
- **Timing:** it runs at 1× from one bar before the first press to one bar after the last release, while piano-out plays the take on the piano from the same start. Without a piano it runs silent and says so.
- **Stopping:** Esc, Stop or the end closes it and stops the piano.
## Where it lives
`web/src/game/replay-view/` (`index.ts` clock, highway state and plugin; `overlay.tsx`; `replay-view.test.ts`; `verify-replay.mjs`), one entry in `web/src/game/layers.ts`, `specs/features/replay-view/screens/replay-mid.png`.
## How to check it
- `verify.py --slug replay-view` passed at 9d441f7.
- `node web/src/game/replay-view/verify-replay.mjs --out <dir>` passed on `/sim`'s fake piano:
  - 42 replayed note-ons, each sent within 0.10 ms of its marker reaching the line, and within 13.2 ms of the first frame drawn past it;
  - Esc closed it.
## Gaps
- **Not verified on the piano** (Eric): the DGX and the markers together, nothing hung after Stop.
- **Sim log:** the spec's check says "the sim's log shows each replayed note"; `/sim`'s log shows only input, so the check reads the fake piano's sent messages instead.
