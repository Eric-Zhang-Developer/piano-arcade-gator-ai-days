# golden-demo: where the bot's velocities come from

**Context.** The bot now presses at `note.velocity ?? KEYS_VELOCITY` (spec golden-demo, Requirement 2). The spec
asks for Golden's velocities from the sheet's marks: p, mp, mf, f and hairpins. The sheet has none in any of its 96
bars (`specs/context/findings.md`, 2026-10-25). Read as written, every note is mf, which is `KEYS_VELOCITY`: no change,
and Eric's "no dynamics" stays. The velocities themselves stay local with the charts (decision 003).

**Options.**
- A. Mark-driven levels as the spec describes. With no marks, every note is mf: nothing changes.
- B. Each bar's level from the recording's loudness in that bar. It's measured, not invented.
- C. An arrangement of our own: louder choruses, a melody over its accompaniment, accents.

**Choice: B.** The recording is what the chart already lines up with, so its loudness is the song's own shape: quiet
intro and outro, a softer bridge, full choruses. C would be our invention. A stays the rule for any chart with marks.
- **Measure:** RMS of each sheet bar's span in the recording (`sheet_bar_starts`), in dB.
- **Map:** linear in dB, from the bars' 10th percentile at p (49) to their 90th at f (96), clipped. Each note takes its
  onset bar's level, in both hands, and in all three difficulties.
- **For a chart with marks** (none yet): pp 33, p 49, mp 64, mf 80, f 96, ff 112; mf before the first mark; a hairpin
  ramps linearly to the mark that ends it, or one step (16) if none does.

The check is Eric's DGX listen. If it sounds wrong, C is the next thing to try, and it's his call as an arrangement.

**How to undo.** Strip `velocity` from the local charts: the bot falls back to `KEYS_VELOCITY`. The local tool's
`bar-loudness.json` can also be deleted, and `txt2chart.py` then writes no velocities.
