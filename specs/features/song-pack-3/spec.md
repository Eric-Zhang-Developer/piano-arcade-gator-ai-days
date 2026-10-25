---
name: "Song pack 3: Clementi's Sonatina, l'Arabesque, Bach's Prelude in C, Moonlight's 1st movement and the Sonata facile"
depends_on: ["song-pack-2"]
owns: ["web/public/songs/clementi-sonatina-36-1/", "web/public/songs/burgmuller-arabesque/", "web/public/songs/bach-prelude-c/", "web/public/songs/moonlight-1/", "web/public/songs/mozart-545-1/", "specs/features/song-pack-3/", "changes/song-pack-3.md"]
assignee: "eric"
---

# Song pack 3

Eric, 2026-10-25: "Yes, send both packs to the planner as song-pack-3 and song-pack-4." Five songs for the easy to
medium rungs, the pieces piano students actually learn. Every rule in `song-pack-1`'s Requirements applies here
unchanged (sources, what to chart, range, tempo): read it first. Use its converter (`game-tools/midi-to-chart/`) and
rely on its library test. If either needs a change, that's a `fix(song-pack-1)` PR, not this one.

| id | Piece | Rung | Watch for |
|---|---|---|---|
| `clementi-sonatina-36-1` | Clementi, Sonatina in C, Op. 36 No. 1, 1st movement | Easy | Mutopia lists "Sonatina, O 36, for Piano": confirm the file is No. 1 before charting. |
| `burgmuller-arabesque` | Burgmüller, "L'arabesque", Op. 100 No. 2 | Easy-medium | Fast right-hand figures over staccato chords; keep the staccato lengths as printed. |
| `bach-prelude-c` | Bach, *The Well-Tempered Clavier* I, Prelude in C, BWV 846 | Medium | Use the harpsichord/piano entry, not the arrangement for two guitars. Held notes in the broken chords: chart the printed durations. |
| `moonlight-1` | Beethoven, Piano Sonata No. 14, Op. 27 No. 2, 1st movement | Medium | Use the same piano source as `moonlight-3`. Triplets throughout; check the meter (cut time) in the score. |
| `mozart-545-1` | Mozart, Piano Sonata in C, K. 545 ("facile"), 1st movement | Medium | Scale runs in the right hand: every note, as printed. |

## Plan
1. **One `feat(song-pack-3)` PR**, with one commit per song, easiest first, each from its own cited score. A song with
   no allowed source gets a `needs-human` issue and is skipped; the others still ship.
2. **Credits** for these sources go in `CREDITS.md` through a separate `docs:` PR, which a CC BY-SA source requires.

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed. Notes come from the cited
  score only, never from memory.
- **Excerpt length:** 30 to 90 seconds at the chart's `bpm`, as in pack 1, starting at the piece's opening.
- **Tempo:** near the score's marking, or a little under for the Medium songs. Eric does a piano pass for `bpm`
  afterward.
- **Ids:** as in the table, unless one clashes with a song already in the library; then pick the next clear id and
  say so in the done note.
- No game code changes.

## Validation
- `pnpm -C web test`: `song-pack-1`'s library test passes with every chart in the library.
- `/play?song=<id>` for each of the five: it loads and plays, and with `?input=test` the Perfect player finishes all
  PERFECT. Run it headless once under `verify.lock`, or by hand in Chrome, and say which in the done note.
- On the piano (Eric; mark it in the done note): play each once with both hands. It should be the piece you know,
  with readable lanes, and the order Easy to Medium should feel right. Say which `bpm` needs tuning.

## Defaults
- **Work it in when a worker is free** (Eric named eric-agent-3 and eric-agent-4, once CI frees them), after the Duo
  features in `extras`. Cut whatever isn't merged by the freeze.
- Prefer the smaller option: a shorter excerpt over a longer one.
