# Wet Paint: findings

**The question** (spec `wet-paint`): can a WebGL2 stable-fluids canvas, driven live by MIDI, hold 60 fps at 1920×1080
under 10-note chords with the pedal down? Does the pedal's wet/dry difference read at a glance in the finished
painting?

## The measured answer

**(a) Frame rate, half measured.** 10-note chords every 500 ms for 20 s, pedal down (400 notes), through
`__wetPaint.play`, with `perf-budget/probe.js` loaded and its fever gauge faked on for the run. 1920×1080 at
devicePixelRatio 2: canvas 3840×1858, sim 961×465 (a quarter), dye at half.

| Sim | Frames | Frame work p50 | p95 | max |
|---|---|---|---|---|
| 961×465 (quarter) | 1281 | 0 ms | 0.2 ms | 4.2 ms |

- Frame work (the rAF callback's CPU time) passes the 6 ms bar by a wide margin, so no step down was needed.
- **Not measured:** the rAF interval's spread, and GPU time. The in-app browser pane was hidden for the whole session
  (no window showed it), and a hidden page doesn't run rAF, so the run used a 16 ms MessageChannel loop in place of
  rAF. Its intervals (p50 16, p95 16.3, max 26.3 ms) are that loop's pacing, not the display's. WebGL calls queue on
  the CPU and run on the GPU, which nothing here times (decision `perf-budget-gpu.md`). Whether this holds 60 fps is
  still open until someone watches it on a visible screen.

**(c) The pedal read test: 3 of 3.** The same 20 notes three ways (staccato with no pedal, legato with the pedal,
held chords with the pedal), framed and shown shuffled and unlabeled to a fresh subagent with no scripts or spec. It
named the legato and the chords as pedaled ("tall, turbulent, swirly blobs that have spread and bled into each
other") and the staccato as dry ("a small, smooth, dome-shaped blob sitting at the key"). The three paintings are in
`specs/features/experiments/shots/wet-paint/pedal-*.jpg`.

## Colors

The Parisian score's table of colors (1913), the only one known to come from the composer, as Gawboy & Townsend
translate it (MTO 18.2, 2012). Sabaneev (1911) and Myers (1914) disagree on E, B, F♯, A♭, E♭ and B♭. All three give
keys, not notes, so a note takes its key's color by its tonic, and the hex values are a rendering of the color words.
Both steps are this spike's, not the sources'. Details: `specs/decisions/wet-paint-colors.md`.

## What worked, what didn't

- **Didn't:** a narrow upward splat as a note. Pushed once, it sits as a dome by the key. Pushed every frame of a hold,
  the velocity adds up and the paint launches off the top. A wide force radius, open boundaries and low velocity
  damping each made it worse.
- **Worked:** a held note as a brush. Its ink source climbs from the key while it's held and the push is only a burst
  at the strike, so the fluid stirs and bleeds the paint instead of carrying it. Wet velocity damping of 1.2 keeps the
  paint on the canvas.
- **Worked:** drying on key lift with the pedal up. Staccato without the pedal leaves a row of small matte domes that
  read as dry at a glance, which is what made (c) pass.
- **Worked:** the framed state as a print in the kit's paper mat, caption on the mat's foot, matching the saved PNG.
- **Keep:** `paint.ts` (pure: keyboard geometry, pedal curve, brush, painter) and the stripped vendor solver with its
  dried layer.

## Recommendation: iterate

One more short time box, for what this one couldn't measure: frame intervals on a visible screen (Eric's DGX at
`localhost:3001/paint`), and Eric's one-minute noodle with a real pedal. The pedal read already passes, and the CPU
cost is small. If it holds 60 fps on the DGX, promote it through a spec.
