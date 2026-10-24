## What shipped
`/play?bot=<name>` swaps the laptop keys for a seeded scripted player (MIDI stays live): `perfect`, `late`, `sloppy`, `rank-a`…`rank-d`, and `fever` (the chart repeated to 84 notes so fever starts and holds). An unknown name shows the list and plays normally; `&audible=1` also sends the bot's notes to a "Portable Grand" output.

## Where it lives
`web/src/game/scenes/index.ts` (settings in `scenesSettings`), `web/src/game/scenes/scenes.test.ts`, one line in `web/src/game/layers.ts`.

## How to check it
`verify: … pass at a7fc1d2`. Headless Chrome frames in `.git/agent-evidence/scenes/`: `perfect` FULL COMBO then S (42 PERFECT), `rank-c` C at 76.2%, `late` 42 GREAT late by 42 ms (spread ±0), `fever` lit at combo 62, unknown-name notice.

## Gaps
`?bot=perfect&audible=1` on the piano is not verified (Eric's, needs the piano). `late` reads +42 ms in the browser, not +40: the bot's zero comes from the frame clock, read ~2 ms after /play's own. songStart's atMs trails /play's zero by the stage build (#173), so the bot syncs from the first frame instead. Pause/resume rescheduling is untested: /play doesn't emit them yet.
