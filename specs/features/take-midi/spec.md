---
name: "Take MIDI: download your take as a .mid file"
depends_on: ["play-slots"]
owns: ["web/src/game/take-midi/"]
assignee: "eric"
---

# Take MIDI

A results button saves the take as a Standard MIDI File, so a player can keep it, open it in any notation program or
DAW, or send it to a teacher (Eric, 2026-10-24). It's a `resultsPanel` (play-slots). The file is written by hand,
because a new dependency would need a `contract:` PR.

## Requirements
- **The button:** "Download MIDI" shows when the take has at least one press. It saves
  `<chart id>-<YYYYMMDD-HHmm from startedAt>.mid`. A `/` in the id becomes `-`.
- **The file:** a pure `takeToMidi(chart, take): Uint8Array` writes format 0 with one track and 480 ticks per
  quarter note. The track holds:
  - a track name, the chart's title;
  - a tempo meta event at the chart's `bpm`;
  - a time signature from `beatsPerBar` in quarter notes (4 is 4/4, 3 is 3/4, 1.5 is 3/8);
  - every press as note on and note off on channel 1, with its played velocity;
  - end of track.
- **Timing:** tick 0 is chart time 0, beat 0 of bar 1, so presses line up with the score's bars. If a press came
  before 0 (during the count-in), every event shifts later by whole bars until the first press is at or after 0.
- **Releases:** a press whose release never arrived ends `pianoOutSettings.heldMs` later, as piano-out does.
- **Untouched:** the file holds exactly the take, nothing quantized and nothing added. It never includes the chart's
  notes.

## Validation
- `pnpm -C web test`:
  - The header is `MThd`, length 6, format 0, 1 track, division 480.
  - At 100 BPM, a press at chart time 600 ms lands at tick 480.
  - Variable-length deltas encode 0, 127, 128, 16 383 and 16 384 correctly.
  - A press at -200 ms shifts everything by one bar.
  - A missing release ends `heldMs` later.
  - A tiny reader in the test parses the file back to the same pitches, velocities and ticks.
- `verify.py --slug take-midi` passes.
- In Chrome: finish Twinkle on laptop keys and click Download MIDI -> a `.mid` file saves. Open it in MuseScore or
  GarageBand -> the notes sit in the right bars at 100 BPM. Keep a screenshot in the PR.
- On the piano (Eric; mark it in the done note): download a real take and open it. It's what you played, with your
  dynamics.

## Defaults
- Format 0 and one track. Splitting the hands would mean guessing which hand played each press.
