---
name: "Simon Says spike: the DGX plays a phrase from a real song, you repeat it, and it grows a note a round"
depends_on: ["core-loop", "piano-out", "juice-sound", "song-pack-1"]
owns: ["specs/features/simon-says-spike/", "changes/simon-says-spike.md", "spikes/simon-says/", "web/src/game/simon/", "web/src/app/simon/", "specs/decisions/simon-says-spike-"]
assignee: "eric"
---

# Simon Says (spike)

Issue #516. Eric, 2026-10-24: the DGX plays a short phrase, you repeat it, and each round adds one note. One mistake
ends the run. The phrases are the opening notes of real songs from the library, so a long run means you just played
the start of a tune. A prototype spike on the game's code (decision 004, #493): one question, findings at the end.

## The question
Can a non-pianist on the DGX repeat a growing phrase from a real song long enough to want another go?
- **Yes:** in Eric's DGX playtest, a non-pianist reaches round 8 or later and asks to go again unprompted.
  "Reaches round 8" means round 7 was cleared and round 8's phrase (9 notes) was played to them.
- **No:** no non-pianist reaches round 8 in their runs, or none asks to go again.
- **Time box:** about 3 hours of agent time to build it. Then FINDINGS.md, whatever the state. Eric runs the
  playtest; if he hasn't by then, the spike ends with the playtest pending and FINDINGS.md says so. No new spike work
  after Sun 2026-10-25 12:00 ET.

## How it mounts
- Its own page, `/simon` (`web/src/app/simon/page.tsx`), over a pure module in `web/src/game/simon/`. No line in
  `layers.ts`, no change to `/play`, and no link from any screen, so it's off the demo path until a spec promotes it.
- Not a plugin on `/play`: a take there runs on the chart clock, its judge turns a slow note into a MISS, and no
  `GamePlugin` hook can end a take on one wrong note or replay a growing phrase between rounds without editing
  core-loop's `/play`. wait-mode is the nearest thing (it holds the clock until the right key), but it never ends a
  run and never plays the phrase first. A link from `/play`'s start screen (a play-slots `startPanel`) is promotion
  work.
- Imported, never edited: `midiDevice`, `keysDevice` and `keyMap` (`web/src/game/core/input.ts`), `noteTimeMs`
  (`core/judge.ts`), `allNotesOff` and the `Message` type (`web/src/game/piano-out/`), and `tone`
  (`web/src/game/sound/`, juice-sound's laptop synth).

## The game
- **Song:** `?song=<id>`, a committed chart, default `twinkle`. The page links Twinkle, Ode to Joy, Minuet in G and
  Für Elise (ids `twinkle`, `ode-to-joy`, `minuet-g`, `fur-elise`).
- **The melody:** the chart's right-hand notes, the highest pitch at each onset (same `beat`), in beat order. The left
  hand is ignored. A non-pianist plays one finger, and the right hand carries the tune: at e9950a7 none of those four
  charts (or `gymnopedie-1`) has a right-hand onset with more than one note.
- **Rounds:** round k plays the first k + 1 melody notes (round 1 is 2 notes). Repeating the whole melody wins.
- **Listen:** the DGX plays the phrase on channel 1 at the chart's own rhythm and tempo (onsets from `noteTimeMs`,
  lengths from `duration`), velocity 80, each message sent with `MIDIOutput.send(data, timestamp)` to the output
  named "Portable Grand" (as beat-track finds it). The drawn keys light as each note sounds. Without that output, the
  laptop plays it with `tone()`.
- **Your turn:** starts 300 ms after the last note-off (`turnGapMs`, a named setting) and says "Your turn". A clean
  repeat shows "Round k + 1", and the next phrase starts 800 ms later (`nextRoundMs`).
- **Run over:** the round reached, the expected key lit, and Again (button, Space or Enter). The page lists this
  session's runs (song and round reached) in memory, for Eric to copy into FINDINGS.md. Nothing is saved.
