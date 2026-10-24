---
name: "Spike: can an acoustic piano play the game through the laptop microphone?"
depends_on: ["piano-midi-spike"]
owns: ["spikes/mic-pitch/"]
assignee: "eric"
---

# Mic pitch spike

A side quest Eric asked for (2026-10-24): the game hears only MIDI and laptop keys, so an acoustic piano can't play it.
One question: **can the browser hear which notes a piano plays, chords included, accurately and fast enough to judge?**
Throwaway evidence, only in `spikes/mic-pitch/`: it never touches `web/` and is never on the demo's path. Time box:
about 2 hours of agent time. Whatever is unmeasured by then is a Gap, not overtime.

Issue: #337

## Plan
1. **One page** (`index.html`, plain JS on `localhost`, no build) generates the test in code, as
   `spikes/piano-midi/index.html` does, and saves it as `truth.json`: 60 single notes C2–B6 (MIDI 36–95) 500 ms apart,
   velocity alternating 50 and 100, then 24 two-note chords (thirds, fifths, octaves) and 24 triads 1 s apart.
2. **Record:** the page plays the test to the DGX over Web MIDI while it records the laptop mic, with
   `echoCancellation`, `noiseSuppression` and `autoGainControl` off (Chrome's defaults treat music as noise). Send times
   map to the `AudioContext` clock with `getOutputTimestamp()`. Save the recording and the send log.
3. **Detect** over the recording in live-sized blocks, so latency is what a live run would see. First a hand-written
   method: an `AnalyserNode`-sized FFT, a harmonic sieve over the 88 piano pitches, an onset rule on rising energy.
   Then one pinned library if time allows: `pitchy` (McLeod, single notes only), essentia.js (multi-pitch) or
   `@spotify/basic-pitch` (a neural net), from an exact-version CDN URL or a vendored file. Record version and license.
4. Write `spikes/mic-pitch/FINDINGS.md` with the numbers below and the recommendation.

## Requirements
- **Matching:** a detection matches a sent note of the same pitch sent 0–150 ms (`NEAR_MISS_MS`) before it; any other
  is a false positive (octave errors counted apart). **Single notes:** matched out of 60, false positives per minute.
- **Chords:** a chord counts only when all its notes match. Also per-note recall in chords, by interval (octaves are
  the hard case for a harmonic sieve).
- **Latency:** MIDI send to detection per matched note: median, p5, p95. It includes the DGX's sound delay and the
  mic's input delay, so it's an upper bound for an acoustic piano; also measure send to audible onset (first block over
  the noise floor) so the detector's share is known. `calibration` removes a constant delay, not the p5–p95 spread.
- **Chart-informed:** the game knows which note to expect, so also score "is the expected pitch present then?", an
  easier question a build might ask instead of full transcription.
- **Two runs:** a quiet room, then the same test with drums on channel 10 (the piano-midi spike's band), since the game
  plays an accompaniment. Record the room, the laptop's position and distance from the speaker, and the DGX volume.

## Validation
The experiment is the validation. Each step is `action -> what you should see`.
1. **Without the piano:** detect over a recording made in code (`OfflineAudioContext`, harmonic-rich tones at the
   test's pitches and times) -> the scoring table prints. This proves the pipeline, not the piano.
2. **At the piano** (Eric sets it up; the agent can run it): play the test -> recording and send log saved, ~80 s a run.
3. Score both runs with each method -> one table per run and method. `verify.py --slug mic-pitch-spike` -> passes,
   /play unchanged.
- **Build** if the quiet run's single-note accuracy is ≥ 95% and send-to-detection p95 is ≤ 60 ms. Chords set the
  scope (single-note songs only if they fall short); the drum run says whether the band must stay off.
- **Park** at 80–95% or p95 60–100 ms, naming what might close the gap (a USB mic, the chart-informed score).
- **Drop** below 80% single-note or p95 over 100 ms (`GOOD_MS`).

## Defaults
- Prefer the hand-written method: a library is a fallback, and nothing is installed into `web/`.
- `mission.md` Not doing lists "live transcription on stage" and "AI in the core playing loop": a build recommendation
  says which it runs into. basic-pitch is a neural net, so building on it needs Eric to change the mission first.
- Recordings over 5 MB stay out of git (a `.gitignore` here; FINDINGS.md says where). Unmeasured stays `unknown`. The
  done note (`changes/mic-pitch-spike.md`, 3–8 lines) gives the recommendation, its deciding numbers and FINDINGS.md.
