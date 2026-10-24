## What shipped
`node web/src/game/offline-ready/verify-offline.mjs --out <dir>` builds, serves the build, and walks the game in Chromium with every request off loopback blocked (wifi off). A canary proves the block works. The walk: / → Enter → /play's start screen → a 42-PERFECT bot take → /sheet, then a take with the browser fully offline, and Saira loaded on / and /play. With wifi off, `pnpm -C web start` on a build made online serves the whole game from localhost. `next build` needs the network (next/font downloads Saira then), and `pnpm dev` offline falls back to system fonts, so build before leaving.
## Where it lives
`web/src/game/offline-ready/verify-offline.mjs`.
## How to check it
`verify-offline: pass, 0 off-machine requests` at 3667865 (exit 0). It can fail: with a Google Fonts `<link>` added to a scratch `layout.tsx` it printed `blocked: https://fonts.googleapis.com/css2?family=Saira` and exited 1. `verify.py --slug offline-ready` pass at 3667865.
## Gaps
Not verified by Eric: at home, build, wifi off, `pnpm -C web start`, play Twinkle on the DGX (Saira title, MIDI connects, the take ends). Unknown: whether `pnpm dev` with a warm `.next/cache` keeps Saira offline. `/operator` and `/attract` aren't walked (tools, not the game).
