# score-follow-spike: the choices the spec left open

Context: the spec fixes the question, the band, the follower and the measurement; these are the smaller calls made
while building it (eric-agent-7, 2026-10-25). Each is reversible in `web/src/game/score-follow/`.

- **Bass on a chord:** a bar whose first onset is a chord takes its lowest note, two octaves down.
- **The band enters with the first onset.** Events before the player's first note (Für Elise's pickup bar: its beat-0
  hi-hat and bass) never sound, on both clocks, and a bass note-off whose note-on was skipped isn't sent. Otherwise the
  band would play before the player does, and a bare note-off would break the "every note-on has its note-off" check.
- **Before the first press the follower waits at the first onset**, like flow's clock, and starts from it.
- **A stop isn't a tempo sample.** The onset that ends a wait resumes the band from that onset at the last tempo, and
  the interval across the wait doesn't enter the mean (flow's clock does the same with its `excess`).
- **Pause** halts the follower at the next unplayed onset and drops what was queued, so a resume isn't a burst.
- **The baseline's send time** is interpolated inside the 16 ms frame where flow's clock crosses the beat. In the
  browser it would go out at the frame, up to 16 ms later, so the table flatters the baseline slightly.
- **Asynchrony is per band note-on**, as the spec says: a downbeat with an onset counts its kick, hi-hat and bass, so
  downbeats weigh three times a plain beat. The signed median is printed beside the |ms| ones to show which way the
  band errs.
- **verify-follow.mjs checks the silence after songEnd, not after Esc → Quit:** `?input=test` never pauses (page.tsx),
  so Quit isn't reachable headless. The plugin's vitest drives quit, pause and songEnd and checks the silence on each.
- **Two variants beside the spec's follower,** behind `Tune` (default = the spec's): `phaseGain` corrects a share of
  each phase error, `trend` extrapolates the tempo samples' straight-line fit. They're measured by an env-gated sweep
  (`SF_SWEEP=1`), so FINDINGS.md can say what one more time box should try. The spec's follower is the answer.

How to undo: each bullet is a few lines in `follow.ts`, `index.ts` or the test.
