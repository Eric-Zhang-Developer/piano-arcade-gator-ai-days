# The story so far

How Piano Arcade got built, one chapter per milestone. These are working notes for the Devpost write-up and the "how
it's made" part of the video. Every claim links to evidence in the repo. A chapter records only what happened and
what was measured: no recreated moments, no made-up numbers.

## Chapter 1: Will the piano even talk to us?

*2026-10-23, evening. Eric at a Yamaha DGX-660 with a USB cable. Claude Code ran the terminal and Chrome and read the
logs. Evidence: [RESULTS.md](../spikes/piano-midi/RESULTS.md).*

The whole idea rests on one bet. A laptop can hear every key a player presses, with millisecond timing, and can make
the same piano play notes and a band. If that's false, nothing else matters, so we tested it before writing any more
spec.

**The plan was boring on purpose.** We tested in layers: macOS, then a Python script, then a plain HTML page in
Chrome. We proved the code on macOS's virtual MIDI port (the IAC Driver) before touching the piano, so piano time
only answered piano questions. The fallbacks were written down before the run: a local bridge if Chrome failed,
laptop speakers if the piano couldn't play. If the piano couldn't read keys, we would stop and rethink.

**Snags before a single note:**
- The MIDI library (`python-rtmidi` 1.5.8) ships no build for the laptop's Python 3.15, or even 3.13. Its newest is
  for 3.12, so the script runs on 3.12.
- The browser built into the Claude desktop app refuses Web MIDI outright. The Chrome tests ran in real Chrome.
- The first draft PR got marked "merged" by GitHub before it had any code. It was cut from the spec branch, and when
  the spec merged, GitHub counted it as merged too and closed the issue. We reopened the issue and opened a new PR.

**Virtual port first.** Python sent a scale and 16 fast notes and got all 24 back. Python's sleep-based sending
spread the fast notes 121 to 128 ms apart (target 125). Chrome schedules each note ahead of time, and its notes came
back exactly 125.0 ms apart.
![Chrome page on the IAC loopback](../spikes/piano-midi/screenshots/01-chrome-iac-loopback.webp)

**The piano shows up as a charger.** The first time it was plugged in, the Mac saw a 3 W USB charger and no MIDI.
The cable was in the piano's USB TO DEVICE port. Moved to USB TO HOST, it appeared as **"Portable Grand"** by Yamaha
Corporation, one MIDI port each way. It ran through a USB hub dongle, which the manual says to avoid. That made the
next test matter more.
![Chrome connected to the piano](../spikes/piano-midi/screenshots/02-chrome-connected-to-piano.jpg)

**First keys.** Middle C pressed softly came in at velocity 50, pressed hard at 102. The sustain pedal surprised us:
instead of one on/off message, it sends a ramp of values about 6 ms apart, and on two channels at once.

**The number that matters.** A rhythm game falls apart if the piano or the USB link bunches notes together. In a run,
Eric grazed two neighbouring keys at once. They arrived **3.1 ms apart, as two separate events**, through the hub.
Chords came in note by note, 0.4 to 17 ms apart, in the order the hand rolled them.

**The laptop plays the piano.** Python sent a C-major scale and 16 fast notes to the piano's own speakers. Eric's
verdict: "yup it worked!" The 16ths sounded even. Then the band: drums on channel 10 and a finger bass on channel 2,
with Eric playing a scale over them. His keys kept arriving (29 notes, all on channel 1). The piano never sent the
band's notes back, so the game won't mistake the band for the player. Stopping the band mid-bar left silence, with no
stuck notes.

**The mute trick works.** One message (Local Control off) turned the piano's speakers off while every key still
reached the laptop. Another brought the sound back. That means the game can decide what the piano sounds like.

**The Chrome mystery.** In Chrome, a full round of key tests logged almost nothing, twice. The first theory was that
pressing the sustain pedal stalls Chrome's MIDI input, since the log went quiet just where the pedal came next. We tested it properly,
with Python and Chrome listening to the same piano at the same time. Over 158 seconds both saw exactly 116 notes and
536 pedal messages. Their timing agreed within 1 ms for 114 of 115 gaps, and the two clocks drifted 2.4 ms over the
whole run. The pedal theory was wrong. The real cause is still unknown; a second Chrome tab on the same port was
involved the first time. It's written up as an open risk, not swept under the rug.

**Verdict:** all seven requirements pass, in Python and in Chrome. No fallback is needed. The piano reads, the piano
plays, the piano can be muted, and the timing holds to about a millisecond.

### Material for the video
- Screenshots: [the IAC loopback in Chrome](../spikes/piano-midi/screenshots/01-chrome-iac-loopback.webp) and
  [the page connected to the piano](../spikes/piano-midi/screenshots/02-chrome-connected-to-piano.jpg).
- Raw logs to show on screen:
  - [Python on the piano](../spikes/piano-midi/python-piano.log): the soft/hard middle C, the pedal ramp and the
    3.1 ms pair are all in it.
  - [Python on the IAC port](../spikes/piano-midi/python-iac.log).
- Beats that work on camera:
  - the piano appearing as a "3 W charger";
  - the 3.1 ms pair;
  - the laptop playing the piano;
  - the silent keys still logging;
  - the pedal theory killed by a side-by-side test.
- Not captured at the time: video or audio of the piano playing. Film it fresh and label it as a re-run.
