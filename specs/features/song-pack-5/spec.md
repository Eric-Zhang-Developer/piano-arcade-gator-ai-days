---
name: "Song pack 5: the Minuet in G minor, the Musette in D, the Happy Farmer, the Wild Horseman and the Old French Song"
depends_on: ["song-pack-1"]
owns: ["web/public/songs/minuet-g-minor/", "web/public/songs/musette-d/", "web/public/songs/happy-farmer/", "web/public/songs/wild-horseman/", "web/public/songs/old-french-song/", "specs/features/song-pack-5/", "changes/song-pack-5.md", "specs/decisions/song-pack-5-"]
assignee: "eric"
---

# Song pack 5

Issue #849. Eric, 2026-10-25: "Another thing would be probably about 20 more songs". The issue: "easy and medium are
thin, and recognizable pieces win the video." Packs 5 to 8 add about 20 songs, easiest first; this one is five **Easy**
pieces that beginners learn. Every rule in `song-pack-1`'s Requirements applies here unchanged (sources, what to chart,
range, tempo): read it first. Use its converter (`game-tools/midi-to-chart/`) and rely on its library test. If either
needs a change, that's a `fix(song-pack-1)` PR, not this one.

| id | Piece | Target rung | Source (planner's pick; you confirm it) | Watch for |
|---|---|---|---|---|
| `minuet-g-minor` | Minuet in G minor, BWV Anh. 115 (*Anna Magdalena* notebook) | Easy | [Mutopia 76](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=76), Public Domain | The companion of `minuet-g` (Anh. 114). Credit the composer as `minuet-g` does (Petzold, attributed). |
| `musette-d` | Musette in D, BWV Anh. 126 (*Anna Magdalena* notebook) | Easy | [Mutopia 79](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=79), Public Domain | Left-hand leaps; check each against the score. |
| `happy-farmer` | Schumann, "The Happy Farmer", *Album for the Young*, Op. 68 No. 10 | Easy | [Mutopia 659](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=659), CC BY-SA 2.5 | The tune is in the left hand, under right-hand chords: hands still follow the staves. |
| `wild-horseman` | Schumann, "The Wild Horseman", *Album for the Young*, Op. 68 No. 8 | Easy | [Mutopia 655](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=655), CC BY-SA 2.5 | The tune moves from one hand to the other; staccato lengths as printed. |
| `old-french-song` | Tchaikovsky, "Old French Song", *Album for the Young*, Op. 39 No. 16 | Easy | [Mutopia 2080](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080), Public Domain | Right-hand tune over left-hand chords: chords are separate notes at one `beat`. |

## Plan
1. **Check each source first**, before charting it: open the Mutopia page, confirm the piece, the edition and the
   license match the table, and download the MIDI and the PDF from that page. **Measure the tempo from the source**: the
   score's printed marking (word and any metronome number) and the MIDI file's own tempo. Write both in the done note;
   never a tempo from memory. A row that doesn't hold up (another piece, another license, no MIDI) is a `needs-human`
   issue for that song, and the others still ship.
2. **One `feat(song-pack-5)` PR**, with one commit per song, easiest first, each from its own cited score.
3. **Credits** for the two CC BY-SA sources go in `CREDITS.md` through a separate `docs:` PR, which the license
   requires.

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed. Notes come from the cited
  score only, never from memory. Count the chosen bars' notes against the PDF and write the count in the done note.
- **Excerpt length:** 30 to 90 seconds at the chart's `bpm`, as in pack 1, starting at the piece's opening.
- **Tempo:** Easy songs slower than marked, as in pack 1. The done note gives the marking, the MIDI's tempo and the
  chart's `bpm`. Eric does a piano pass for `bpm` afterward.
- **Level:** the rung above is a target, not a number. `difficulty.ts` computes each level; the done note lists them
  beside the library's other Easy songs. If one lands far from Easy, say so; don't retune difficulty here.
- **Ids:** as in the table, unless one clashes with a song already in the library; then pick the next clear id and say
  so in the done note.
- Demo pedal and dynamics are not this pack's: `demo-performance` adds them in a later batch.
- No game code changes.

## Validation
- `pnpm -C web test`: `song-pack-1`'s library test passes with every chart in the library.
- `/play?song=<id>` for each of the five: it loads and plays, and with `?input=test` the Perfect player finishes all
  PERFECT. No local browser run by default (AGENTS.md load rule): the done note says "not verified locally; covered by
  main's scheduled full run".
- On the piano (Eric; mark it in the done note): play each once with both hands. It should be the piece you know, with
  readable lanes. Say which `bpm` needs tuning.

## Defaults
- Prefer the smaller option: a shorter excerpt over a longer one.
- If an opening is too sparse to be fun or too hard to read on the highway, pick the next section that works and say why
  in the done note.
