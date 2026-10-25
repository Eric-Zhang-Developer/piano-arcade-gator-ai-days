---
name: "Song pack 8: Liszt's Consolation No. 3, Rachmaninoff's C-sharp minor Prelude, the Pathétique's Rondo, the Revolutionary Étude and the Fantaisie-Impromptu"
depends_on: ["song-pack-1"]
owns: ["web/public/songs/liszt-consolation-3/", "web/public/songs/rachmaninoff-prelude-cs/", "web/public/songs/pathetique-3/", "web/public/songs/chopin-revolutionary/", "web/public/songs/fantaisie-impromptu/", "specs/features/song-pack-8/", "changes/song-pack-8.md", "specs/decisions/song-pack-8-"]
assignee: "eric"
---

# Song pack 8

Issue #849. Eric, 2026-10-25: "Another thing would be probably about 20 more songs". Packs 5 to 8 add about 20 songs,
easiest first; this one is five showpieces for the **Medium-hard to Expert** rungs, where the library has the fewest
songs. Every rule in `song-pack-1`'s Requirements applies here unchanged (sources, what to chart, range, tempo): read it
first. Use its converter (`game-tools/midi-to-chart/`) and rely on its library test. If either needs a change, that's a
`fix(song-pack-1)` PR, not this one.

| id | Piece | Target rung | Source (planner's pick; you confirm it) | Watch for |
|---|---|---|---|---|
| `liszt-consolation-3` | Liszt, Consolation No. 3 in D-flat, S. 172 | Medium-hard | [Mutopia 1647](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1647), CC BY 3.0 | Wide left-hand arpeggios: report the range. |
| `rachmaninoff-prelude-cs` | Rachmaninoff, Prelude in C-sharp minor, Op. 3 No. 2 | Hard | [Mutopia 2033](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2033), CC BY-SA 4.0 | Its tempo changes after the opening: excerpt only the part before the first change. If the excerpt is printed on three staves anywhere, hands follow the staves and stems; say where. |
| `pathetique-3` | Beethoven, Piano Sonata No. 8 "Pathétique", Op. 13, 3rd movement (Rondo) | Hard | [Mutopia 296](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=296), Public Domain | Use the same edition as `pathetique-2` if pack 7 shipped it. Check the meter in the score. |
| `chopin-revolutionary` | Chopin, Étude in C minor, Op. 10 No. 12 ("Revolutionary") | Expert | [Mutopia 743](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=743), Public Domain | Fast left-hand runs under right-hand chords and octaves. It may start under the marking so it's playable at all; say how far under. |
| `fantaisie-impromptu` | Chopin, Fantaisie-Impromptu, Op. 66 | Expert | [Mutopia 1693](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1693), Public Domain | Four against three between the hands: check the converter keeps both grids exactly. The middle section has another tempo: excerpt the opening only. Under the marking as for the Étude. |

## Plan
1. **Check each source first**, before charting it: open the Mutopia page, confirm the piece, the edition and the
   license match the table, and download the MIDI and the PDF from that page. **Measure the tempo from the source**: the
   score's printed marking (word and any metronome number) and the MIDI file's own tempo. Write both in the done note;
   never a tempo from memory. A row that doesn't hold up (another piece, another license, no MIDI) is a `needs-human`
   issue for that song, and the others still ship.
2. **One `feat(song-pack-8)` PR**, with one commit per song, easiest first, each from its own cited score.
3. **Credits** for the two credited sources (CC BY 3.0 and CC BY-SA 4.0) go in `CREDITS.md` through a separate `docs:`
   PR, which the license requires.

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed. Notes come from the cited
  score only, never from memory. Count the chosen bars' notes against the PDF and write the count in the done note.
- **Excerpt length:** 30 to 90 seconds at the chart's `bpm`, as in pack 1, starting at the piece's opening.
- **Tempo:** Hard and Expert near the marking or a little under, as in pack 4; the two Expert songs as their rows say.
  The done note gives the marking, the MIDI's tempo and the chart's `bpm`. Eric does a piano pass for `bpm` afterward.
- **Level:** the rung above is a target, not a number. `difficulty.ts` computes each level; the done note lists them
  beside the library's Hard and Expert songs (`alla-turca`, `moonlight-3`, `minute-waltz`). If one lands far from its
  rung, say so; don't retune difficulty here.
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
