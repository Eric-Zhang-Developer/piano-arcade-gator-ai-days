# The Speaking Piano: findings

eric-agent-3, 2026-10-25. Spike under decision 004, issue #1153, spec `specs/features/speaking-piano/spec.md`.

## The question
Can the DGX say a short phrase so that a listener understands it, at least once a subtitle is shown after?

## The answer so far: listen pending
Nobody has heard it on the DGX yet, so the real answer (Eric at the piano, Validation d) is still open. What's
measured is below. STOI turned out to be a weak instrument for this, so treat it as a ranking of settings, not as
intelligibility.

## Lineage
Peter Ablinger's *Quadraturen III* resynthesized recorded speech on a computer-controlled piano, and was presented
with the words shown as text. University of Huddersfield repository record: Ablinger, Peter (2008) *Quadraturen III*,
https://eprints.hud.ac.uk/id/eprint/16044/. This spike does the same thing with smaller means: the voice's spectrum
cut into frames and struck on the 88 keys.

## What was built
- **The analysis** (`web/src/game/x/speaking-piano/analysis.ts`, one file for the page and Node). It runs
  pre-emphasis, then a ~93 ms STFT, then 88 semitone bands with formant weighting (full over 300–2500 Hz, −12 dB an
  octave outside). Each frame strikes its loudest n keys within 40 dB of the phrase's peak, with velocity linear in
  dB, and a soft top-octave cluster (C7, E7, G♯7) where 4–8 kHz holds ≥ 35% of the energy. Every frame strikes
  again.
- **STOI**, hand-implemented from Taal et al. (2011) in `stoi.mjs`. Self-test: identical 1.000; white noise at +10,
  0 and −5 dB SNR 0.930, 0.858 and 0.809; a 1 s delayed copy −0.003. It passes, so the sweep is validated by this
  test, not by pystoi (no download was made).
- **The renders** (`render.mjs`): macOS `say`'s default voice. The audio stays in `local/` (self-ignored) and is
  never committed. Each render is resynthesized on a simple additive piano (six partials, damped at the frame's end),
  because sampled-piano (#806) isn't on main, then scored with STOI against the TTS.
- **/speak** in the Duo look. Presets A, B and C are unlabeled until after playback. Speak is hold-to-talk, 3 s, in
  memory only. The caps are shown on screen, and All Notes Off plus pedal up go out at the end, on Stop and on
  pagehide. In the Lab, the entry is "The Speaking Piano".

## The sweep (STOI, additive-synth resynthesis against the TTS)

| fps × n | hello-judges | welcome | thank-you | mean |
|---|---|---|---|---|
| 8 × 6 | 0.408 | 0.459 | 0.483 | 0.450 |
| 8 × 10 | 0.475 | 0.514 | 0.503 | 0.497 |
| 8 × 14 | 0.493 | 0.531 | 0.539 | 0.521 |
| 12 × 6 | 0.569 | 0.490 | 0.441 | 0.500 |
| 12 × 10 | 0.562 | 0.596 | 0.559 | 0.573 |
| **12 × 14** | **0.570** | **0.606** | **0.627** | **0.601** |
| 16 × 6 | 0.495 | 0.497 | 0.513 | 0.502 |
| 16 × 10 | 0.517 | 0.600 | 0.636 | 0.584 |
| 16 × 14 | 0.541 | 0.604 | 0.646 | 0.597 |

**Pick: 12 frames a second × 14 keys** (`specs/decisions/speaking-piano-params.md`). More keys help at every frame
rate. 16 fps is no better than 12 on the mean, and it costs more notes a second on a real piano.

**Baselines, measured the same way:**

| | hello-judges | welcome | thank-you |
|---|---|---|---|
| white noise of the same length | 0.507 | 0.390 | 0.504 |
| another phrase's piano at 12 × 14 | 0.252 | 0.127 | 0.206 |
| this phrase's piano at 12 × 14 | 0.570 | 0.606 | 0.627 |

The piano carries the phrase: it beats a different phrase's piano by 0.32 to 0.48. But white noise scores 0.39 to
0.51, which is close behind. STOI clips the processed envelope to the clean one before correlating, so even noise
picks up the speech's shape, and a resynthesis in a different timbre isn't the degradation STOI was built for. So
STOI ranks the settings, and only a listener can say "understood".

## Live check, on the page (laptop's virtual Portable Grand, Phrase B)
195 note-ons were sent. The highest velocity was 100 (the cap), and the most in one frame was 14 (n). Every onset
lands within 0.33 ms of the 12 fps grid (the table's whole-ms rounding). The output got each message 120 to 300 ms
ahead. The phrase ended in All Notes Off on all 16 channels, then pedal up, and the subtitle showed after. No sound
claims: nobody listened.

## What worked
- One analysis file serving both Node and the browser, with Node 24's type stripping: no build step for the scripts.
- The keyboard on its side, with each spectrogram row beside the key it strikes, makes the idea legible at a glance.
- The caps are enforced twice, in the analysis and in playback, so no table can exceed them.

## What didn't, or isn't known
- STOI's floor (above). Its numbers aren't an intelligibility claim.
- The additive synth isn't the DGX: a real piano's attack and decay change everything. The MIDI files
  (`presets/*.mid`) are ready for the DGX itself.
- The mic path is untested with a real mic. The static check finds no network call in the folder, but the network log
  during a live mic run wasn't taken, because this machine's browser pane can't grant a mic.
- One voice, `say`'s default.

## Recommendation: iterate, pending Eric's listen
One more time box, only if Eric hears something at the DGX: try the velocity curve and the 16 × 14 setting on the real
piano, by ear. If he can't make out "Welcome to Étude" even with the subtitle, **kill**.
