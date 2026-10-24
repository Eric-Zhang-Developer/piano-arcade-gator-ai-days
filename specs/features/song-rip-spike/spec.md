---
name: "Spike: rip a recording into a playable level, scored against the Flower Dance MIDI"
depends_on: []
owns: ["specs/features/song-rip-spike/", "changes/song-rip-spike.md", "spikes/song-rip-spike/"]
assignee: "eric"
---

# Song-rip spike

Eric's lane since 2026-10-24 ("Yes: song-rip-spike moves to my lane"). Issue: #31. One question: **can an agent
rip a recording into notes, and a playable chart, well enough to measure?** It's the "any song becomes a level" story
and what makes "Golden" possible. Still the riskiest AI piece in the plan, and untested.

It's a spike, so it's in **no milestone** on purpose: the planner routes it directly, and it never blocks a milestone.
Run it like the MIDI spike: one song, a pass/fail test, a decision Saturday night. If it fails, the video ends on the
Twinkle Var. XII beat instead.

Together with eric-agent-3's Flower Dance spike (`video-references/flower-dance-sheet/work/`), it answers two
questions with numbers: "can an agent read a score?" and "can an agent rip a recording?" Both are facts for /how
(`how-it-works`).

## The test material (both local, never committed)
- **Recording:** `video-references/DJ Okawari - Flower Dance - 2010 [AULG4MoYxQk].mp3`, 263.8 s (`afinfo`).
- **Reference:** `video-references/flower-dance-sheet/flower-dance.mid`, Eric's MIDI ("the MIDI, it's perfect").
  Read from the file on 2026-10-24: format 0, one track ("Elec. Piano (Classic)"), 384 ticks per quarter, 2,332
  notes, one tempo (769,230 µs per quarter, 78 BPM), one time signature (4/4), every velocity 43, pitches 25–92. It
  runs 323.1 s (105 bars), against the recording's 263.8 s, so it isn't at the recording's tempo.
- **Caveat, in the findings too:** the MIDI is a piano arrangement (credited as in Eric's file), not a transcription
  of the recording. It only approximates ground truth: voicings, octaves, fills and repeats may differ, so a low F1
  may be the arrangement, not the ripper. Its velocities carry no information, so velocity isn't scored.

## Plan
1. **Set up**, local only: a venv in `video-references/song-rip/venv/`. Nothing goes into `web/package.json`.
2. **Stems:** Demucs (MIT) on the recording, once. Use the 6-stem model's piano stem (`htdemucs_6s`), or `other` if
   that model isn't available; record which.
3. **Notes:** Basic Pitch (Apache-2.0) on the piano stem. Also on the unseparated mix (cheap), which shows what Demucs
   buys. Optional: ByteDance's piano transcription (`piano_transcription_inference`, Apache-2.0) on the same stem, as a
   second ripper to compare.
4. **Align** the recording's time to the MIDI's: a DTW on chroma (the recording against the MIDI rendered to chroma),
   or a fitted constant tempo plus offset if that's good enough. Align on audio, not on ripped notes, so one warp
   serves every ripper and doesn't flatter any of them.
5. **Score** each rip against the MIDI (below), overall and per section.
6. **Arrange:** an LLM (the agent) turns the Basic Pitch notes into a playable two-hand piano part, written as a
   `Chart` (`web/src/contracts/`); band channels from the other stems are optional.
   `game-tools/midi-to-chart/convert.py` (song-pack-1's) can do the last step if the arrangement is written as MIDI.
   The notes come from the rip only: never from the MIDI, and never from memory.
7. **Write** `spikes/song-rip-spike/FINDINGS.md` with the numbers and the recommendation.

## Requirements
- **Scoring:** standard note metrics with `mir_eval.transcription` (`precision_recall_f1_overlap`): pitch exact (same
  semitone, mir_eval's 50-cent tolerance), onset within ±50 ms (`onset_tolerance=0.05`), offsets ignored
  (`offset_ratio=None`). Report precision, recall and F1 for each ripper, overall and per section.
- **Sections:** bar ranges of the MIDI. Use the arrangement's own sections where its notes show them, otherwise 8-bar
  blocks. The findings list the ranges and how they were picked.
- **Alignment error:** report the fit's residual, and the median and p95 of |aligned MIDI onset − matched ripped
  onset| over matched notes. If the median is near the 50 ms tolerance, the F1 is measuring the alignment, and the
  findings say so.
- **Heavy runs:** Demucs and ByteDance each run once, one at a time, inside `<git common dir>/verify.lock` (`mkdir` it
  to take it, `rmdir` when done; it's the lock `verify.py` uses). Start only while the workers are quiet (`uptime`
  load under 8). A lock older than 600 s counts as stale, so `touch` it during a long run.
- **Local only (decision 003):** every output (stems, notes, alignment, chart, logs, venv) goes in
  `video-references/song-rip/`, which this checkout ignores through `.git/info/exclude` (`/video-references/`).
  Never use `flower-dance-sheet/work/`: that's eric-agent-3's spike. Nothing ripped is committed, never `git add -f`.
  Credit the outputs there "© owner, all rights reserved, local use only".
- **Committed:** only the scripts and `FINDINGS.md` in `spikes/song-rip-spike/`: numbers and code, no audio, no notes.
  Record each tool's version and license.

## Validation
The experiment is the validation. Each step is `action -> what you should see`.
1. Score the MIDI against itself -> P = R = F1 = 1.0. This proves the scorer, not the ripper.
2. Run the pipeline -> stems, notes, alignment and chart in `video-references/song-rip/`; `git status` shows none of
   them.
3. Score each rip -> one table per ripper: precision, recall, F1, overall and per section, plus the alignment error.
4. **Pass** (the first spec's test, unchanged): someone who hasn't heard the plan recognizes the chart's music within
   5 seconds (v4), played from the chart's notes, never the original recording; and the chart is playable: it passes
   `chart-lint`'s rules (same-pitch overlap, pitch range, duplicate id, time order, one-hand span of at most 16
   semitones) and Eric can play it through. The F1 numbers are reported with the pass, with no threshold: the
   arrangement caveat makes any cut-off arbitrary.
5. `FINDINGS.md` ends with a recommendation: is ripping good enough to be part of the product's story, and for which
   kinds of songs (solo piano, piano-led, full band).

## Defaults
- Basic Pitch is the main ripper; ByteDance is a comparison, cut first if time runs short (a Gap, not overtime).
- Unmeasured stays `unknown`. The done note (`changes/song-rip-spike.md`, 3–8 lines) gives the recommendation, the
  F1 numbers and where `FINDINGS.md` is.
- `mission.md` Not doing lists live transcription on stage: ripping is offline, before play, and the findings keep it
  that way.
