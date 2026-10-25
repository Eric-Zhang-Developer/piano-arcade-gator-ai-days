# miss-moment: the miss cue's level

**Context.** Validation (d): juice-sound's miss cue must sit at least 18 dB under the piano, both rendered through
their real code in an `OfflineAudioContext`. eric-agent-3, 2026-10-25.

- **Measured** (`window.__pianoArcadeMissCue()`, RMS over the cue's 0.12 s):
  - main's laptop synth voice (`laptop-sound/synth.ts`; sampled-piano #806 is still open), C4 at velocity 80, at
    `DEFAULT_PIANO_VOLUME`: −22.9 dB;
  - the cue at the default effects volume (0.5): at `missLevel` 0.15 (origin/main), 12.6 dB under, which fails; at
    0.05, −44.0 dB, **21.1 dB under**.
- **Choice:** `missLevel: 0.05`. It's the round value that clears 18 dB with room for a louder sampled piano to
  change the ratio either way. It's measured, not heard: Eric's ears on the DGX are the check that's left.
- **The gate:** at most one cue per 120 ms (`missGapMs`), so a dropped run of notes doesn't machine-gun.
- **Undo:** `missLevel: 0.15` and `missGapMs: 0` in `sound/index.ts`.
