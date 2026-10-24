---
name: "Laptop octaves: Z and X shift the laptop keys an octave, and the keyboard shows the keys they play"
depends_on: ["highway-zoom", "note-labels"]
owns: ["web/src/game/laptop-octaves/"]
assignee: "eric"
---

# Laptop octaves

Judges will play on laptop keys. Core's `keyMap` (`web/src/game/core/input.ts`, core-loop's) maps A to ; and the
black keys between to 10 white keys up from the chart's lowest note. On a wide chart that's the bottom of the range,
and with highway-zoom those keys and their letters are often off-screen (highway-zoom's done note, Gaps). This
feature moves the laptop map by whole octaves, by hand with Z and X and by itself when the zoomed view leaves it
behind, and shows on the drawn keyboard which keys the laptop plays.

Issue: #273

## Plan
1. **A `fix(note-labels)` PR** first (not `owns`: backlog pill-match owns `web/src/game/note-labels/`): note-labels
   exports `setLaptopShift(semitones)`, 0 by default, and its laptop letters come from `laptopLetters(lowest +
   shift)`, recomputed when it changes. Nothing changes until something calls it.
2. `feat(laptop-octaves)`, with the done note: `web/src/game/laptop-octaves/`, the pure position rules below with
   their tests, and a plugin, one line in `layers.ts` right before `noteLabels()`: after scenes and the sim, whose
   bots replace the keys device with one of kind `test`, and before note-labels, so note-labels sees the shifted
   pitches. `wrapInput` shifts laptop-key events and listens for Z and X from the device's start to its stop; `draw`
   records the frame's range and draws the highlight; whenever k changes, the plugin calls `setLaptopShift(12 × k)`;
   `startPanel` is the hint line. Core's key map doesn't change.

## Requirements
- **Positions:** the map is today's `keyMap(lowest)` moved by `12 × k` semitones. k starts at 0, so without Z, X or
  a panning view the laptop plays exactly what it plays today. `n(k)` counts the map's 10 white keys inside the
  frame's visible range (`lowPitch`..`highPitch`); before the first frame, inside the chart's whole padded range.
- **Z and X:** k − 1 and k + 1, only to a position with `n ≥ 5` whose keys all stay in 21–108; otherwise nothing
  happens. Ignored with Meta or Ctrl held, on key repeat, and while paused. The listener lives only while the keys
  device runs, so the results screen (records' initials) never sees it.
- **No following:** k never moves by itself; only Z and X move it (`static-keyboard`: the keyboard holds still for
  the whole take, so the map does too). This replaces the earlier rule that moved k to the position with the most
  keys on screen whenever `n(k) < 5`.
- **Held keys:** a release always releases the pitch its press played, even when k changed in between.
- **Laptop keys only:** devices of kind `keys`. MIDI, `?input=test` and scenes' bots pass through untouched.
- **The highlight:** a `--pa-cyan` bar (cabinet chrome: selection) along the mapped keys, on the plugin's own layer,
  clipped to the visible range, with "Z" and "X" at its ends when that move is allowed. Letters stay note-labels'.
  None after the first MIDI note-on since the page loaded, as note-labels' `auto` switches, so piano takes (the
  video) don't carry it.
- **The hint:** "Z / X: octave down / up" under Start, only when the chart's own pitches don't all fit the map at
  k = 0 (`static-keyboard`; at 198c902: not on twinkle or minuet-g, on the other eight songs), with
  `data-capture-hide`.
- **Settings:** the 5-key threshold lives in `octaveSettings`.

## Validation
- `pnpm -C web test`: on Twinkle's range k stays 0 and Z and X are refused; on frames whose range jumps from C2 to
  C6, k stays put; a press, then an X, then the release gives an off on the pressed pitch; the hint shows on
  fur-elise and not on twinkle or minuet-g; a MIDI device's events pass unchanged, and after its first note-on `draw` draws nothing.
- `verify.py --slug laptop-octaves` passes, Twinkle unchanged.
- In Chrome, laptop keys, `/play?song=fur-elise`: the highlight and its letters stay on screen through the take
  (screenshots at the count-in, the right hand alone and both hands). On `/play?song=chopin-prelude-4`, press X, then
  A -> the key lit is an octave above the one A lit before.
- A stranger's first 60 seconds (someone who hasn't played Piano Arcade; mark it in the done note): a laptop, `/`,
  Für Elise with both hands, no help beyond the screen. Note whether they find the keys before the first note, how
  many notes they hit in 60 s, and what they said about the highlight moving.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with
`design-taste-frontend`'s step 8, "Look", at 1280×720 and 1920×1080 plus reduced motion. Before and after screenshots
in the PR.

## Defaults
- No sound or flash on a refused Z or X.
- Log choices the spec doesn't make in `specs/decisions/laptop-octaves-*.md`.
