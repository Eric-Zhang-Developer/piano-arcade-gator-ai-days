# Conductor spike: findings (clip pending)

**The question:** can in-browser hand tracking on the laptop's front camera find conducting beats reliably enough,
and can a phase-locked clock follow them closely enough, for a non-player to lead the DGX through a song?

**The answer so far:** half of it. The clock and the scheduler pass their bars. Detection and latency are
**unmeasured**: they need Eric's clip, which isn't recorded yet.

## Measured

**(a) Clock, detector, fist, scheduler and dynamics:** 17 of 17 Vitest tests pass
(`pnpm -C web exec vitest run src/game/x/conductor`).
- **60 → 90 BPM settles within 2 beats:** the rate is within 5% of 90 and the phase error under 30 ms, on a 75 BPM
  chart.
  - On a 60 BPM chart it can't: 90 is 1.5× that chart, and the 1.6× clamp leaves only 0.1× to catch up a third of a
    beat. It settles by the sixth beat instead.
  - Both cases are tested. The reasoning is in `specs/decisions/conductor-thresholds.md`.
- **`ratePull` 0.9** is the lowest value that meets 30 ms. At 0.85 the error is 34 ms, and at 0.75 it's 57 ms.
- **Monotonic** over a jittery beat list.
- **A hold** freezes the position and resumes without a jump.
- **The clamp** holds at 20 and 300 BPM.
- **A late beat:** the detector confirms a low point ~100 ms after it happens. The clock measures the beat's phase at
  the beat's own time, so the delay doesn't read as phase error. Tested.
- **The detector** finds strokes at known times on synthetic tracks. It drops beats under 250 ms apart, ignores a slow
  drift, and gives the same beats at half the hand size.

**(b) Detection precision and recall:** clip pending.

**(c) Beat to note-on latency:** clip pending.

**Camera frame rate:** not measured. The page shows it live (Camera fps), and the copied log carries it.

## What's built
- **`/conduct`:** the camera starts only on a click, with a camera-on dot. Stop and `pagehide` end the tracks.
  - The highway follows the conducted clock, and the hit line pulses on each beat.
  - The mirrored thumbnail shows the baton's last second.
  - The tempo shows as BPM and as a rate against the chart.
  - The state line reads prep, running, held, cut or fine. The log has a Copy button.
  - Clip mode is `?clip=1`.
- **The registry entry** (group Wow), plus a "Conduct this song" link on /play with `?x=conductor`.
- **`spikes/conductor/record.html`:** records the clip to a click and saves the click times.
- **`score.mjs`:** scores detection (±100 ms, one-to-one) and latency (`--latency`). Its self-check is
  `node spikes/conductor/score.mjs --check`.

## The CDN
- **The load:** the bundle is 156 KB, the WASM 13.5 MB and the model 7.8 MB, all from pinned URLs. In the in-app browser the
  cold load took 8.2 s to a working landmarker, on the GPU delegate. Whether that's a problem at the booth is unknown
  until Eric's try. A second visit is served from the browser cache. Logged in `specs/decisions/conductor-dependency.md`.
- **Promotion** would vendor all three.

## Recommendation
**Iterate: record the clip.**
1. Eric opens `spikes/conductor/record.html` and records about 2 minutes, with the hand framed and not the face.
2. He moves the two files into `spikes/conductor/local/`.
3. A worker then labels the beats, runs clip mode, and fills in (b) and (c) above.
