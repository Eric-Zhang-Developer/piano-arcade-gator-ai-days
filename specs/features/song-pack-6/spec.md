---
name: "Song pack 6: Chopin's Prelude in A major, Brahms's Waltz in A-flat, Träumerei, Bach's Invention No. 1 and the K. 331 theme"
depends_on: ["song-pack-1"]
owns: ["web/public/songs/chopin-prelude-7/", "web/public/songs/brahms-waltz-15/", "web/public/songs/traumerei/", "web/public/songs/invention-1/", "web/public/songs/mozart-331-theme/", "specs/features/song-pack-6/", "changes/song-pack-6.md", "specs/decisions/song-pack-6-"]
assignee: "eric"
---

# Song pack 6

Issue #849. Eric, 2026-10-25: "Another thing would be probably about 20 more songs". Packs 5 to 8 add about 20 songs,
easiest first; this one is five **Easy-medium to Medium** pieces, the next step up from pack 5. Every rule in
`song-pack-1`'s Requirements applies here unchanged (sources, what to chart, range, tempo): read it first. Use its
converter (`game-tools/midi-to-chart/`) and rely on its library test. If either needs a change, that's a
`fix(song-pack-1)` PR, not this one.

| id | Piece | Target rung | Source (planner's pick; you confirm it) | Watch for |
|---|---|---|---|---|
| `chopin-prelude-7` | Chopin, Prelude in A major, Op. 28 No. 7 | Easy-medium | [Mutopia 470](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=470), Public Domain | Very short: chart the whole prelude. If it's under 30 s at the chart's `bpm`, say so; don't repeat it to pad it. (Pack 4 named this id as its backup and didn't use it.) |
| `brahms-waltz-15` | Brahms, Waltz in A-flat, Op. 39 No. 15 | Easy-medium | [Mutopia 794](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=794), Public Domain | Op. 39 exists in more than one solo version (Ed. Joseffy here): say which one the file is. |
| `traumerei` | Schumann, "Träumerei", *Kinderszenen*, Op. 15 No. 7 | Medium | [Mutopia 504](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504), Public Domain | Held inner voices and fermatas. A chart has one tempo: fermatas aren't charted; log it. |
| `invention-1` | Bach, Invention No. 1 in C, BWV 772 | Medium | [Mutopia 40](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=40), CC BY-SA 3.0 | Two voices, one per hand. Ornaments: the main note only; list the ones left out. |
| `mozart-331-theme` | Mozart, Piano Sonata No. 11, K. 331, 1st movement, the Tema | Medium | [Mutopia 614](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=614), Public Domain | The theme only, not the variations (each is its own Mutopia entry). Compound meter: `beatsPerBar` in quarter notes. |

## Plan
1. **Check each source first**, before charting it: open the Mutopia page, confirm the piece, the edition and the
   license match the table, and download the MIDI and the PDF from that page. **Measure the tempo from the source**: the
   score's printed marking (word and any metronome number) and the MIDI file's own tempo. Write both in the done note;
   never a tempo from memory. A row that doesn't hold up (another piece, another license, no MIDI) is a `needs-human`
   issue for that song, and the others still ship.
2. **One `feat(song-pack-6)` PR**, with one commit per song, easiest first, each from its own cited score.
3. **Credits** for the CC BY-SA source go in `CREDITS.md` through a separate `docs:` PR, which the license requires.

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed. Notes come from the cited
  score only, never from memory. Count the chosen bars' notes against the PDF and write the count in the done note.
- **Excerpt length:** 30 to 90 seconds at the chart's `bpm`, as in pack 1, starting at the piece's opening.
- **Tempo:** Easy-medium slower than marked and Medium near it, as in pack 1. The done note gives the marking, the
  MIDI's tempo and the chart's `bpm`. Eric does a piano pass for `bpm` afterward.
- **Level:** the rung above is a target, not a number. `difficulty.ts` computes each level; the done note lists them
  beside the library's Easy-medium and Medium songs. If one lands far from its rung, say so; don't retune difficulty
  here.
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
