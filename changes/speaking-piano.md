## What shipped
A spike: /speak plays three preset phrases (macOS `say`, analyzed offline) or up to 3 s of your voice on the DGX, striking the voice's spectrum on 88 keys at 12 frames a second, at most 14 keys a frame and velocity 100. The voiceprint sits beside a keyboard turned on its side and becomes the roll behind a playhead, and the words appear only after playback. FINDINGS.md has the STOI sweep, its baselines and the recommendation (iterate, pending Eric's listen).
## Where it lives
`web/src/game/x/speaking-piano/` (analysis, playback, page, presets, tests), `web/src/app/speak/`, one line in `web/src/game/x/index.ts`; `spikes/speaking-piano/` (stoi.mjs, render.mjs, MIDI, FINDINGS.md; audio local only); shots in `specs/features/experiments/shots/speaking-piano/`; decision `specs/decisions/speaking-piano-params.md`.
## How to check it
`pnpm -C web exec vitest run src/game/x` (120 passed); `node --no-warnings spikes/speaking-piano/stoi.mjs` (self-test passes); `node --no-warnings spikes/speaking-piano/render.mjs` (the sweep). Live on the dev server: 195 note-ons, at most velocity 100 and 14 a frame, onsets within 0.33 ms of the grid, ending in All Notes Off and pedal up.
## Gaps
Not verified live: nobody has heard it on the DGX (Validation d is Eric's). STOI's floor is high (white noise 0.39–0.51), so its scores rank settings and don't measure intelligibility. The mic's live network-log check wasn't run (no mic grant in the browser pane); the static check passed. The resynthesis is a simple additive synth, not sampled-piano (#806).
