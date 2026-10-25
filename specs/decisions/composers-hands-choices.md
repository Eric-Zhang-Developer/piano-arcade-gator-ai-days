# composers-hands: the choices the spec leaves open

- **Fixed velocity:** a roll whose every note-on has one velocity (a non-reproducing roll) plays at 80, hand-mode's
  `defaultVelocity`, and the page says "This roll records no dynamics". Undo: `rollSettings.fixedVelocity`.
- **The split's gap rule:** passages of 4 s. In each, the widest pitch gap inside a chord (notes starting within
  30 ms) with its midpoint in C3–C5 splits L from R. A passage with no such chord keeps the last split, and the first
  defaults to middle C. Nudges move one passage by semitones. Undo: `rollSettings.passageMs`, `minSplit`, `maxSplit`.
- **The spool correction:** with the roll's speed `1 + a·t`, `1/gap` is linear in t on an even passage. A
  least-squares line gives `a = slope / intercept`, and the player's time is `t + a·t²/2`. It runs only on a passage
  named as steady (`match.mjs --spool`), and rates under 1e-6 per ms are left alone. Undo: skip `unspool`.
- **The DTW cost:** equal pitch 0, unequal 1, a note in one sequence and not the other 1 (an edit-distance path).
  Notes within 30 ms are ordered by pitch in both sequences. A one-sided run of 8 or more notes is its own section: a
  repeat if it matches some chart stretch at 80% or better, else extra (roll only) or skipped (chart only). On a tie,
  the roll-only step wins, so the later pass of a repeated stretch is the one labeled repeat. Undo:
  `alignSettings`.
- **The seconds chart:** `bpm: 60`, so a beat is a second. `beatsPerBar` is one bar longer than the roll, so no bar
  line draws. The frozen chart format doesn't change.
