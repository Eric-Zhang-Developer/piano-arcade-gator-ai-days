# replay-keys: where the replay gets the take's key range

**Context.**
- /play fixes the take's keyboard from the chart as loaded, before any `transformChart` (`keysRef = staticRange(raw)`).
- replay-view's overlay only gets the chart after every plugin's `transformChart` (the `resultsPanel` contract).
- `makeLayout` then fell back to that chart's narrower range. Reproduced on origin/main for fur-elise, against the take's C2–C7 (36 white keys):
  - `hands=R`: the replay drew C4–C8 (29);
  - `hands=L`: C2–C6 (29);
  - `from=9&to=12`, with or without `tempo=70`: C2–C6 (29).

**Options (#419's two, and one more):**
- A. Pass the take's range into the overlay. That needs /play to hand it over: `app/play/page.tsx` (#600 holds it) or a new `ResultsPanelContext` field (a contract change).
- B. Recompute from the untransformed chart: a plugin mounted first in `layers.ts` keeps `staticRange` of the chart it receives, which is the chart as loaded. That's /play's own rule. The overlay reads it.
- C. Record `Frame.lowPitch`/`highPitch` from a plugin `draw` during the take. Rejected: under highway-zoom a frame's range is the zoom view, not the keyboard.

**Choice:** B. It's a new `replay-view/keys.ts`, one mount line, and one argument in `overlay.tsx`. `replay-view/index.ts` stays untouched, since #600 holds it.

**Undo:** remove the mount line and the overlay's last `makeLayout` argument.
