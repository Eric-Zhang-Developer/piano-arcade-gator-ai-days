---
name: "Song pack 4: Gnossienne No. 1, The Entertainer, the Hall of the Mountain King, Rondo alla Turca and the Minute Waltz"
depends_on: ["song-pack-2"]
owns: ["web/public/songs/gnossienne-1/", "web/public/songs/chopin-prelude-7/", "web/public/songs/entertainer/", "web/public/songs/mountain-king/", "web/public/songs/alla-turca/", "web/public/songs/minute-waltz/", "specs/features/song-pack-4/", "changes/song-pack-4.md", "specs/decisions/song-pack-4-"]
assignee: "eric"
---

# Song pack 4

Eric, 2026-10-25: "Yes, send both packs to the planner as song-pack-3 and song-pack-4." Five songs for the
medium-hard to expert rungs: the famous pieces a judge will recognize in two bars. Every rule in `song-pack-1`'s
Requirements applies here unchanged (sources, what to chart, range, tempo): read it first. Use its converter
(`game-tools/midi-to-chart/`) and rely on its library test. If either needs a change, that's a `fix(song-pack-1)` PR,
not this one.

| id | Piece | Rung | Watch for |
|---|---|---|---|
| `gnossienne-1` | Satie, Gnossienne No. 1 | Medium | Printed with no bar lines. See **Gnossienne** below. |
| `entertainer` | Joplin, "The Entertainer" | Medium-hard | Syncopation, and right-hand octaves and chords. |
| `mountain-king` | Grieg, "In the Hall of the Mountain King", Op. 46 No. 4, piano version | Medium-hard | It accelerates, and a chart has one tempo. Excerpt only the part before the speed-up. |
| `alla-turca` | Mozart, Piano Sonata No. 11, K. 331, 3rd movement, "Alla turca" | Hard | Fast sixteenths, and grace notes: main notes only, and say which ornaments were left out. |
| `minute-waltz` | Chopin, Waltz in D-flat, Op. 64 No. 1 | Expert | Very fast right-hand runs over a waltz bass. It may start under the marking so it's playable at all; say how far under. |

## Gnossienne
The chart contract has one `beatsPerBar` per chart, and bar-lines and bar-loop number bars from it. With no printed
bar lines:
1. If a steady meter fits the score's own phrase groups (the left hand's repeating pattern), chart it in that meter.
   Check that bar-lines draws sensible lines and that a bar loop (`&from=1&to=4`) plays a whole phrase. Log the meter
   and why in `specs/decisions/song-pack-4-gnossienne.md`.
2. If no meter fits, use the backup instead: **Chopin, Prelude in A major, Op. 28 No. 7**, id `chopin-prelude-7`,
   from its Mutopia piano score. Say so in the done note.

## Plan
1. **One `feat(song-pack-4)` PR**, with one commit per song, easiest first, each from its own cited score. A song with
   no allowed source gets a `needs-human` issue and is skipped; the others still ship.
2. **Credits** for these sources go in `CREDITS.md` through a separate `docs:` PR, which a CC BY-SA source requires.

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed. Notes come from the cited
  score only, never from memory.
- **Excerpt length:** 30 to 90 seconds at the chart's `bpm`, as in pack 1. For the Mountain King, the opening up to
  the first tempo change.
- **Tempo:** Hard and Expert songs near the score's marking or a little under, and the Minute Waltz as above. Eric does
  a piano pass for `bpm` afterward.
- **Ids:** as in the table, unless one clashes with a song already in the library; then pick the next clear id and
  say so in the done note.
- No game code changes.

## Validation
- `pnpm -C web test`: `song-pack-1`'s library test passes with every chart in the library.
- `/play?song=<id>` for each of the five: it loads and plays, and with `?input=test` the Perfect player finishes all
  PERFECT. For `gnossienne-1`, the bar loop above plays a whole phrase. Run it headless once under `verify.lock`, or
  by hand in Chrome, and say which in the done note.
- On the piano (Eric; mark it in the done note): play each once with both hands. It should be the piece you know,
  with readable lanes, and the order Medium to Expert should feel right. Say which `bpm` needs tuning.

## Defaults
- **Work it in when a worker is free** (Eric named eric-agent-3 and eric-agent-4, once CI frees them), after the Duo
  features in `extras`. Cut whatever isn't merged by the freeze.
- Prefer the smaller option: a shorter excerpt over a longer one.
- If an opening is too sparse to be fun or too hard to read on the highway, pick the next section that works and say
  why in the done note.
