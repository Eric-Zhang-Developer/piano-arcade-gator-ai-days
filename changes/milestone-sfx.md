## What shipped
Layered milestone sounds, never per hit: combo steps (climbing with the count), fever start (a riser that lands on the flash's peak), the clear card's CLEAR / FULL COMBO / ALL PERFECT, the rank hit, the full-combo fanfare and NEW RECORD at its stamp. Each voice is a few synthesized layers (body, shimmer, noise). Under a recording, a sound landing on a loud stretch (above −16 dBFS, measured) plays on time at −12 dB. Mute, the effects volume, the miss cue and wait mode work as before; juice-sound's scheduler is still the one place sounds are scheduled.
## Where it lives
`web/src/game/milestone-sfx/` (voices, clear and NEW RECORD timing, loudness rule, tests), `web/src/game/sound/index.ts` (`scheduler`), `web/src/game/audio-track/index.ts` (`recordingLevelAt`), `specs/decisions/milestone-sfx-loudness.md` and `milestone-sfx-mix.md`.
## How to check it
`pnpm -C web exec vitest run --passWithNoTests src/game/milestone-sfx src/game/sound`: 300 hits schedule only the milestones, the miss-cue setting, Mute zeroes the gain, wait mode, the loudness rule on a scripted envelope. Not verified locally; covered by main's scheduled full run. Not heard by Eric.
## Gaps
- **Not heard:** no one has listened on the DGX yet, with or without a recording. Levels are a first guess.
- **Loudness:** measured on the one recording there is (Golden). The level is the file's, not scaled by the Recording volume.
- **No Lab variants;** the spec allows them, and the default set ships first.
- **Rebase:** #600 also changes `web/src/game/sound/`; whichever lands second rebases.
