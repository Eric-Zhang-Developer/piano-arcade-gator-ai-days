# record-follows: the DSP and the follow loop's choices

Context: the spec (`specs/features/record-follows/spec.md`) leaves these to the worker and asks for each to be logged.
Every number here is a setting in code (`web/src/game/x/record-follows/`), so undoing one is changing it there.

| Choice | Taken | Why, and the alternative |
|---|---|---|
| Stretch engine | Phase vocoder, N 2048, output hop 512 (4× overlap), Hann, normalised by 1/((N/H)·0.375) | The spec's. N is ~43 ms at 48 kHz, under the ~100 ms the review calls common: a shorter window smears piano attacks less and keeps the seek lag (N/2) at 21 ms. |
| Phase locking | Identity locking: a peak is a bin above its two neighbours each side (and above 1e-4 of the frame's top); peaks advance by their instantaneous frequency, every other bin keeps its analysis phase offset to its nearest peak | Laroche & Dolson (doi:10.1109/89.759041), as described in Driedger & Müller's review §5.6 (https://www.mdpi.com/2076-3417/6/2/57). Scaled locking was the alternative; identity is the smaller one and passed the cents check. |
| Instantaneous frequency | From a second analysis frame one hop earlier at the same position | Exact for any ratio and after a seek; the alternative (the previous hop's frame) is wrong whenever the ratio changes. |
| Transients | A frame with over 2× the last frame's energy resets the phases to the analysis phases (not while frozen) | Keeps attacks sharp at a cost of one hop of phase discontinuity. |
| Freeze and resume crossfades | No explicit ramp: frozen, the frame position stops and the peaks' phases keep advancing (the spectral freeze); resuming is a seek, which resets the phases. The 4× overlap-add crossfades both over one window (43 ms) | The overlap-add is already a crossfade; a gain ramp on top would be a second one. Flow has no freeze: a held record there is silent. |
| Onset detector | Spectral flux on log(1 + 100·|X|), N 1024, hop 256, a peak over the mean ±0.15 s plus 6% of the loudest flux, chords merged within 40 ms; run at ~22 kHz (a 44.1/48 kHz file is decimated by 2) | 110/110 onsets on the synthetic moonlight-1; the settings were tuned at 22.05 kHz, so the page decimates rather than retuning. |
| Alignment | Its own DTW on log inter-onset ratios (each gap over the one before), gap cost 0.6, the first chart onset held to a detection within 0.25 s of audio.json's offset | Ratios ignore tempo, so drift lives in the map. composers-hands' `dtw` aligns pitch sequences with an integer cost, so it doesn't fit onset times. Map error on moonlight-1: median 6.6 ms, max 13.5 ms. |
| Steering | ratio = player tempo / record tempo half a beat ahead × (1 + 0.6 × beat error), clamped to 0.5–1.5×, slewed at most 3% per beat of record (the record's local beat) | The slew is the spec's; 0.6 is the gain that met (a) without overshoot. |
| Lock to 1.0 | Within 0.04 beat of the player and needing a ratio within 2% of 1 | A steady player hears the record untouched. |
| Settling | Through the take's first beat each note sets the ratio outright and re-seeks if the record is over 30 ms off it | A 3%-per-beat slew would spend the piece undoing a first guess off by one press's jitter. |
| Worklet loading | A Blob URL of the Stretcher's own source (`Stretcher.toString()` in a class expression), registered once per AudioContext | One copy of the DSP, the one vitest runs; nothing in `public/` to keep in step. The alternative was a `new URL(..., import.meta.url)` asset. |
| The synthetic recording | 4 partials, ±4% tempo swing over 32 beats, rendered at the context's rate | Drift in the map, not one offset; slow enough that a 3% slew can follow it. |
| Hold detection | Learn's chart clock standing still for 80 ms while the wall clock runs | A plugin can't see wait-mode's hold clock. |
| Trim | audio.json's `offsetMs` plus the player's Recording offset (audio-track's setting, which exists now) | The spec said there was no offset control; golden-demo added one, so the record moves with it as audio-track's does. |
