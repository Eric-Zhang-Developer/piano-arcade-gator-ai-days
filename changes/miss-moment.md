## What shipped
A miss is now quiet and shows where it happened. The missed note thins and greys over ~120 ms and is gone by 300 ms. Its key gets a grey cap for about 400 ms, and a wrong key pulses once in red. A broken combo of 10 or more drops its old digits over 200 ms, and a break at 50 or more dips the fever stage 15% for 100 ms. The old 85% stage wash on every miss is gone. The miss cue sits 21.1 dB under the laptop piano, at most one per 120 ms.
## Where it lives
`web/src/game/miss-moment/` (plugin, tests, `verify-miss.mjs`), `stage/index.ts` (`dip`), `sound/index.ts` (`missLevel`, the gate), `layers.ts` (mount); shots and a before/after WebM in `specs/features/miss-moment/shots/`; decisions `specs/decisions/miss-moment-*.md`.
## How to check it
`node web/src/game/miss-moment/verify-miss.mjs --out <dir>`: not verified locally; covered by main's scheduled full run. Unit tests: `pnpm -C web exec vitest run src/game/miss-moment src/game/sound src/game/stage` (39 passed).
## Gaps
The switch-offs didn't ship: `highway.ts` still draws its own full-width mauve MISS note over the new tail (#747 holds it), and juice still flashes its grey line (#761 holds it). Until those one-line changes land, the playfield's measured luminance barely moves (a miss 0.00094 before, 0.00086 after). Not heard or seen by Eric. The cue was measured on the laptop synth, not the sampled piano (#806) or the DGX.
