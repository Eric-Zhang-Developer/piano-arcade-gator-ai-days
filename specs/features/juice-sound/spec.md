---
name: Event sounds: count-in, combo stingers, fever, full combo, rank
depends_on: ["core-loop"]
owns: ["web/src/game/sound/", "web/public/sounds/"]
assignee: "eric"
---

# Sound

The piano is the music, so there are no per-hit sounds (decision 001, row 8). Sounds play at events only, from the
laptop, mixed under the piano. In the reference videos the only game sounds clearly separate from the music were a
four-click count-in and end-of-song payoffs.

## Requirements
- Web Audio only, scheduled on the audio clock from `GameEvent.atMs`, not with timers.
- Sounds: no count-in click (`beat-track` plays the count-in, decision `beat-track-accompaniment.md`); a short stinger on each `comboMilestone`; a rising sweep
  on `feverStart`; a fanfare on `fullCombo`; a drumroll before the rank reveal and a hit when it lands; a quiet,
  low, distinct cue on `noteMiss` that can be turned off.
- Every sound comes from a file in `web/public/sounds/` with its license in `web/public/sounds/LICENSES.md` (public
  domain or CC0 only), or is synthesized in code. Nothing without a stated license.
- One master volume slider for effects, saved in `localStorage` as `pianoArcade.sfxVolume`, default 0.5. A mute
  toggle.
- Audio starts only after a user gesture (Chrome's autoplay rule).

## Validation
- Vitest: a pure scheduler maps a scripted `GameEvent` list to `(sound, startTime)` pairs exactly.
- Eric checks the mix on the piano: effects must stay under the piano, recorded once through the line-out.

## Defaults
- If a sound is hard to source under the license rule, synthesize it with oscillators and noise.
