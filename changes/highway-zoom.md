## What shipped
On charts wider than 22 white keys the highway pans and zooms to the keys the music is using, eased over about 400 ms, at least 15 keys wide, never cutting off a note on screen; the judgment line stays put. `?zoom=off` / `?zoom=on` override. Twinkle never zooms.

## Where it lives
`web/src/game/highway-zoom/index.ts` (settings in `zoomSettings`; #217), `makeLayout`'s view in `web/src/game/core/highway.ts` and the per-frame range in `web/src/app/play/page.tsx` (#221).

## How to check it
`verify: … pass at 4204ec1`. Headless Chrome, `.git/agent-evidence/highway-zoom/`: Für Elise shows 34 white keys in the count-in, 16 while the right hand plays alone, 22–26 with both hands; `?zoom=off` shows 33, today's.

## Gaps
The piano check is Eric's and not done: play Für Elise and say whether the motion helps or distracts (if it distracts, raise `zoomSettings.easeMs` first). Laptop key letters stay mapped from the chart's lowest pitch, so on a zoomed wide chart some letters are off-screen.
