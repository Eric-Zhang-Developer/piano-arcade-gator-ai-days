---
name: "Hum a level spike: a tune hummed to a click becomes a local level, scored against the melodies we already chart"
depends_on: ["level-forge", "song-pack-1", "minuet-g"]
owns: ["specs/features/hum-level-spike/", "changes/hum-level-spike.md", "spikes/hum-level/", "specs/decisions/hum-level-spike-"]
assignee: "eric"
---

# Hum a level (spike)

Issue #522. Eric's spike idea (2026-10-24, relayed by eric-asking-agent): "Hum a level: hum a tune and it becomes a
level". The issue says it follows the spike guideline: "one question, a time box, findings at the end". It's a tech
spike under decision 004. It lives in `spikes/hum-level/` and edits nothing in `web/`. A hummed level is the
hummer's own notes, so it stays local and is never committed.

Level forge (done) turns a public-domain MIDI file into a local level that `/play?song=local/<id>` plays
(`web/public/songs/local/.gitignore`, `changes/level-forge.md`). This asks whether a voice can stand in for the file.
That's a booth moment that needs only the laptop: hum a tune, then play it.

## The question
Can a melody hummed to a click be turned into a chart whose notes match the melody, and does that chart pass the
library's rules?
- **Yes:**
  - on the synthetic hums (below), the "sloppy" profile matches ≥ 90% of the melody's notes on 3 of 3 pieces;
  - Eric's real hums match ≥ 80% on both pieces he hums;
  - every chart passes the library's rules.
- **No:** the sloppy profile is below 90% on 2 or more pieces, or a real hum is below 50%.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state. With no real hums yet, it reports
  the synthetic table and says "hums pending".

The bars are the planner's, not measured.

## The pieces and the truth
- The melodies are the right hand of three committed charts: `twinkle`, `ode-to-joy` (Mutopia 528) and `minuet-g`
  (Mutopia 75).
- Each melody is its **skyline**: the highest right-hand note at each onset.
- `truth.mjs` writes each skyline as a chart to `local/<id>.truth.json`. It's derived, so it stays local with the
  rest.

## The code (all committed, in `spikes/hum-level/`; content in `local/`, self-ignored: `*` then `!.gitignore`)
- **`hum.mjs`:** a plain ES module with no dependency, run as `node spikes/hum-level/hum.mjs <wav> --bpm <n>
  --beats-per-bar <n> --id <id> [--save]`. Steps:
  - Read 16-bit PCM WAV, parsed by hand.
  - Track f0 with YIN, written in the file, over the voice range (about 70–1000 Hz), and drop unvoiced frames.
  - Smooth with a median filter, then estimate a global tuning offset (the circular mean of each frame's cents
    from the nearest semitone). A flat hummer still lands on the right notes.
  - Snap to semitones. A note is a run of one pitch lasting at least 80 ms.
  - Quantize to the click's grid, with onsets and durations to the nearest 8th and at least one 8th long. The
    recording's time 0 is the first beat after a one-bar count-in.
  - Shift by whole octaves so the median pitch sits in MIDI 60–71.
  - Write a chart that `validateChart` accepts: hand R, `source` `Hummed to a click (hum-level-spike)`, title and
    composer "Hummed". `--save` writes `web/public/songs/local/hum-<id>/chart.json` and refuses an existing folder,
    as `forge save` does. That path is gitignored. The script prints the `/play?song=local/hum-<id>` URL.
- **`synth.mjs`:** synthetic hums from each truth chart, at its BPM, with a one-bar count-in of silence. The tone is
  a harmonic tone with falling partials, which stands in for a voice. Two profiles, both seeded so a run repeats:
  - **clean:** in tune, on time;
  - **sloppy:** the planner's guesses at a casual hummer:
    - the whole tune 40 cents flat;
    - ±30 cents vibrato at about 5.5 Hz;
    - 50 ms glides between notes;
    - ±30 ms onset jitter;
    - noise about 30 dB down.

  It writes WAVs to `local/`.
- **`index.html`:** the recording page, plain JS on `localhost` with no build.
  - It plays a click at a chosen BPM with a one-bar count-in, records the mic and downloads a WAV.
  - It keeps the click out of the recording by playing it through headphones, or the worker logs another way.
  - The mic gets `echoCancellation`, `noiseSuppression` and `autoGainControl` off. That follows the mic-pitch spike's
    spec: Chrome's defaults treat music as noise.

## The measurement
For each piece × input (clean, sloppy, Eric's hum):
- `python3 game-tools/forge/forge.py diff <hummed chart> local/<id>.truth.json` gives share, matched and
  forged_unmatched. Run it with the converter's venv, as forge's docstring says.
- **One alignment allowed:** if a real hum sits a constant whole number of 8ths late or early (a late start), also
  diff a shifted copy. Report both numbers and the shift.
- **The library's rules:** `FORGE_CHART=<chart> FORGE_ID=<id> pnpm -C web exec vitest run
  src/app/api/forge/check.test.ts`, as level-forge runs them.
- **Plays:** one saved hummed level opens at `/play?song=local/hum-<id>`. A take reaches the results screen, played
  by hand or by a bot if one plays local songs. If none does, say so.
- `score.mjs` (committed) runs the diffs and prints one table for FINDINGS.md.

## Validation
1. `node spikes/hum-level/hum.mjs --self-test`, with no mic and no files:
   - a pure tone stepping C4–D4–E4 by quarter notes at 100 BPM gives exactly those three notes;
   - the same tone 40 cents flat gives the same notes;
   - silence gives no notes;
   - `--save` refuses an existing folder;
   - the chart passes `validateChart`'s shape. Its rules are copied into the self-test, or the self-test calls the
     vitest check above. Log which.
2. `node spikes/hum-level/synth.mjs` then `node spikes/hum-level/score.mjs` → the synthetic table: 3 pieces × 2
   profiles, share and unmatched, plus rules pass or fail.
3. **Eric (about 5 minutes):** on `index.html`, hum Twinkle and Ode to Joy once each to the click, at their charts'
   BPM. The WAVs go in `local/` and are scored the same way. One of them is saved and played once at `/play`.

## FINDINGS.md (`spikes/hum-level/FINDINGS.md`)
Per decision 004:
- the question;
- the table;
- what worked and what didn't (octave errors, glides split into extra notes, rhythm on held notes);
- what to keep;
- **promote**, **iterate** or **kill**.

A promote names phase 2 (a page that records and saves through a server route, with its own spec) but builds none of
it. Then `changes/hum-level-spike.md` last.

## Gaps (accepted)
- A synthetic voice isn't a voice. The real hums are the check, and until Eric hums they're pending.
- Melodies only: one note at a time, right hand.
- The click fixes the tempo. Tempo-free humming is phase 2.
- Three well-known tunes. Whether a judge's own tune works is the booth's question, not this spike's.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/hum-level-spike-*.md`.
- No new dependency anywhere. Nothing under `web/` changes except the gitignored `web/public/songs/local/`.
