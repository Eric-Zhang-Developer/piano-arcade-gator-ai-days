## What shipped
`/calibrate`: tap any key or piano key along to 12 clicks at 100 BPM (piano side stick on channel 10 when connected, else a Web Audio click). The mean tap offset over clicks 5–12 is saved as the latency offset, which `/play`'s slider then shows. Too few taps (<6) or too spread (>±40 ms) saves nothing and says which. A "Calibrate latency" link on `/` (#211).

## Where it lives
`web/src/game/calibration/index.ts` (math, settings in `calibrationSettings`), `web/src/app/calibrate/page.tsx`, the link in `web/src/app/page.tsx`.

## How to check it
`verify: … pass at 3e2ba9c`. Headless Chrome, `.git/agent-evidence/calibration/`: Space taps at +30 ms → "Latency offset 32 ms, spread ±1 ms" (timers fire ~2 ms late), then `/play`'s slider shows 32; random taps → "Too spread: ±50 ms", nothing saved.

## Gaps
The piano check is Eric's and not done: calibrate on the DGX, play Twinkle, and write both numbers here. The piano click path is untested (no MIDI in headless Chrome). The spec's "+400 ms clamps to LATENCY_MAX" was impossible at 600 ms between clicks (it pairs with the next click as −200); the line now says +200.
