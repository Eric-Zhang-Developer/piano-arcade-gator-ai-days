---
name: "Wrong-note spike: the DGX plays a phrase from a real song with one note changed, and you spot which one"
depends_on: ["simon-says-spike", "piano-out", "laptop-sound", "song-pack-1", "minuet-g"]
owns: ["specs/features/wrong-note-spike/", "changes/wrong-note-spike.md", "web/src/game/wrong-note/", "web/src/app/wrong-note/", "spikes/wrong-note/", "specs/decisions/wrong-note-spike-"]
assignee: "eric"
---

# Spot the wrong note (spike)

Issue #521. Eric, 2026-10-25, on spikes: "We have a lot of agent hours ... Treat it as near-infinite. But the problem
is the humans." So the build is the agent's, and the human part is a 10-minute playtest. A prototype spike on the
game's code (decision 004): one question, findings at the end.

A listening game, the other half of Simon Says: the DGX plays eight notes of a tune you know with one note changed,
and you point at the one that sounded wrong. No AI, and no new data: the phrase is a library chart's melody, and the
change is the game's, labeled as one.

## The question
Can a non-pianist hear which note of an 8-note phrase from a familiar tune was wrong, often enough that the game is
fair, and want another set?
- **Yes:** in Eric's playtest, a non-pianist picks the right note in 6 or more of a 10-round set at a 2-semitone
  change (chance is 1 in 7), and at least one asks for another set unprompted.
- **No:** no non-pianist reaches 6 of 10, or none asks again.
- **Time box:** about 3 hours of agent time to build it. Then FINDINGS.md, whatever the state; with no playtest yet,
  it says "playtest pending". Start by 09:00 ET: no new spike work after Sun 2026-10-25 12:00 ET.

The 6-of-10 bar is the planner's, not a measured threshold.

## How it mounts
- Its own page, `/wrong-note` (`web/src/app/wrong-note/page.tsx`), over a pure module in `web/src/game/wrong-note/`.
  No line in `layers.ts`, no change to `/play`, and no link from any screen.
- Imported, never edited: `melody` and `phraseMessages` (`web/src/game/simon/`), `allNotesOff` and `Message`
  (`web/src/game/piano-out/`), and laptop-sound's "Portable Grand", so the laptop plays it when the DGX isn't
  plugged in.

## The game
- **Song:** `?song=<id>`, default `twinkle`; the page links Twinkle, Ode to Joy, Minuet in G and Für Elise, as `/simon`
  does.
- **A round:** 8 consecutive melody notes (Simon's `melody`: the right hand's top note per onset), from a random
  start in the song. One of notes 2–8 moves up or down by `shift` semitones (default 2; `?shift=1` is harder). The
  moved note never lands on either neighbor's pitch; if both directions would, the round picks another note.
- **Random, but replayable:** a seeded generator, `?seed=<n>`. The page shows the seed, so a set can be replayed.
- **Listen:** the phrase plays at the chart's own rhythm and tempo, channel 1, velocity 80, through "Portable Grand"
  with `MIDIOutput.send(data, timestamp)`. Eight dots light as each note sounds. **Replay** (R) plays it again; the
  round counts replays.
- **Answer:** click a dot or press 2–8. Then the reveal: the right dot is marked, the phrase plays as written, and
  the round says "Right" or "It was note n".
- **A set:** 10 rounds, then "7 / 10" and Again (button, Space or Enter). The page lists this session's sets in
  memory (song, shift, seed, each round's note, answer and replays), for Eric to copy into FINDINGS.md. Nothing is
  saved.
- **Stopping:** All Notes Off (`allNotesOff`) on Again, on each new round and on `pagehide`.

## Plan
1. Draft PR `feat(wrong-note-spike): spot the wrong note page`. The pure module first,
   `web/src/game/wrong-note/index.ts`: `makeRound(tune, rng, shift)`, `roundMessages(chart, round, startMs)` and the
   set as a reducer, `step(state, event)`; plus `wrong-note.test.ts`.
2. The page: a client component, the dots and the answer keys, no canvas.
3. `web/src/game/wrong-note/verify-wrong-note.mjs`.
4. Eric's playtest, then `spikes/wrong-note/FINDINGS.md`, then `changes/wrong-note-spike.md` last.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/wrong-note`, on synthetic charts (no notes typed from a
   song):
   - a round has 8 notes, exactly one differs from the source, by exactly `shift` semitones, at position 2–8;
   - the moved note never equals a neighbor's pitch; a phrase where it can't move picks another note;
   - the same seed gives the same set;
   - `roundMessages`: the moved pitch on channel 1, at the chart's beats and bpm, from `startMs`;
   - `step`: the right answer scores, a wrong one doesn't, replays are counted, round 10 ends the set.
2. `node web/src/game/wrong-note/verify-wrong-note.mjs --out <dir>`: `/wrong-note?song=twinkle&seed=1&midi=sim`.
   Read the round from the page's test hook, answer it right ("Right"), answer the next one wrong ("It was note n"),
   play to the end ("n / 10"), Again → round 1. A screenshot of the set's end; no console error. ci-browser's suite
   picks it up by name; locally, at most once, under the verify lock.
3. **On the DGX (Eric, about 10 minutes; the question):** two or more non-pianists, one set each at `shift=2`, and a
   second at `shift=1` if they ask. Record the page's set list and who asked to go again.

## FINDINGS.md (`spikes/wrong-note/FINDINGS.md`)
Per decision 004: the question, the measured answer (every set as the page listed it), what worked, what didn't,
what to keep, and **promote**, **iterate** or **kill**. With no playtest yet: "playtest pending", the build's state
and checks, and "iterate: run the playtest" as the only recommendation.

## Gaps (accepted)
- Answers are clicks or number keys, not the piano. Playing the right note back on the DGX is promotion work.
- Right hand only; no chords or left-hand changes; no rhythm changes. One changed note per round.
- No score saved, no take, no link from song select.
- Web MIDI can't run headless: the DGX playback and the playtest are Eric's.

## Defaults
- The smaller option; log choices the spec doesn't make in `specs/decisions/wrong-note-spike-*.md`.
- Twinkle by default, as `/simon`: a tune a non-pianist likely knows.
