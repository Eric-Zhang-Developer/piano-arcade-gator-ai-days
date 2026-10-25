# Findings

What we learned from running the thing. Specs cite this file; new findings go on top, dated.

## 2026-10-25: Golden's sheet has no dynamics or pedal marks (eric-agent-3, golden-demo)

- All 96 bars of Eric's Golden sheet (`video-references/golden-sheet/page-*.webp`) were read for p/mp/mf/f marks,
  hairpins and Ped. marks. There are none, so the spec's Requirement 1 fallback and a measured source take their place.
- **Pedal, bars 1–96: the per-harmony rule** (an arrangement choice).
  - A left-hand harmony is the set of pitch classes struck in a half bar, or a whole bar in 3/4.
  - A pair starts at a window that strikes a new set, at the left hand's first strike in a bar (a re-pedal on a
    re-struck chord), or after a left-hand rest of a bar or more.
  - Down 60 ms after the pair's first onset, up 20 ms before the next pair's; a rest of a bar or more lifts it at
    the rest.
  - Result: 112 pairs, one bar at the median. The longest is bar 65, the bar the recording stretches.
- **Dynamics:** from the recording's loudness per bar (`specs/decisions/golden-demo-dynamics.md`).
- Both are written into the local charts and `pedal.json` by the local spike tool, `txt2chart.py`. Nothing goes into
  git.

## 2026-10-24: how Eric checks on the piano (Eric)

- Eric checks on the DGX about once every 1 to a few hours, and his checks are about feel and direction, so workers
  batch "Eric's piano check" items into their done notes' Gaps instead of waiting on him.

## 2026-10-24: playtest with the beat track (Eric, DGX-660, Chrome)

**Setup.** The local playtest build: core-loop plus `beat-track` (PR #50: piano drums from the count-in to the end)
and the core-loop fix (PR #53: two-bar count-in, separated repeated notes). Latency offset 0.

**Score.** 71.4%, rank C: 24 PERFECT, 12 GREAT, 6 MISS, 7 extras, max combo 20, up from 10–40% without the beat.
Eric: "much much better", "it feels a lot better". He asked whether Twinkle is 3/4 or 4/4 (the chart is 4/4; the
kick marks each bar's beat 1).

**What it shows.** 6 MISS with 7 extras: nearly every miss was the right key pressed just outside ±50 ms. The
results screen can't say early or late, so neither the player nor we can tell latency from timing habit. Next:
`timing-feedback` (early/late summary on the results screen), then decide the GOOD tier and latency from its data.
The second player hasn't played this build yet.

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
