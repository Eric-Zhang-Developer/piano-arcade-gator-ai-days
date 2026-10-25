# simon-says-spike: choices the spec leaves open

Context: the spec says how a run goes, not how the first one starts or what the laptop does with your own presses.

- **A Start button (Space or Enter) begins the first run**, the same control that becomes Again. Options: start on
  load / on the first key / a button. Chosen: the button, because Chrome lets the laptop's AudioContext sound only
  after a gesture, and a phrase that plays before anyone is looking would be wasted on a non-pianist.
- **`leadMs` 400**: from Start or Again to the first note, so the press itself isn't heard as part of the phrase.
- **The laptop sounds your presses** (the `tone()` voice) during your turn and only when no piano output exists. The
  DGX sounds its own keys.
- **Held keys light cyan** and the phrase's keys light the right hand's green. A wrong press shows red, and the key
  you missed stays lit.

How to undo: each is one line in `web/src/app/simon/page.tsx` or `simonSettings` in `web/src/game/simon/index.ts`.
