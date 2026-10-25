# UI sound family: the song's key

Feature: `ui-sound-family` (#1167). Charts carry no key, so `keyOf` (`web/src/game/ui-sounds/timbre.ts`) infers one
by correlating pitch-class counts with the Krumhansl–Kessler key profiles (the Krumhansl–Schmuckler method).

## The profiles
Copied from two sources that agree, never from memory:

| | 1 | ♭2 | 2 | ♭3 | 3 | 4 | ♯4 | 5 | ♭6 | 6 | ♭7 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| major | 6.35 | 2.23 | 3.48 | 2.33 | 4.38 | 4.09 | 2.52 | 5.19 | 2.39 | 3.66 | 2.29 | 2.88 |
| minor | 6.33 | 2.68 | 3.52 | 5.38 | 2.60 | 3.53 | 2.54 | 4.75 | 3.98 | 2.69 | 3.34 | 3.17 |

- music21, `music21/analysis/discrete.py`, `KrumhanslSchmuckler.getWeights()` (aliased as `KrumhanslKessler`),
  https://raw.githubusercontent.com/cuthbertLab/music21/master/music21/analysis/discrete.py. Its docstring cites
  https://extras.humdrum.org/man/keycor/, which was unreachable on 2026-10-25.
- Robert Hart, "Key-finding algorithm", https://rnhart.net/articles/key-finding/. It gives the minor profile from
  la (its tonic), and the numbers match music21's tonic-first list. It credits the experiments to Krumhansl and
  Kessler, described in Krumhansl's *Cognitive Foundations of Musical Pitch*, chapter 2.

## Where the key comes from
- **Spec:** "select-layout from the focused row's roll pitches".
- **Choice:** each song's key is inferred once, at build time, from all its notes, as `Song.key` in
  `song-select/load.ts`. The stage card infers it from its chart.
- **Why:** the roll keeps only pitches relative to its lowest note (`row: pitch - low`), so it has no pitch classes.
  Eight bars also say less than the whole piece.
- **Undo:** drop `key` from `Song` and pass nothing. The sounds fall back to C major.
- **Checked:** Twinkle reads C major (`load.test.ts`). A C scale reads C major, and an A harmonic-minor scale reads
  A minor (`ab.test.ts`).
