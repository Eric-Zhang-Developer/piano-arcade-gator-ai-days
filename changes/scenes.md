## What shipped
`/play?bot=<name>` swaps the laptop keys for a seeded scripted player (MIDI stays live): `perfect`, `late`, `sloppy`, `rank-a`…`rank-d`, and `fever` (fills the fever gauge and holds fever; a chart too short for that is repeated end to end). An unknown name shows the list and plays normally; `&audible=1` also sends the bot's notes to a "Portable Grand" output.

## Where it lives
`web/src/game/scenes/index.ts` (settings in `scenesSettings`), `web/src/game/scenes/scenes.test.ts`, one line in `web/src/game/layers.ts`.

## How to check it
`verify: … pass at 3e492d9`. Headless Chrome frames in `.git/agent-evidence/scenes/`: `perfect` FULL COMBO then S (42 PERFECT), `rank-c` C at 76.2%, `late` 42 GREAT late by 42 ms (spread ±0), `fever` lit at combo 18, unknown-name notice; `perfect` stays 42/42 PERFECT through a 3 s Esc pause.

## Gaps
`?bot=perfect&audible=1` on the piano is not verified (Eric's, needs the piano). `late` reads +42 ms in the browser, not +40: the bot's zero comes from the frame clock, read ~2 ms after /play's own. songStart's atMs trails /play's zero by the stage build (#173), so the bot syncs from the first frame instead.