- **Input:** `midiDevice` and `keysDevice` at once, so laptop keys work without the piano. The laptop row maps from
  the melody's lowest note (`keyMap`), and each drawn key shows its letter. If the melody leaves the row's reach, the
  page says "Laptop keys reach round N on this song".
- **Stopping:** All Notes Off on every channel (`allNotesOff`) on Again and on `pagehide`.

## The mistake rule
- A mistake is a note-on, during your turn, whose pitch isn't the next melody note's pitch. Exact pitch, as the
  mission's matching rule: the right letter in the wrong octave is wrong.
- Not a mistake: a release, a press while the phrase plays (ignored), a note's length, the tempo, the rhythm, or any
  gap between presses. There's no time limit.
- Why loose timing: Simon tests memory of the order, not rhythm; `/play` already grades timing. A non-pianist hunts
  for the next key for seconds, and a timing window would end runs for searching, not for forgetting. Whether a time
  limit adds tension is a playtest question, not a default.
- Two keys at once count in arrival order; either one wrong ends the run. Twinkle's repeated notes take two presses.
  A held laptop key doesn't repeat (`keysDevice` drops `e.repeat`).

## Plan
1. Draft PR `feat(simon-says-spike): Simon Says page`. The pure module first, `web/src/game/simon/index.ts`:
   `melody(chart)`, `phraseMessages(chart, notes, startMs)` (piano-out's `Message[]` on channel 1), and the run as a
   reducer, `step(state, event)`; plus `simon.test.ts`.
2. The page: a client component, a plain DOM key row over the melody's range (nothing scrolls, so no canvas), both
   inputs, the output or the laptop tone.
3. `web/src/game/simon/verify-simon.mjs`.
4. Eric's playtest, then `spikes/simon-says/FINDINGS.md`, then `changes/simon-says-spike.md` last.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/simon`, on synthetic charts (no notes typed from a song):
   - `melody`: a right-hand chord gives its top note, left-hand notes are skipped, notes come out in beat order;
   - round k's phrase is the first k + 1 notes;
   - `phraseMessages`: note-on and note-off on channel 1, spaced as the chart's beats at its bpm, from `startMs`;
   - `step`: the right order clears the round; a wrong pitch ends the run at that round; the same note an octave up
     is wrong; presses while listening and releases change nothing; a 60 s gap is fine; the last round is a win.
2. `node web/src/game/simon/verify-simon.mjs --out <dir>`, once, under the verify lock (the interim load rule).
   Headless has no MIDI, so it uses laptop keys and the tone. Open `/simon?song=twinkle`, read Twinkle's chart from
   disk and take its melody by the rule above, press round 1's keys by each drawn key's `data-code` -> "Round 2";
   then one wrong key -> "Run over" at round 2; Again -> round 1. A screenshot of the run-over screen; no console
   error.
3. **On the DGX (Eric; the question):** two or more non-pianists, a few runs each. Record each run's song and round
   reached, and whether they asked to go again. Also: the playback is in time, and nothing hangs after Again or
   leaving the page.

## FINDINGS.md
Per decision 004: the question, the measured answer (every run's round, as the page listed it), what worked, what
didn't, what to keep, and **promote**, **iterate** or **kill**. With no playtest yet: "playtest pending", the build's
state and its checks, and "iterate: run the playtest" as the only recommendation.

## Gaps (accepted)
- Random notes in a scale: a stretch goal, only if the time box has room. It doesn't change the question.
- No time limit, no score saved, no take, no results screen, no link from song select.
- Laptop keys cover 10 white keys from the melody's lowest note; a wider melody ends early on laptop (the page says
  where).
- Web MIDI can't run headless: the DGX playback and the playtest are Eric's to check.

## Defaults
- The smaller option; log choices the spec doesn't make in `specs/decisions/simon-says-spike-*.md`.
- `twinkle` by default: 42 melody notes, no chords, and a tune a non-pianist likely knows.
- If restyle-spike's `melody()` (the same rule) is on `main` first, import it instead of writing a second one.
