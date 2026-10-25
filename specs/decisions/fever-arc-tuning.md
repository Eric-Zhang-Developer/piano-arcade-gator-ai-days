# fever-arc: phase lengths, the shimmer, the tint, the pulse and the drain

**Context.** The spec fixes the shape (build, ignition on the next beat, sustain, release in about 400 ms, a handoff)
and leaves the numbers to the worker. eric-agent-3, 2026-10-25. All of them are in `arcSettings`
(`fever-arc/index.ts`), `meterSettings` (`fever-gauge/index.ts`) and `momentSettings` (`fever-moment/index.ts`).

## Phase lengths
- **Build** from 80% of the gauge (`buildFrom: 0.8`). Between the judge's `feverStart` and its beat the gauge is full
  and the build holds at its peak: the drop waits for the beat. At most one beat (600 ms at Twinkle's 100 BPM).
- **Ignite** lasts the moment's own `totalMs` (2 s), then **sustain**. **Release** 400 ms from the break's `atMs`.
  **Handoff** uses results-landing's `outMs` (400), so the amber is gone when the results land.
- **A break before the ignition beat** never lit anything, so it goes straight back to idle: no flash, no drain.
- **Undo:** `buildFrom`, `releaseMs`, `handoffMs` in `arcSettings`.

## The shimmer (the build's riser)
- A white band 18% of the fill's width crosses the meter's fill once a beat, at 0.35 alpha growing to 1.0 as the
  gauge nears full (`shimmerAt`). Beat-locked, so the build counts in to the drop. Reduced motion: none.
- **Undo:** `meterSettings.shimmerShare: 0` hides it.

## The tint (amber through the hand colors)
- **Round 1 tried a hue shift** of the spark color toward `#ffb02e` (37°) by 0.35. The blue hand's sparks (~215°) went
  teal: the short way from blue to amber crosses cyan, so it read as a third hand color. Rejected.
- **Choice: a warm core, the spec's "rim" option.** The sparks already mix the hand color with a white core (dust 30%,
  wisps 85%). In fever the wisps' core turns amber by the arc's heat (`uWarm` in `hit-particles/gl.ts`); the dust
  keeps the hand's color, so the hands still read. The stars carry no hand, so they move 70% toward amber
  (`arcSettings.tint`, was 0.35: grey in round 1's shots).
- **Undo:** `uWarm` set to 0; `tint` back to 0.35 or 0.

## The pulse
- In the sustain the stars' streak swells by `0.12 × (1 − beat)²` on each beat: a quick swell on the downbeat that
  settles before the next. Low, so it reads as breathing, not flashing. Reduced motion: none.
- **Undo:** `arcSettings.pulse: 0`.

## The attack
- The edge flash rose over 200 ms (`peakMs`), so the ignition frame was nearly dark (round 1). A drop hits on the beat:
  now 50 ms, about 0.7 of full on the first frame after the beat. **Undo:** `momentSettings.peakMs: 200`.

## The drain
- A cubic ease-in-out of the heat from 1 to 0 over 400 ms from the break's `atMs`, on the edges (90 px at 0.38 alpha,
  scaled by heat) and the meter's fill. The judge learns of a miss late (53–130 ms, see
  `miss-moment-curves.md`), so about 330 ms of it is visible. Reduced motion: a cut, no drain.
- **Undo:** `releaseMs`; `drainPx: 0` hides the edges' drain.
