# Hum a level: findings

eric-agent-5, 2026-10-25. Tech spike under decision 004, issue #522.

## The question
Can a melody hummed to a click be turned into a chart whose notes match the melody, and does that chart pass the
library's rules?
- **Yes** needs three things:
  - the synthetic "sloppy" profile matches at least 90% on 3 of 3 pieces;
  - Eric's real hums match at least 80% on both pieces he hums;
  - every chart passes the rules.
- **No** is sloppy under 90% on 2 or more pieces, or a real hum under 50%.

## The answer so far: the synthetic half holds; hums pending
`node spikes/hum-level/truth.mjs && node spikes/hum-level/synth.mjs && node spikes/hum-level/score.mjs`:

| piece | hum | share (matched/truth) | hummed, unmatched | tuning (cents) | aligned | library rules |
|---|---|---|---|---|---|---|
| twinkle | clean | 100.0% (42/42) | 0 | 0 |  | pass |
| twinkle | sloppy | 100.0% (42/42) | 0 | -40 |  | pass |
| twinkle | eric | pending | | | | |
| ode-to-joy | clean | 100.0% (62/62) | 0 | 0 |  | pass |
| ode-to-joy | sloppy | 100.0% (62/62) | 0 | -40 |  | pass |
| ode-to-joy | eric | pending | | | | |
| minuet-g | clean | 100.0% (128/128) | 0 | 0 |  | pass |
| minuet-g | sloppy | 100.0% (128/128) | 0 | -40 |  | pass |
| minuet-g | eric | pending | | | | |

- **Tuning:** the tracker reads the sloppy hums' tuning as −40 cents, the profile's exact flat, so the circular mean
  does its job.
- **Playing it:** a saved hummed level (`hum-twinkle-sloppy`) opens at `/play?song=local/hum-twinkle-sloppy`. The
  game's test-input bot played it to the results screen: 42/42 PERFECT, rank S
  (`specs/features/hum-level-spike/shots/play-hum-twinkle-sloppy-results.jpg`).
- **The recording page** writes the WAV hum.mjs reads: 16-bit mono at 48 kHz. It was checked with a synthetic mic
  stream, not a real mic, so Eric's first take is also the page's first real run.

## What worked
- YIN plus a median and a global tuning offset is enough for a steady harmonic tone: no octave errors on any piece.
- The planner's sloppy profile (40 cents flat, ±30-cent vibrato, 50 ms glides, ±30 ms jitter, noise 30 dB down)
  costs nothing. The 80 ms minimum note drops the glides, the tuning offset absorbs the flat, and the 8th grid
  absorbs the jitter.
- The whole path runs in about 1 s a piece and needs no dependency. `hum.mjs --self-test` covers the spec's five
  cases plus the repeated note.

## What didn't, or isn't known yet
- **Repeated notes are the weak spot.** Clean Ode to Joy first lost one of its two D5s: the re-articulation gap was
  no wider than YIN's window. An energy-dip split fixed it (decisions). A real hummer who glides legato into a
  repeated note ("mmm-mmm" with no dip) will still merge the pair. Only real hums can say how often.
- **The synthetic voice is kind.**
  - Its loudness is flat, so the dip rule never fires inside a note. A real voice's swells might split one note into
    two.
  - It has no breath or consonants, and a strong fundamental, so there's no octave trap.
- **Rhythm on held notes isn't scored.** forge's diff matches pitch and onset only. Durations are rounded to the
  nearest 8th and cut at the next onset, so a held note sung short reads as short.
- **The mic's own latency** (tens of ms) isn't measured. score.mjs's one alignment shift covers a constant offset,
  not drift.

## What to keep
- `hum.mjs` as the seed of phase 2's analysis: WAV in, chart out, with the spec's rules plus the dip split.
- `synth.mjs` + `score.mjs` as its regression table.
- The recording page's worklet timing, so time 0 is the first click.

## Recommendation: iterate, for one short box
The synthetic half of Yes holds with room: 100% against a 90% bar. The real half is the actual question, and it
needs about 5 minutes of Eric:
1. Serve the repo (`python3 -m http.server 8000`), open `localhost:8000/spikes/hum-level/` with headphones on.
2. Hum Twinkle and Ode to Joy once each.
3. Put each WAV in `spikes/hum-level/local/`.
4. Run `node spikes/hum-level/score.mjs`. It adds the `eric` rows, with an alignment shift if a take starts late.

If both clear 80%, **promote**. Phase 2 is a spec of its own: a page that records and saves through a server route,
reusing `hum.mjs` as its analysis. Nothing of it is built here. If a real hum lands under 50%, **kill**, unless the
miss is the repeated-note merge, which has a known next fix (onset detection from the spectral flux, not level alone).
