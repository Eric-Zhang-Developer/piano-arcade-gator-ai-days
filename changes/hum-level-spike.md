## What shipped
- A tech spike: hum a tune to a click, and `hum.mjs` turns the WAV into a local level. The tracker is YIN, plus a
  tuning offset, an 8th-note grid and an octave rule.
- Synthetic hums match 100% on all three pieces, clean and sloppy, against a 90% bar, and all six charts pass the
  library's rules.
- Eric's real hums are pending, so FINDINGS.md says **iterate**: five minutes of humming decides promote or kill.
## Where it lives
- `spikes/hum-level/`: `hum.mjs`, `truth.mjs`, `synth.mjs`, `score.mjs`, `index.html` (the recording page), `FINDINGS.md`. Content stays in the self-ignored `local/`.
- `specs/decisions/hum-level-spike-choices.md`, and the shots in `specs/features/hum-level-spike/shots/`.
## How to check it
- `node spikes/hum-level/hum.mjs --self-test` prints `self-test: ok`.
- `node spikes/hum-level/truth.mjs && node spikes/hum-level/synth.mjs && node spikes/hum-level/score.mjs` prints the
  table in FINDINGS.md.
- A saved hummed level played at `/play?song=local/hum-twinkle-sloppy` on a worktree dev server reached the results
  screen with 42/42 PERFECT.
## Gaps
- **Validation 3 (Eric's hums) is pending:** it needs Eric's voice.
- **The recording page has only met a synthetic mic stream,** not a real mic.
- **Held-note rhythm isn't scored,** because forge's diff checks onsets only.
- **Repeated notes sung legato with no dip will merge;** only real hums show how often.
