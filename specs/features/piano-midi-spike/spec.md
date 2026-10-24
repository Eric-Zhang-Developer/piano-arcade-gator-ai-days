---
name: Prove a laptop can play to and read from the DGX-660
depends_on: []
owns: ["spikes/piano-midi/"]
assignee: ""
---

# Piano MIDI feasibility spike

One question: **are the core parts of the idea feasible on the real piano?** Can a laptop read every key press from
the Yamaha DGX-660, and can it make the piano play notes and a multi-channel band? Everything else in the plan rests
on this.

This is throwaway evidence, not product code. It isn't glamorous, and no feature imports from `spikes/`; the MIDI
I/O lane rebuilds what it needs. Until this is in a milestone it's backlog, so no worker picks it up: a dedicated
session runs it.

## Plan
1. **Layer 1, macOS:** plug the piano into the laptop. Audio MIDI Setup lists it. Record the device and port names
   exactly as shown.
2. **Layer 2, Python:** one script (`mido` + `python-rtmidi`, in a venv inside the spike folder, not committed) that
   lists ports, prints incoming events, plays a generated `.mid` file to the piano, and runs the checks below. This
   layer is also the fallback if Chrome fails.
3. **Layer 3, Chrome:** one HTML file, plain JavaScript, no build and no framework, served from `localhost`. It
   logs incoming events, plays a sequence generated in code, and shows a log you can copy.
4. Prove layers 2 and 3 against the macOS IAC Driver (a virtual MIDI port) before touching the piano, so piano
   time only answers questions about the piano.
5. A person at the piano runs a numbered checklist (below) and pastes the logs back.
6. Write `spikes/piano-midi/RESULTS.md`: pass or fail for each requirement, the pasted logs, the measured numbers,
   and which fallback applies.

## Requirements
Each one is a pass/fail line in `RESULTS.md`, in both Python and Chrome unless it says otherwise.
- **R1 Connect.** The piano appears as a MIDI input and output in macOS, in Python and in Chrome. Record the port
  names and how many ports it shows (unknown until tested).
- **R2 Read keys.** Every key press arrives as a note-on with its velocity; a soft press and a hard press give
  clearly different velocities. A note-on with velocity 0 counts as a release (the piano sends releases that way).
  Pressing the sustain pedal shows CC 64. Active Sensing (`0xFE`) is filtered out of the log. Record which channel
  the keys arrive on.
- **R3 No clumping.** Play a fast one-hand run and some chords. The log prints each note's arrival time and the gap
  to the previous note. Pass: in the run, no two notes arrive within 2 ms of each other, and the gaps don't snap to
  one repeated value. Notes arriving together or on a fixed beat would mean the piano or USB buffers them, which
  would break millisecond judging.
- **R4 Play to the piano.** A generated sequence plays through the piano's own speakers: a C-major scale, then
  16 notes at 16th notes, 120 BPM (125 ms apart). Pass: it plays, and the 16th notes sound even by ear.
- **R5 Band.** Drums on channel 10 sound like drums. Bass on channel 2 (set with a GM program change) sounds like
  bass. Both play while a person plays a melody on the keys. Stopping mid-song sends All Notes Off (CC 123) on all
  16 channels and leaves no stuck notes.
- **R6 Local Control.** CC 122 with value 0 silences the piano's own sound for keys played while their MIDI still
  arrives; value 127 brings it back. Also note whether the panel route works ([FUNCTION], then "Local").
- **R7 Echo.** Find out whether the piano sends incoming MIDI back out. If it does, the game would read the band's
  notes as the player's: record it either way.
- **Mic only as a fallback.** If R3 or R4 looks wrong, measure it properly with the laptop mic. Otherwise no audio
  code.

## Fallbacks (decided before running)
- **Chrome fails, Python works:** a small local bridge between the piano and the page. The idea survives.
- **Playing to the piano fails (R4 or R5):** the band plays from the laptop's speakers and the piano is input only.
  The closing wow gets weaker; the arcade survives.
- **Reading keys fails (R1 or R2 for input, or R3):** the core idea is in trouble. Stop and rethink before writing
  more spec.

## Validation
- **Without the piano:** enable the IAC Driver in Audio MIDI Setup. Run the Python script against it -> the notes it
  sends come back in its log. Open the page on `localhost` in Chrome and pick the IAC port -> the page's sent notes
  appear in its own log. Keep both logs.
- **With the piano** (a person runs this; each step is `action -> what you should see`):
  1. Plug in with a USB A-to-B cable (B-to-C for a USB-C Mac), no hub -> Audio MIDI Setup lists the piano.
  2. Run the Python script's port listing -> the piano's input and output appear.
  3. Press middle C softly, then hard -> two note-ons, clearly different velocities, then releases.
  4. Press and release the sustain pedal -> CC 64 on, then off.
  5. Play a fast one-hand run, then a few chords -> the gap column shows no clumping (R3).
  6. Play the generated sequence -> the piano plays the scale, then 16 even 16th notes.
  7. Play the band while playing a melody -> drums and bass are audible and distinct under the melody.
  8. Stop the band mid-bar -> silence, no stuck notes.
  9. Send Local Control off, play a key -> no sound from the piano, the note still logs. Send it on -> sound returns.
  10. Watch the log while the band plays, without touching the keys -> any notes logged mean the piano echoes (R7).
  11. Repeat steps 2 to 9 in the Chrome page; allow the MIDI permission prompt when Chrome asks.
- **Proof to keep:** `RESULTS.md` with the pasted logs, port names, velocity and gap numbers, and pass or fail per
  requirement. `verify.py` isn't set up (`[verify].command` is empty), so the done note says `not verified` and
  points at `RESULTS.md`.

## Defaults
- Prefer the smaller, reversible option. No npm, no build, no CDN libraries: the page generates its notes in code,
  and only the Python layer reads a `.mid` file.
- If the piano gets stuck in a strange state, send GM System On; it resets everything except master tuning.
- Don't guess hardware facts: anything not measured goes in `RESULTS.md` as unknown.

## Known facts
From the DGX-660 owner's manual (OM), its MIDI Reference (MR) and Yamaha's computer guide (CO), unless marked:
- MIDI goes over the USB TO HOST port (type B). There are no 5-pin MIDI ports. Use a cable under 3 m, not USB 3.0,
  with no hub (OM p.76). macOS needs no driver (CO).
- The piano receives on all 16 channels as a multi-timbral tone generator, GM System Level 1 and XGlite, with 192
  notes of polyphony (MR, OM). Drums on channel 10 follow from GM; no Yamaha page says so directly.
- Local Control: CC 122, value 0 off and 127 on, on any channel (MR note 5). Panel: [FUNCTION], then the category
  buttons to "Local" (OM p.72, p.74). Default is on.
- Releases are sent as note-on with velocity 0. It also sends sustain, pitch bend, program changes, MIDI clock and
  Active Sensing (MR chart).
- Keys going out on channel 1 is unverified (a forum post). Whether it echoes incoming MIDI isn't documented.
- Chrome's Web MIDI needs a secure context (`localhost` counts) and has asked permission even for non-sysex MIDI
  since Chrome 124.

Sources: [OM](https://usa.yamaha.com/files/download/other_assets/3/739463/dgx660_en_om_a0.pdf) ·
[MR](https://usa.yamaha.com/files/download/other_assets/3/739563/dgx660_en_de_fr_es_mr_a0.pdf) ·
[CO](https://manual.yamaha.com/mi/common/computer/en/computer_en_rm_y0.files/computer_en_rm_y0.pdf) ·
[Chrome permission prompt](https://developer.chrome.com/blog/web-midi-permission-prompt)
