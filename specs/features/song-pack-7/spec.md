---
name: "Song pack 7: the Pathétique's Adagio, the Raindrop Prelude, Chopin's C minor Prelude, Schubert's Moment musical No. 3 and Debussy's first Arabesque"
depends_on: ["song-pack-1"]
owns: ["web/public/songs/pathetique-2/", "web/public/songs/raindrop-prelude/", "web/public/songs/chopin-prelude-20/", "web/public/songs/moment-musical-3/", "web/public/songs/debussy-arabesque-1/", "specs/features/song-pack-7/", "changes/song-pack-7.md", "specs/decisions/song-pack-7-"]
assignee: "eric"
---

# Song pack 7

Issue #849. Eric, 2026-10-25: "Another thing would be probably about 20 more songs". Packs 5 to 8 add about 20 songs,
easiest first; this one is five famous **Medium to Medium-hard** pieces, the ones a judge knows in two bars. Every rule
in `song-pack-1`'s Requirements applies here unchanged (sources, what to chart, range, tempo): read it first. Use its
converter (`game-tools/midi-to-chart/`) and rely on its library test. If either needs a change, that's a
`fix(song-pack-1)` PR, not this one.

| id | Piece | Target rung | Source (planner's pick; you confirm it) | Watch for |
|---|---|---|---|---|
| `pathetique-2` | Beethoven, Piano Sonata No. 8 "Pathétique", Op. 13, 2nd movement (Adagio cantabile) | Medium | [Mutopia 295](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=295), Public Domain | The tune and its accompaniment share the right hand: both are `R`, as printed. |
| `raindrop-prelude` | Chopin, Prelude in D-flat, Op. 28 No. 15 ("Raindrop") | Medium | [Mutopia 471](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=471), Public Domain | The repeated note under the tune: same-pitch notes must not overlap (the library test). Excerpt the opening section only. |
| `chopin-prelude-20` | Chopin, Prelude in C minor, Op. 28 No. 20 | Medium | [Mutopia 472](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472), Public Domain | Short, all chords: chart the whole prelude, each chord as separate notes at one `beat`. |
| `moment-musical-3` | Schubert, Moment musical No. 3 in F minor, D. 780 (Op. 94 No. 3) | Medium | [Mutopia 1023](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023), Public Domain | Staccato left-hand chords: keep the printed lengths. |
| `debussy-arabesque-1` | Debussy, Arabesque No. 1, L. 66 No. 1 | Medium-hard | [Mutopia 1777](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1777), Public Domain | Triplets against duplets, and arpeggios across the keyboard: a wide range makes narrow lanes, so keep the widest chart's screenshot. |

## Plan
1. **Check each source first**, before charting it: open the Mutopia page, confirm the piece, the edition and the
   license match the table, and download the MIDI and the PDF from that page. **Measure the tempo from the source**: the
   score's printed marking (word and any metronome number) and the MIDI file's own tempo. Write both in the done note;
   never a tempo from memory. A row that doesn't hold up (another piece, another license, no MIDI) is a `needs-human`
   issue for that song, and the others still ship.
2. **One `feat(song-pack-7)` PR**, with one commit per song, easiest first, each from its own cited score.
3. **Credits:** every planned source is Public Domain. If a confirmed source asks for credit after all, it goes in
   `CREDITS.md` through a separate `docs:` PR.

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed. Notes come from the cited
  score only, never from memory. Count the chosen bars' notes against the PDF and write the count in the done note.
- **Excerpt length:** 30 to 90 seconds at the chart's `bpm`, as in pack 1, starting at the piece's opening.
- **Tempo:** near the score's marking, or a little under for Medium-hard, as in pack 1. The done note gives the marking,
  the MIDI's tempo and the chart's `bpm`. Eric does a piano pass for `bpm` afterward.
- **Level:** the rung above is a target, not a number. `difficulty.ts` computes each level; the done note lists them
  beside the library's Medium and Medium-hard songs. If one lands far from its rung, say so; don't retune difficulty
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
