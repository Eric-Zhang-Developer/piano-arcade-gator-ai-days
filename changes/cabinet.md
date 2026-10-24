## What shipped
`/cabinet`: PIANO ARCADE and PRESS ANY KEY. Idle 30 s, it shows attract (`/attract`, started automatically) for 60 s, then a perfect-bot demo of Twinkle on the piano, then the title again. A laptop key opens song select. A piano key starts `/play?song=twinkle&cabinet=1`, which returns to `/cabinet` after 30 s on the results with no input. A "Start kiosk" button goes full screen. Echoes of notes either iframe plays are ignored (50 ms, same pitch); the guard also covers attract, beyond the spec (`specs/decisions/cabinet-demo.md`).
## Where it lives
`web/src/app/cabinet/page.tsx`; `web/src/game/cabinet/` (`loop.ts` pure, `plugin.tsx`, `verify-cabinet.mjs`); the plugin is registered last in `web/src/game/layers.ts`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at 20df800 (`/play` unchanged without `cabinet`), and `node web/src/game/cabinet/verify-cabinet.mjs --out <dir>`: 13/13. That covers the full loop, keys, the 30 s return, and echoes from a stand-in DGX ignored in attract and the demo.
## Gaps
Not run on the DGX (Eric: leave it running; the demo plays on the piano, a key starts a game, and check whether the DGX echoes at all). The headless loop gives attract 20 s, not the spec's 5: in dev, attract needs about 8 s to load before it can play. The demo URL adds `&cabinet=demo` to the spec's, so the demo can start itself.
