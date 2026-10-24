# Restyle spike: findings

**Status: checks done, listen pending.** All four restyles pass the melody lock and the library test. Eric hasn't
listened yet, so the question's second half is open.

## The question
Can a local agent session restyle a library chart so that code confirms the melody's pitches, the chart passes the
library's checks, and a listener hears both the source and the style? Yes needs all four to pass the checks, and Eric
naming the source and the style for at least 3 of the 4.

## The runs (eric-agent-4's session, 2026-10-24, from `prompt.md`)
| Restyle | Lock + library test | Attempts until the lock passed | Melody / left-hand notes | bpm, beats a bar | Play it |
|---|---|---|---|---|---|
| `twinkle-trap` | pass | 1 | 42 / 24 | 140, 4 | `/play?song=local/twinkle-trap&hands=R&beat=trap` |
| `ode-to-joy-waltz` | pass | 1 | 62 / 160 | 132, 3 | `/play?song=local/ode-to-joy-waltz&hands=R&beat=waltz` |
| `minuet-g-ragtime` | pass | 1 | 128 / 512 | 96, 2 | `/play?song=local/minuet-g-ragtime&hands=R&beat=ragtime` |
| `fur-elise-lullaby` | pass | 1 | 186 / 92 | 48, 3 | `/play?song=local/fur-elise-lullaby&hands=R&beat=lullaby` |

- **Minutes:** about 4 minutes of session time for all four, from the brief to four passing charts with their harmony
  fixed (21:07 to 21:11 UTC). The runs weren't one at a time, as the plan says: the session wrote one script (`restyle.py`) with a function
  per style, then ran them in order.
- **Tokens:** not measured. The session's usage tool reports its context window, not tokens per run.
- **The lock never failed.** Every restyle moves onsets through a monotonic warp of each source bar, so order and
  pitch can't change, and no right-hand chord can appear.
- **The checks didn't catch the musical mistakes:**
  - The first pass gave Ode to Joy D major chords (it's in G).
  - Twinkle got C under every bar, because a tie went to I over a whole bar.
  - Für Elise got A minor throughout, because the melody's E–D♯ outweighed the bass.

  The session found them by printing each restyle's chords. It fixed them by setting Ode's tonic to G, preferring
  I/IV/V on ties, counting the left hand double, and taking a chord per half bar (Twinkle) or per source bar.

## What each style does
- **Trap:** the melody on a dotted-eighth grid inside each bar (0, ¾, 1½, 2½), with an 808-style bass on 1 and the
  "and" of 3. The drum pattern is hi-hat sixteenths, kick on 1, clap on 3 (#578).
- **Waltz:** each 4/4 bar becomes two 3/4 bars, long-short: oom-pah-pah, the bass on 1 and a triad on 2 and 3.
- **Ragtime:** each 3/4 bar becomes two 2/4 bars, its beats stretched 1½, 1, 1½. The left hand is stride: bass, chord,
  fifth, chord.
- **Lullaby:** the source's rhythm, slowed from 66 to 48 and made soft, with a rocking root and fifth per source bar.
  It's the weakest style change: only tempo, dynamics and the left hand differ.

## What we don't know yet
- **Listen pending:** Eric on the DGX, each play link, naming the source and the style.
- Whether the chord-picking rule (diatonic triads by weight) sounds right beyond the bars the session read.
- Recall: the prompt forbade recalling an arrangement. The left hands are textbook figures over triads the script
  chose, and no check can prove that.
- **#506:** restyles are judged with `hands=R` only. The judged rhythm is the session's, not a cited score's.

## Recommendation
**Iterate: run the listen.** If Eric names 3 of 4, promote with a spec that commits the four (all public-domain
sources, decision 003) and picks the pattern from the chart rather than the URL. If the lullaby is the miss, give it
its own rhythm warp first.
