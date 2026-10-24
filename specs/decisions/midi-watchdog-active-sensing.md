# midi-watchdog: when 3 s of silence counts as a stall

**Context.** The spec's 3 s rule assumes the DGX-660's Active Sensing (`0xFE`) reaches Chrome. The spike never
measured that: both of its layers filtered `0xFE` (`spikes/piano-midi/RESULTS.md`, R2), and piano-sim's
`activeSensingMs` is `null` until Eric records with `/sim?record`. The spec's Defaults give a fallback: no MIDI for
10 s while notes are due.

**Options.** A: always use 3 s (if `0xFE` never arrives, a player resting for 3 s would trigger reconnects).
B: always use the 10 s fallback (slow to catch a real stall). C: use 3 s only after a `0xFE` has arrived on the port,
and the fallback until then.

**Choice.** C. It needs no number nobody measured, and it switches itself to the faster rule on a piano that does
send Active Sensing.

**How to undo.** In `web/src/game/midi-watchdog/index.ts`, change `check()` to one rule.
