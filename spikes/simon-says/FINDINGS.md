# Simon Says spike: findings

**Status: playtest pending.** Eric hasn't run the DGX playtest yet, so the question is open.

## The question
Can a non-pianist on the DGX repeat a growing phrase from a real song long enough to want another go? Yes means a
non-pianist reaches round 8 or later (a 9-note phrase played to them) and asks to go again unprompted.

## The measured answer
None yet: no runs on the DGX. When it's run, paste the run list `/simon` shows (song and round, per run) here, and
note who asked to go again.

## The build's state
- `/simon?song=<id>` (Twinkle by default; links to Ode to Joy, Minuet in G, Für Elise), linked from no other screen.
- The DGX plays round k's first k + 1 melody notes on channel 1 at the chart's tempo, or the laptop plays them.
  "Your turn" follows 300 ms after the last note, and the next round starts 800 ms after a clean repeat.
- One wrong pitch, exact octave, ends the run. There's no time limit. Laptop keys and the piano both work.
- Checks: `simon.test.ts` (10 tests, synthetic charts); `verify-simon.mjs` passes headless on laptop keys (round 1
  to "Round 2", a wrong key to "Run over · round 2", Again to round 1, no console errors, no page scroll).
- Not checked: the DGX playback's timing, and that nothing hangs after Again or leaving the page. Web MIDI doesn't
  run headless.

## What worked / what didn't
Not known until the playtest.

## Recommendation
**Iterate: run the playtest.** Two or more non-pianists, a few runs each, on `/simon` with the DGX connected.
