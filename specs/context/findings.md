# Findings

What we learned from running the thing. Specs cite this file; new findings go on top, dated.

## 2026-10-24: first human playtest of core-loop (Eric and his roommate, DGX-660, Chrome)

**Setup.** `/play` from core-loop (PR #36): Twinkle, one hand, 100 BPM, silent 4-beat count-in, no audio besides the
piano, PERFECT ≤ 25 ms, GREAT ≤ 50 ms, MISS beyond. Latency offset 0.

**Scores (accuracy).** Eric about 10% on his first runs; his roommate about 15%; Eric 40% later, "completely
focused" on the falling notes. Judging and MIDI input worked as specified; a first attempt read the IAC Driver bus
instead of the piano because the piano wasn't connected (cable/USB), and the screen didn't make that obvious.

**What the players said (Eric's words, condensed).**
- "We don't know when to press the key." They played it as a rhythm game, not as the song.
- No audio for the beat: "there's no place to ground yourself". Suggested a metronome, or MIDI out playing "the rest
  of the band".
- No time to get ready after pressing Start; nothing audible tells you the song is coming.
- Playing the right notes but "100 or 200 ms off" missed every time, on a song this easy.
- "My eyes were focused on the notes when they were falling. That's not how piano is meant to be played." If this
  is hard on one-hand Twinkle, harder songs and sheet music would be worse.
- Repeated notes (C C, G G) look like one long bar.

**Analysis (agreed with Eric).** The root cause is the missing outside clock you can hear: with only the picture,
the judgment line is the clock, so the eyes must sit on it at every note, players react (late by roughly a reaction
time) or drift from the chart's tempo, and nothing corrects them. Auditory timing is more precise than visual, and
skilled rhythm-game players read ahead and time by the music. The ±50 ms cliff makes it worse but is secondary.

**What follows.**
- Now: `beat-track` (a drum beat on the piano from count-in to the end); `mission.md` allows an accompaniment
  track; a two-bar count-in and separated repeated notes as a core-loop fix.
- After the beat-track playtest, decide with data: a GOOD tier (osu! at medium difficulty still scores hits to
  ±100 and ±150 ms), FAST/SLOW on every judgment, tap-along calibration, a wait mode for learning a song before it's
  judged, note names on falling notes, a band part from a sourced score (Mozart K.265 has a second part).
- Pass condition to aim for: someone who knows Twinkle plays it well while mostly watching the piano.
