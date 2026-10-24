---
name: "Song pack 1: Ode to Joy, Chopin's Prelude Op. 28 No. 4 and Für Elise, with a MIDI-to-chart converter"
depends_on: ["core-loop"]
owns: ["web/public/songs/ode-to-joy/", "web/public/songs/chopin-prelude-4/", "web/public/songs/fur-elise/", "web/src/game/songs/library.test.ts", "game-tools/midi-to-chart/"]
assignee: "eric"
---

# Song pack 1

The library grows from two songs (Twinkle, `minuet-g`) to ten, in two packs, ordered easy to hard. This pack fills
the easy and medium rungs with three songs, and builds the two things every later song reuses: a **converter** from
notation MIDI to a chart, and **one library test** that checks every chart in `web/public/songs/`. `song-pack-2`
adds five harder songs with both.

| id | Piece | Rung |
|---|---|---|
| `ode-to-joy` | Beethoven, "Ode to Joy" theme from Symphony No. 9, a piano arrangement | Easy |
| `chopin-prelude-4` | Chopin, Prelude in E minor, Op. 28 No. 4 | Easy-medium |
| `fur-elise` | Beethoven, "Für Elise", WoO 59 | Medium |

## Plan
1. **The converter** in `game-tools/midi-to-chart/`: Python with `mido`, in a venv that isn't committed (as
   `spikes/twinkle-13/` did). Input: a MIDI file, a track or channel, a bar range, a `bpm`. Output: a chart JSON in
   the `Chart` format. It takes a right-hand and a left-hand track or channel (notation MIDI has one per staff),
   reads the file's ticks per beat and time signature, writes `beat` and `duration` in quarter notes from beat 0 of
   the first chosen bar, sets each note's `hand` from its staff, and fills `id`s in time order.
2. **The library test**, `web/src/game/songs/library.test.ts`, over every `chart.json` under `web/public/songs/`
   (Twinkle and the Minuet included), so a new song needs a folder and no new test code.
3. **The three charts**, one commit each, each from its own cited source.

## Requirements
**Sources** (`mission.md`, decision 003):
- Notes come from a cited score or a MIDI file **exported from notation** (Mutopia, an openly licensed MuseScore
  file, an IMSLP MIDI with an open license). Never a recorded performance (its timing is off the grid), and never
  an agent's memory.
- Only sources decision 003 allows **committed**: public domain, CC0, CC BY, CC BY-SA. The pack must work from a
  fresh clone and on Vercel, so no local-only songs here.
- `source` in each chart holds the URL, the license and the edition. Licenses that ask for credit go in
  `CREDITS.md` through a separate `docs:` PR (this feature can't edit it); link that PR from this one.
- Check the notes against a scan of the edition: the note count of the chosen bars, counted from the score, equals
  the chart's. Write the count and how it was counted in the done note.
- If no allowed source can be reached for a song, file a `needs-human` issue for that song and ship the others.

**What to chart:**
- **Both hands**, as printed: treble-staff notes `hand: "R"`, bass-staff notes `hand: "L"`. Where the score
  crosses hands, follow its fingering or stem directions, and say where in the done note. The game already judges
  and draws every note by pitch whatever its hand.
- **Unisons:** when both hands play the same pitch at once, keep one note (the judge can't tell two apart) and log
  it.
- **An excerpt**, not the whole piece: the opening section, up to its first double bar or a natural cadence, between
  about 30 and 90 seconds at the chart's `bpm`. Record the bar range in the done note.
- Repeats written out if the score repeats the chosen bars.
- Ornaments: the main note only. Grace notes are skipped. Log each kind skipped in the done note.
- `beatsPerBar` from the score's meter, in quarter notes (3/8 is 1.5).
- **Chords** are charted as separate notes at the same `beat`.
- **Range:** report each chart's lowest and highest pitch. Two-hand charts won't fit the laptop keys (`keyMap` in
  `web/src/game/core/input.ts` spans 10 white keys from the chart's lowest): these songs are for the DGX. The
  highway shows the chart's whole range, so a wide chart has narrow lanes; keep a screenshot of the widest one in
  the PR.
- **Tempo:** `bpm` is a playability setting, not the score's marking: Easy and Easy-medium slower than marked,
  Medium near it. Say in the done note that Eric tunes it.

**The library test**, for every chart under `web/public/songs/`:
- It passes `validateChart`; its folder name equals its `id`; ids are unique across the library.
- Notes are in time order, and every `hand` is `"R"` or `"L"`.
- Every note has `duration > 0`, and no two notes of the same pitch overlap (the judge can't tell them apart).
- A Perfect player (every note pressed at offset 0, through `web/src/game/core/judge.ts`) gives all PERFECT,
  accuracy 100%, rank S.
- It prints nothing for a valid library and names the chart and the rule for any failure.

**The converter:**
- It refuses a file whose notes fall off a 1/12-beat grid (a performance, not notation), and says how many did.
- It refuses a chosen track with no notes in the bar range.
- A self-check in the script (`python3 game-tools/midi-to-chart/convert.py --self-test`) converts a small MIDI file
  it builds in memory and asserts the beats, durations and the meter's `beatsPerBar`.
- A `README.md` there: install, one example command, and what it refuses.

**No game code changes.** Songs play through `/play?song=<id>` (on main) and show in `song-select` once it lands.

## Validation
- `pnpm -C web test`: the library test passes for all five charts (Twinkle, Minuet if merged, and these three).
  Break one on purpose (a duplicate same-pitch note) -> the test names that chart; then revert.
- `python3 game-tools/midi-to-chart/convert.py --self-test` -> passes.
- In Chrome: open `/play?song=<id>` for each of the three -> it loads, the count-in plays, both hands' notes fall in
  the right lanes. With `?input=test`, the Perfect player finishes all PERFECT.
- On the piano (Eric; mark it in the done note): play each song once with both hands -> it's the piece you know,
  the lanes are readable, and the rung feels right (Ode to Joy easiest, Für Elise hardest of the three). Say which `bpm` needs tuning.

## Defaults
- Prefer the smaller option: a shorter excerpt over a longer one.
- Song order in `song-select` is its business (by title until a difficulty rating exists); don't change it here.
- If a source's MIDI and its score disagree, the score wins; fix the chart by hand and log it in the done note.
