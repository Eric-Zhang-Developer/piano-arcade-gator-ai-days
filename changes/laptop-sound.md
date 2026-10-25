## What shipped
With no DGX connected, the laptop plays the piano part. A virtual "Portable Grand" MIDI output has a small Web Audio synth with pedal, All Notes Off, a 32-voice cap and channel-10 drums, so every feature that finds the piano by name sounds without a change. Laptop keys sound from their own key event on `/play`. The status line reads "Piano: laptop sound". The options panel has a "Piano volume" slider. A real DGX always wins, and plugging one in mid-page silences the laptop. `?midi=off` keeps it silent; `?midi=laptop` forces it on.

## Where it lives
`web/src/game/laptop-sound/` (synth.ts, index.ts, volume.ts, install.tsx, verify-laptop.mjs), installed in `web/src/app/layout.tsx`, laptop keys in `web/src/app/play/page.tsx` (`onInput`), the status in `web/src/game/core/input.ts`, the slider in `web/src/game/options-panel/`. Decision: `specs/decisions/laptop-sound-key-pitch.md`.

## How to check it
`verify: node …/web/src/game/laptop-sound/verify-laptop.mjs --out …/agent-evidence/laptop-sound/20261025T042741Z pass at d0d899c`. Vitest: `src/game/laptop-sound`, `options-panel`, `core/input` 21/21.

## Gaps
- Validation 3 (Eric, on the laptop with the piano unplugged: playable, latency acceptable?) not done yet. Rerun `/calibrate` in laptop mode first.
- Key to voice, in headless Chromium: 5.2, 20.1 and 0.4 ms. That's event to synth bookkeeping, not to sound out of the speakers, and one is over the ~15 ms target. Real latency is Validation 3's call.
- `/simon`'s own laptop presses are silent with laptop sound on (#626). The Z/X octave shift sounding the shifted note isn't checked headless.
- Synth voices only, no samples. The features' own beeps aren't migrated. song-preview, ui-sounds and operator-replay checks now load `?midi=off` for their no-piano steps (#630, #632, #633).
