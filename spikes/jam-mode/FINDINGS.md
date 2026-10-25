# Jam mode spike: findings

eric-agent-3, 2026-10-25. Spec: `specs/features/jam-mode-spike/spec.md` (issue #520). About 1 hour of the 3-hour time
box.

## The question
Can a page name the chord a player holds from MIDI input, and have the DGX's bass play that chord's root from the next
beat on, with no stuck notes?

**Measured answer: yes, through the IAC loopback on this Mac.** Every machine bar in the spec passes. Eric's ears on
the DGX are still needed: **ears pending.**

## Naming self-test
`node spikes/jam-mode/jam.mjs --self-test`: **318 passed, 0 failed.**

| Case | Count | Result |
|---|---|---|
| Root position: 12 roots × 10 qualities (major, minor, 7, maj7, m7, dim, aug, sus2, sus4, power) | 120 | all named right |
| Every inversion of major, minor, 7, maj7, m7 and dim, 12 roots each | 180 | all named right |
| Pedal: CC 64 ≥ 64 keeps released keys; the channel 2 copy is ignored; pedal up drops them | 3 | pass |
| One pitch class or none gives null | 1 | pass |
| Scripted progression on a fake clock: each beat's bass on the expected root | 3 | pass, including one change inside the lookahead (it follows one beat later) |
| `stop()`: CC 123 on channels 2 and 10, twice, 300 ms apart; nothing ever on channel 1 | 3 | pass |

**Ambiguous sets**, counted apart and pinned by the tie rule (the lowest note's root wins, then the simpler quality):

| Set | Named | Why |
|---|---|---|
| C+ first inversion (E G♯ C) | E+ | aug is symmetric: C+ = E+ = A♭+, so the lowest note decides |
| C+ second inversion (A♭ C E) | A♭+ | the same |
| G C D | Gsus4 | Csus2 = Gsus4; G is lowest |
| D G C | Csus2 | neither root is lowest, so the simpler quality (sus2 comes before sus4) |
| C E G A | Am7 | C6 = Am7; there's no 6 template, so a C6 always reads as Am7 |
| C E | C | C major and A minor tie; C is lowest |
| C E♭ G♭ A (dim7) | Cdim | there's no dim7 template; the triad on the lowest note |

These sets are truly ambiguous; no rule names them "right". For a root-only bass, C6 → A and C+ voicings → their
lowest note are the cases a player would hear as wrong.

## IAC loopback run
`loopback.mjs` drives the page in Playwright's Chromium (the desktop app's browser refuses Web MIDI, as piano-midi
found). It ran once under the verify lock on a MacBook Air, macOS 26.5, through IAC Driver Bus 1. The page plays the
chords into IAC on channel 1 and hears them back as the player. The band plays into IAC too, so its bass returns on
channel 2 with Chrome's real arrival times.

- **Progression:** C–Am–F–G then Dm7–G7–Cmaj7, 2 bars each at 100 BPM, three times over: 21 changes.
- **Strike times:** each change is struck in the beat before its two bars, at an offset stepping 0 to 571.4 ms through
  the beat in 28.6 ms steps (600 / 21).
- **Settings:** lookahead 50 ms; the band ticks every 10 ms.
- **Log:** `local/jam-loopback-2026-10-25T11-14-47-577Z.json`, 1,835 input messages, not committed.

| Measure | Result |
|---|---|
| Changes named right | 21 of 21 |
| Bass notes on the right root | 335 of 335 that had to follow (2 more were inside a change's lookahead, where either root is allowed) |
| Change to follow, ms (19 changes; the 2 Cmaj7 → C changes keep the root and are left out) | median 342.9, p95 628.7, max 628.7 (bar: one beat + lookahead = 650) |
| Send jitter, ms (arrival − send timestamp, 337 bass notes) | median 0.1, p95 0.1, max 0.1 |
| Bass notes sent / back | 337 / 337 |
| All Notes Off back | 4 of 4 |
| Band notes after the last All Notes Off (stuck) | 0 (0 after the first, too: `output.clear()` dropped the queued ones) |

The max of 628.7 ms is the change struck 571 ms into its beat, 29 ms before the next one. That's inside the 50 ms
lookahead, so it waited a whole beat more. That's the worst case by design, and it's under the bar.

## What worked
- **Pitch-class template scoring:** matches minus misses both ways. One rule names triads, sevenths, inversions and
  partial chords, with no special cases.
- **Send timestamps:** sub-millisecond timing over IAC, as piano-midi's R4 found. The 10 ms timer only decides what to
  send; Chrome's MIDI clock decides when.
- **Stop:** `output.clear()` plus CC 123 twice on channels 2 and 10 left nothing sounding, and channel 1 (the
  player's piano part) was never touched.

## What didn't, or isn't known
- **Releases rename chords wrongly.** A hand lifting off C E G passes through E G, which names Em. The first page
  version renamed on every message, so it would have sent a false chord on most releases. The fix (logged in
  `specs/decisions/jam-mode-spike-rename.md`): only a struck key renames; releases and pedal-up keep the chord.
- **Rolled chords will flicker.** The loopback strikes all of a chord's notes in the same millisecond. Its 9 passing
  names (Dm → Dm7, G → G7, C → Cmaj7) all kept the root, so the bass never moved. A human rolls a chord over 10 to
  50 ms, though. Striking E before C in a C chord names Em for a moment, and if that lands on a beat decision the bass
  plays E. Not measured: there's no piano here and no human take. Phase 2 should wait about 30 ms after the last note-on
  before renaming.
- **The DGX's own delay and sound:** the loopback measures this Mac's Web MIDI, not the piano. Unknown until Eric
  plays it.
- **Chrome input stalls:** piano-midi saw them with a second tab on the same port. Not seen here, but IAC isn't the
  DGX.

## What to keep
`jam.mjs` as phase 2's seed. It's generic, dependency-free and has no restricted content: `nameChord`, `createHeld`
(renaming on strikes only) and `createBand`. Also the loopback harness, for measuring a change.

## Recommendation: promote, once Eric's ears agree (ears pending)
Every machine bar passes. Under the spec, promote needs Eric's verdict: Start on the DGX, play chords for a minute,
Stop, and one line on whether it sounds like a band following him. Close every `/play` tab first.

**Phase 2, if promoted:** a Lab experiment under `web/src/game/x/jam/` (#878) with its own spec. It would reuse
piano-out's MIDI output, use jam.mjs's naming with a ~30 ms settle window for rolled chords, and keep R5's groove
behind a BPM control. This spike builds none of it.
