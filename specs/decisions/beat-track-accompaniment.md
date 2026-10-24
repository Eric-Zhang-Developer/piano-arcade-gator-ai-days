# beat-track: an accompaniment track plays during the song

- Date: 2026-10-24   Decided by: Eric, with eric-agent-1   Feature: beat-track
- **Context:** The first playtest (`specs/context/findings.md`) showed the game is unplayable without a beat you can
  hear. `mission.md` said sounds play at events only, and decision 001 row 8 ruled out sounds separate from the
  piano because the reference videos had none. But in those games the song itself plays; here the player is the
  only music, so there was no clock at all.
- **Options:** A: a drum beat on the piano's own drum kit (channel 10), laptop clicks as a fallback / B: a laptop
  metronome only / C: a full band now.
- **Choice:** A. The sound comes from the same instrument and the same clock the player hears, and the spike proved
  drums through the DGX-660 sound distinct and in time (R5). It's a stand-in for a band: a later pattern (a sourced
  bass part, for example) reuses the same scheduler. Still no sound on each hit; event sounds stay as they were.
  `juice-sound` drops its count-in click and `piano-out` its piano count-in, since the beat covers both.
- **How to undo:** `?beat=off`, or remove the plugin's line from `web/src/game/layers.ts`; restore the mission line.
