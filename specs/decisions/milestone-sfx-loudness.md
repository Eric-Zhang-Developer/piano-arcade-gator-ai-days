# milestone-sfx: what "loud" is under a recording, and what a sound does there

**Context.** The spec asks that a milestone sound never lands on a loud stretch of an audio-track recording, with the
threshold measured. Today only the three `local/golden-*` charts have a recording, all one file
(`golden-hard/golden.mp3`, 199 s; easy and medium point at it). It's local-only, so nothing about it is in git.

**Measurement.** ffmpeg to mono 44.1 kHz s16le, RMS in 100 ms windows, in dBFS of the file (1987 windows):
p10 −31.8, p25 −26.0, p50 −18.4, p75 −15.7, p90 −14.5, p95 −14.2, p99 −13.8, max −13.4. Above −16 dBFS: 27% of the
windows, in 224 stretches, the longest 0.8 s. Above −18: 47%, longest 4.0 s. Above −20: 61%, longest 11.9 s. (An 8 kHz
pass gave the same numbers within 0.3 dB.)

**Options.**
- Threshold: −14 (2% of windows, too rare to matter), **−16 (the loudest quarter, stretches under a second)**, −18
  (half the song, stretches up to 4 s).
- What a blocked sound does: wait (it drifts off its visual, which the spec says to keep), skip (a fever start or a
  combo step goes silent), **soften**.

**Choice.** −16 dBFS. A sound whose first 300 ms touches a window above it plays **on time at 0.25 gain (−12 dB)**, so
it still lines up with fever-moment's flash or the clear card, but stays under the recording's peaks. The miss cue
is juice-sound's and skips the rule. At songEnd the recording fades out in 0.25 s and the rule reads no level, so the
rank hit, fanfare and NEW RECORD always play at full. The level is the file's, not scaled by the player's Recording
volume.

**How to undo.** `loudnessSettings` in `web/src/game/milestone-sfx/index.ts`: `loudDb` for the threshold, `softGain: 0`
to skip, `softGain: 1` to turn the rule off.
