---
name: "Evenness: score how even your runs are, per hand"
depends_on: ["play-slots"]
owns: ["web/src/game/evenness/"]
assignee: "eric"
---

# Evenness

The four leading learning apps grade which notes you hit. They leave timing direction, evenness and dynamics
ungraded (`mission.md`, Why). With `timing-feedback` and `dynamics`, this feature closes that gap. Each hand gets an
evenness score for its runs, from the spread of the gaps between notes. It's a `resultsPanel` (play-slots).

## Requirements
- **A run:** 4 or more consecutive notes in one hand, each alone in that hand at its beat (no chord), with equal gaps
  in the chart, within 1/48 of a beat. Twinkle's opening C C G G A A G is one run, and the longer gap after the
  half-note G ends it.
- **Played gaps:** each gap is between two consecutive hit notes of a run, using press times
  (`take.events[eventIndex].timeMs`). A MISS splits the run. A piece with fewer than 3 played gaps is dropped.
- **Score per run:** `100 × (1 - sd / gap)`, clamped to 0–100 and rounded. `sd` is the population standard
  deviation of the played gaps, and `gap` is the chart's gap in ms at the chart's `bpm`. Steady playing scores near
  100. Gaps as spread as the beat itself score 0.
- **Score per hand:** the mean of its runs' scores, weighted by gap count.
- **The panel:** per hand, "Right hand evenness 91". Under it, the least even run, "Bars 5–6, right hand: gaps
  varied ±42 ms on a 300 ms beat". A chart with no runs gets "No runs to score in this song". The numbers come only
  from this take.
- **Laptop keys** count too, because only timing matters here.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`:
  - Twinkle's runs are found as described, and the half note ends a run.
  - A run played exactly on time scores 100.
  - Gaps alternating +20 and -20 ms on a 300 ms beat score 93.
  - Chord notes never join a run.
  - A MISS splits a run, and the hands are scored apart.
  - A chart with no runs gives the message.
- `verify.py --slug evenness` passes.
- In Chrome, with screenshots in the PR:
  1. `/play?bot=perfect` -> evenness 100 for the right hand.
  2. `/play?bot=sloppy` -> lower, and it names the least even run.
- On the piano (Eric; mark it in the done note): play the Minuet and say whether the run it names is one you felt
  was uneven.

## Defaults
- Runs of 4 or more. Change `evennessSettings.minRun` before changing the formula.
