# Piano MIDI spike: results

Run on 2026-10-23 on a MacBook Air (macOS 26.5, arm64) and a Yamaha DGX-660, with Chrome, Python 3.12, `mido` 1.3.3
and `python-rtmidi` 1.5.8. Eric was at the piano: he pressed the keys and reported what he heard. The logs below are
quoted from the scripts' own output. The full Python logs are in [python-iac.log](python-iac.log) and
[python-piano.log](python-piano.log).

**Verdict: the core parts are feasible.** All of R1 to R7 pass in both Python and Chrome. No fallback applies. One
open risk: the Chrome page twice stopped receiving keys for minutes (see Unknowns). This needs a test in the MIDI I/O
lane before the game depends on it.

| | Python | Chrome | Evidence |
|---|---|---|---|
| R1 Connect | pass | pass | one input and one output, both named `Portable Grand` |
| R2 Read keys | pass | pass | soft 50, hard 102; releases are note-on with velocity 0; CC 64 arrives; keys on ch 1 |
| R3 No clumping | pass | pass | no run gap under 2 ms, no repeated gap value; the two clocks agree within 1 ms |
| R4 Play to piano | pass | pass | Eric: it played, and the 16ths sounded even |
| R5 Band | pass | pass | Eric: drums and bass were distinct; stopping left silence with no stuck notes |
| R6 Local Control | pass | pass | CC 122 = 0 silenced the piano while keys still logged; 127 brought the sound back. Panel route untested |
| R7 Echo | no echo | no echo | nothing came back on the input while the laptop played |

## Without the piano: IAC Driver

- **Python:** all 24 notes sent came back. The 16ths arrived 121 to 128 ms apart (target 125). That ±4 ms comes from
  `mido`'s sleep-based `play()` on the sending side. The band, CC 123 on all 16 channels, CC 122 and GM System On all
  came back. Log: [python-iac.log](python-iac.log).
- **Chrome:** all 24 notes came back, exactly 125.0 ms and 500.0 ms apart. The page schedules each note with
  `send(data, timestamp)`, so the timing doesn't depend on JS timers.
  ```
  # inputs (2): ["IAC Driver Bus 1 (Apple Inc.)","Portable Grand (Yamaha Corporation)"]
    4500.0   1000.0 ch1   note_on         90 48 5A
    4625.0    125.0 ch1   note_on         90 48 5A
    4750.0    125.0 ch1   note_on         90 48 5A
  ```
- The Claude desktop app's built-in browser rejects Web MIDI outright (`NotAllowedError`, no prompt). This only
  affected testing; the game targets Chrome.

## R1 Connect

- **USB** (`system_profiler`): `Portable Grand`, Yamaha Corporation, vendor `0x0499`, product `0x161d`, 12 Mb/s
  (USB full speed). It is connected through a USB 2.0 hub dongle (`0x214b`/`0x7260`), even though the manual says
  not to use a hub (OM p.76). A direct connection wasn't tested.
- **Cable:** the cable must go in **USB TO HOST**. In USB TO DEVICE, macOS saw a 3 W charger and no MIDI.
- **Python:** `# inputs (2): ['IAC Driver Bus 1', 'Portable Grand']` and the same list for outputs. The piano has
  one port each way.
- **Chrome:** `"Portable Grand (Yamaha Corporation)"`, one input and one output.
- **macOS:** the name shown in Audio MIDI Setup's MIDI Studio wasn't recorded. CoreMIDI reports the port as
  `Portable Grand`.

## R2 Read keys

Python, middle C soft then hard, then the sustain pedal:
```
  104061.0  57349.0 ch1   note_on         90 3C 32      <- soft, velocity 50
  105416.7          ch1   release(v0)     90 3C 00
  105877.9   1817.0 ch1   note_on         90 3C 66      <- hard, velocity 102
  109258.8          ch1   release(v0)     90 3C 00
  112841.6          ch1   control_change  B0 40 03
  112842.1          ch2   control_change  B1 40 03
  ...  (03 14 25 37 3F 7F, about 6 ms apart, then 4A 3A 22 0B 00 on release)
```
- **Channel:** keys arrive on channel 1. This confirms the forum post the spec cited.
- **Releases:** a release is a note-on with velocity 0. No `0x8n` note-offs were seen from the piano.
- **Sustain pedal:** CC 64 comes as a ramp of values, not a single 0 or 127, and on **both channel 1 and channel
  2**. A game should treat any value of 64 or more as pedal down, and ignore the channel 2 copy.
- **Active Sensing:** both layers filter it out. A 3 s idle listen logged nothing.
- **Chrome:** velocities ran from 8 to 89, and CC 64 arrived on channels 1 and 2. In the side-by-side test it got
  exactly the 536 CC messages Python got. The dedicated soft/hard middle C pair was played while the Chrome page
  wasn't receiving (see Unknowns), so Chrome's velocity evidence is the 8 to 89 range across the session.

## R3 No clumping

The pass criterion: in a run, no two notes arrive within 2 ms of each other, and the gaps don't snap to one
repeated value.

