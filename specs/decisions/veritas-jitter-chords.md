# veritas: Jitter leaves chord notes on time

**Context:** the spec has Jitter offset "each safe note" by up to ±60 ms. A chord whose notes get different offsets
has a spread over chord-sync's 30 ms, so chord-sync calls it rolled. By the spec's own `tally` rule, that is a false
alarm ("any unplanted chord rolled"), even though the judge is right. The Validation demands 0 false alarms.

**Options:**
- **A.** Jitter skips notes in a chord (`findChords`). Its plants stay pure timing.
- **B.** Jitter offsets a chord's notes together. That's no longer per-note jitter.
- **C.** Count a jittered chord's roll as planted. Then Jitter plants two kinds, and its found count mixes them.

**Choice:** A, the smallest. Chords are Chord Roller's job.

**How to undo:** drop the `inChord` filter in `jitter` (`web/src/veritas/players.ts`), and plant a jittered chord's
roll as `rolled`.
