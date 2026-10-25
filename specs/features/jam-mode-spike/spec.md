---
name: "Jam mode spike: the DGX's drums and bass follow the chords a player holds, named from MIDI on the next beat"
depends_on: ["piano-midi-spike"]
owns: ["specs/features/jam-mode-spike/", "changes/jam-mode-spike.md", "spikes/jam-mode/", "specs/decisions/jam-mode-spike-"]
assignee: "eric"
---

# Jam mode (spike)

Issue #520. Eric's spike idea (2026-10-24, relayed by eric-asking-agent): "Jam mode: the band follows your chords".
The issue says it follows the spike guideline: "one question, a time box, findings at the end". It's a tech spike
under decision 004. It lives in `spikes/jam-mode/`, reads nothing it would change, and edits nothing in `web/`.

A judge at the booth plays any chords on the DGX-660, and the piano's own drums and bass follow them. That's a
hands-on moment with no chart to learn. The piano-midi spike already proved the band itself (`spikes/piano-midi/RESULTS.md`,
R5): drums on channel 10, hi-hat on every 8th, kick on 1 and 3, snare on 2 and 4, plus GM program 33 (Electric Bass,
finger) in 8ths on channel 2. Eric heard them as "distinct", and stopping left no stuck notes. This spike asks
whether that band can follow a player.

## The question
Can a page name the chord a player holds from MIDI input, and have the DGX's bass play that chord's root from the next
beat on, with no stuck notes?
- **Yes:**
  - the naming self-test passes (below);
  - over the IAC loopback run, every bass note after a change lands on the new root once the change came at least the
    lookahead before that beat;
  - the measured change-to-follow time is at most one beat plus the lookahead;
  - Stop leaves no sounding note.
- **No:** any of those fails and one iteration doesn't fix it.
- **Eric's ears (about 5 minutes on the DGX):** does it sound like a band following him? His verdict is required for
  **promote** and recorded in FINDINGS.md. Without it, the findings say "ears pending".
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state.

The bars are the planner's, not measured.

## The code (all committed, in `spikes/jam-mode/`)
- **`jam.mjs`:** a plain ES module with no dependency, importable from Node and the page. It holds two pieces:
  - `nameChord(held)`: from the held pitches (sustain pedal CC 64 ≥ 64 keeps released keys held), it returns
    `{ root, quality, bass }` or `null`. Qualities: major, minor, 7, maj7, m7, dim, aug, sus2, sus4 and the power
    chord (root and fifth). The best template match on pitch classes wins. Ties go to the template whose root is the
    lowest held note, then to the simpler quality in that list's order. One held note or none gives `null`, and the
    band keeps the last chord.
  - `createBand({ bpm, beatsPerBar, lookaheadMs, send, now })`: R5's groove, where the bass plays the current root
    in 8ths, in the octave nearest MIDI 40. Each 8th is scheduled at most `lookaheadMs` ahead (default 50 ms), with
    `MIDIOutput.send` timestamps. `stop()` sends All Notes Off (CC 123) on channels 2 and 10, twice, 300 ms apart,
    as piano-out does. It never sends on channel 1, so the player's piano part is untouched.
- **`index.html`:** the page.
  - Controls: the input and output ports, BPM (default 100), Start and Stop.
  - It shows the named chord.
  - It logs each input note's timestamp, each chord change and each bass note sent, and saves the log as JSON to
    `spikes/jam-mode/local/` (self-ignored: `*` then `!.gitignore`) via a download.
  - It uses plain JS on `localhost` with no build, like `spikes/piano-midi/index.html`.
- **`loopback.mjs` or a page mode:** a scripted run through the macOS IAC Driver (the piano-midi spike's loopback).
  The page plays a fixed progression into IAC as input and reads it back:
  - C–Am–F–G and then Dm7–G7–Cmaj7, 2 bars each, at 100 BPM;
  - each chord struck at a fixed offset inside its beat, spread over the beat in steps the worker logs.

  Then it measures the real Web MIDI timing on this Mac. The progression is a test pattern, not a song.

## Validation
1. `node spikes/jam-mode/jam.mjs --self-test` (no MIDI, a fake clock and output):
   - every template is named right: all 12 roots × the 10 qualities in root position, and the major, minor, 7, maj7,
     m7 and dim chords in every inversion;
   - pedal-held notes count;
   - one held note gives `null`;
   - a scripted progression gives bass notes whose pitch class is the expected root for each beat;
   - `stop()` sends CC 123 on channels 2 and 10 twice, and nothing on channel 1.

   Some pitch-class sets are ambiguous: aug (C+ = E+ = G♯+), sus2 and sus4 (Csus2 = Gsus4), and 6 and m7 (C6 =
   Am7). They follow the tie rule above, and the test pins its answer for each. Count them apart in FINDINGS.md.
2. The IAC loopback run → one log in `local/`, and a table for FINDINGS.md:
   - changes named right out of all changes;
   - bass notes on the right root;
   - change-to-follow time: median, p95 and max;
   - send jitter;
   - stuck notes after Stop (expected 0).
3. Eric on the DGX (when he's there): Start, play any chords for a minute, Stop → his verdict in one line, quoted
   in FINDINGS.md. Close every `/play` tab first: `RESULTS.md` notes Chrome's input stalling with a second tab on
   the same port.

## FINDINGS.md (`spikes/jam-mode/FINDINGS.md`)
Per decision 004:
- the question;
- the tables;
- what worked and what didn't (naming errors by quality, timing);
- what to keep;
- **promote**, **iterate** or **kill**.

A promote names phase 2 (an experiment under `web/src/game/x/`, #878, with its own spec) but builds none of it. Then
`changes/jam-mode-spike.md` last.

## Gaps (accepted)
- Only R5's groove and a root-only bass. No fills, no walking bass, no chord voicing.
- Every chord change waits for the next beat. Tempo is fixed by the BPM box, so it doesn't follow the player's tempo.
- The loopback measures this Mac's Web MIDI timing, not the DGX's sound delay.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/jam-mode-spike-*.md`.
- No new dependency anywhere. Nothing under `web/` changes.