- **Python run:** 32 note-ons. Gaps were 3.1 to 387 ms (median 186). None was under 2 ms, and no 1 ms bin held
  more than 2 gaps. Two neighbouring keys Eric grazed together still arrived **3.1 ms and 3.8 ms apart, as separate
  events**:
  ```
   19352.0    182.7 ch1   note_on         90 43 19
   19355.8      3.8 ch1   note_on         90 47 4E
  ```
- **Chrome run:** 24 note-ons. Gaps were 6 to 1694 ms, with the fast part 90 to 180 ms. None was under 2 ms, and no
  bin held more than 2 gaps.
- **Chords (Python):** each chord note is its own event, 0.4 to 16.8 ms after the one before, in the order the hand
  played them:
  ```
   16485.1          ch1   note_on         90 3C 56
   16487.7      2.6 ch1   note_on         90 43 4B
   16488.1      0.4 ch1   note_on         90 48 53
   16491.8      3.7 ch1   note_on         90 40 4C
  ```
- **Both clocks at once:** Python and Chrome listened together for 158.4 s. Each saw 116 note-ons, 536 CCs and
  0 other messages, starting from the same first note.
  - Their gaps agree within 1 ms for 114 of 115 gaps. The exception is the first gap, at 2.6 ms.
  - The two clocks drifted 2.4 ms apart over the whole run.
  - Both counted 7 gaps under 2 ms, all inside chords.
- **Chrome's timestamps:** Chrome gives messages that arrive in the same USB packet the same timestamp. The CC 64
  pairs on channels 1 and 2 share a time, and some chord notes show a 0.0 ms gap. That's consistent with Chrome
  using the packet's CoreMIDI time. Its resolution is therefore about one USB frame (1 ms).
- **Limit of this test:** the runs were moderate, about 5 to 8 notes per second. Nothing faster was tried.

## R4 Play to the piano

The sequence was a C-major scale (500 ms apart), a beat's rest, then 16 notes at 125 ms. Eric reported that it
played through the piano's speakers and the 16ths sounded even, from both Python (twice) and Chrome. The Python
sender's ±4 ms jitter (see IAC above) wasn't audible.

## R5 Band

The band is drums on channel 10 (hi-hat every 8th, kick on 1 and 3, snare on 2 and 4) and a GM program change to 33
(Electric Bass, finger) with 8th-note bass on channel 2, at 120 BPM.

- **By ear:** Eric reported the drums and bass were audible and distinct under his melody, from Python and from
  Chrome.
- **Stopping:** stopping mid-song sent CC 123 on all 16 channels. Eric reported the piano went fully silent with no
  stuck notes, from Python and from Chrome. Chrome sends CC 123 twice, 300 ms apart, because notes already queued
  in Chrome can still go out after the first.
- **Keys during the band (Python):** Eric's scale over the band logged 29 note-ons on channel 1, with gaps of 268 to
  345 ms. Keys keep arriving while the piano plays the band.

## R6 Local Control

- **Python:** CC 122 = 0 on channel 1 made the keys silent. 9 note-ons still logged (C4 up to C5). CC 122 = 127
  brought the sound back.
- **Chrome:** Local off made the fast run (all 24 notes logged) silent. Local on brought the sound back, and its
  next key logged as `90 3C 52`.
- **Panel route:** [FUNCTION] then "Local" was **not tested** (unknown).

## R7 Echo

**The piano does not send incoming MIDI back out**, at its default settings.

- **Python, hands off:** a band run of about 1 minute with no keys pressed logged no input at all.
- **Python, band plus melody:** only Eric's 29 channel 1 notes came in, and nothing on channel 2 or 10.
- **Python, scale plus play-along:** the incoming notes had varying velocities (54 to 83) and kept coming after
  playback stopped, so they were Eric's keys. Everything the laptop sends is velocity 90.
- **Chrome:** two scale runs and two band runs from the page logged no input. Python, listening at the same time,
  also logged nothing.

## Unknowns and gaps

- **Chrome input stalled twice (unexplained).** Twice, the Chrome page logged nothing for minutes while Eric
  reported playing.
  - **First time:** a second Chrome tab had the same port open.
  - **Second time:** the gap included the moment Eric closed that other tab.
  - **Afterwards:** a 158 s side-by-side run with Python showed no loss at all.

  The cause isn't known, and calling `requestMIDIAccess` again may have brought input back (not confirmed). Before
  the game depends on Web MIDI input, the MIDI I/O lane should reproduce this: two tabs, closing a tab, a long idle
  period. It should also decide whether the game needs a "no input for N seconds while playing" check that
  reconnects.
- **Not tested:**
  - the Local Control panel route;
  - runs faster than about 8 notes per second;
  - a direct USB connection without the hub;
  - whether the piano sends MIDI clock (both layers filter `0xF8`).
- **Python's timing:** the Python layer stamps arrival in its callback thread (`perf_counter`), not with CoreMIDI's
  time. It agreed with Chrome to 1 ms here. Python's `play()` sends with about ±4 ms jitter.

## Fallback

None applies. Reading keys works in both layers (R1 to R3). Playing to the piano works in both (R4, R5). Chrome
works, so no local bridge is needed. The Python layer can still serve as a bridge if the Chrome stall turns out to be
real.
