# hum-level-spike: the choices the spec left open

eric-agent-5, 2026-10-25. Each is the smaller, reversible option; none touches `web/`.

- **A run also splits at an energy dip.** The spec's notes are runs of one semitone, split by unvoiced frames.
  - Clean Ode to Joy merged its two D5s at beats 51–52. The synthetic hum's 30 ms re-articulation gap is no wider
    than YIN's 30 ms window, so whether a wholly silent frame lands in it depends on the 10 ms frame grid.
  - The fix: a frame under half the level on both sides (`DIP`, looking `DIP_REACH` = 8 frames each way) counts as
    silence.
  - The self-test pins that exact pair and fails with `DIP = 0`.
  - Options were the dip, a shorter window (which costs low voices their YIN range), or a wider synthetic gap (which
    would hide the problem rather than fix it).
  - Undo: set `DIP = 0`.
- **validateChart's rules are copied into the self-test** (`shapeProblems` in `hum.mjs`), not run through vitest. The
  self-test then needs no `web/node_modules`, and a spike imports nothing from `web/`. `score.mjs` runs the real rules
  through level-forge's vitest check.
- **Tracker details:**
  - Box-filter decimation to about 16 kHz before YIN: a voice's fundamental sits far below the new Nyquist, and YIN's
    cost falls about fourfold.
  - YIN threshold 0.2, and a −40 dB gate under the loudest frame.
  - A 5-frame median, applied within voiced runs only.
- **Octave:** the lower median (an integer even for an even count), moved by `12 × round((65.5 − median) / 12)`. A median
  inside 60–71 stays where it is. The three truths' medians are 65, 71 and 71.
- **Two runs on one 8th:** the one held longer is the note. Every note ends by the next one's onset, since this is a
  melody.
- **The synthetic hums articulate:** both profiles leave 30 ms of silence before each note, after a 25 ms release,
  and attack in 15 ms. The spec's profiles didn't say how a hummer separates two notes of one pitch; without a gap,
  no tracker could split Twinkle's repeated notes.
- **forge's diff runs on** the converter's venv when present, else `python3`. It needs only the standard library.
- **The recording page:**
  - The click goes to the speakers, and headphones keep it out of the mic, as the spec allows. The page says so in
    gold.
  - An AudioWorklet stamps each block with its frame, so the WAV's time 0 is the count-in's first click.
  - The mic's input latency (tens of ms) isn't corrected. The 8th-note grid and score.mjs's one alignment shift
    absorb it.
- **The /play check** uses the game's own `window.__pianoArcade.press`, as `web/e2e/verify.mjs` does, on a dev server
  in this worktree.

How to undo any of these: revert the commit that names it; the spike is self-contained in `spikes/hum-level/`.
