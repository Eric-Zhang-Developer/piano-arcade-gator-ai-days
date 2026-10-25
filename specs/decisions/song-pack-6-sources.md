# song-pack-6: the five sources, checked before charting

eric-agent-5, 2026-10-25. This is the spec's plan step 1. It checks each row of the table against its Mutopia page
and the files on it. All five hold: the right piece, the license the table names, a MIDI and a LilyPond source.

| id | Mutopia | Piece in the file | Edition (typesetter) | License | Printed tempo | MIDI tempo |
|---|---|---|---|---|---|---|
| `chopin-prelude-7` | [470](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=470) | Prelude, Op. 28 No. 7, 3/4, a quarter-note pickup | Edition Peters (Magnus Lewis-Smith) | Public Domain | "Andantino" | ♩ = 120 |
| `brahms-waltz-15` | [794](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=794) | Waltz, Op. 39 No. 15, 3/4, in A♭ major | Ed. R. Joseffy (Brian D. Rude) | Public Domain | none printed | ♩ = 116 |
| `traumerei` | [504](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504) | *Kinderscenen*, "Träumerei", Op. 15 No. 7, 4/4, a quarter-note pickup | *Leichte Stücke*, 1900 (Ying-Chun Liu) | Public Domain | none printed; "ritard." marks | ♩ = 56, with written-in ritardandos (below) |
| `invention-1` | [40](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=40) | Invention 1, BWV 772, 4/4 | Bach-Gesellschaft (jeff covey) | CC BY-SA 3.0 | none printed | ♩ = 80 |
| `mozart-331-theme` | [614](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=614) | Sonata KV 331, Tema, 6/8 | Breitkopf & Härtel, Leipzig (Stelios Samelis) | Public Domain | "Andante grazioso" | ♪ = 112 (♩ = 56) |

- **Where the numbers come from:** each "MIDI tempo" is the file's own set-tempo events, which match the `\midi` and
  `\tempo` lines in the `.ly`. The printed words are the `.ly` text the PDF engraves. None of the five prints a
  metronome number, so every number is the typesetter's MIDI choice.
- **Brahms, which version** (the spec asks):
  - The file is in A♭ major (`\key aes \major`). IMSLP's Op. 39 page
    (<https://imslp.org/wiki/16_Waltzes,_Op.39_(Brahms,_Johannes)>) lists No. 15 as "Waltz in A♭ major" under
    Brahms's own solo-piano version ("For Piano (Composer)"), and as A major in the four-hand original.
  - So the file is the solo-piano version, in its own key. The part of the IMSLP page I read doesn't name the
    simplified version's key, so this record makes no claim about it.
- **Träumerei's MIDI is not one tempo.** Its tempo track holds ♩ = 56, with ritardandos written in by hand: down to
  33 at bar 9, 35 at bar 18, and 17 at the last bar, plus a sixteenth at 100 at the very start. A chart has one
  `bpm`, so the chart takes 56. The ritardandos and fermatas are not charted, as the spec says.
- **Repeats:**
  - K. 331's MIDI already unfolds them (`\unfoldRepeats` in its `\midi` score).
  - Träumerei's MIDI plays its `\repeat volta` of bars 1-8 once, though the PDF prints the repeat signs.
  - The note count against the LilyPond source checks each one, as in pack 5.
- **File hashes (sha256),** for the charts' `source` fields:
  - `Chop-28-7.mid` 6eed7f2185afd852f01d695e50db84cdb4c8742de1a26294dc3202569346ef36
  - `waltz-op39-15.mid` e081ef3fe7023cdf4656e1528df50534b2e3df863cd0a194a04a82206f783ace
  - `SchumannOp15No07.mid` 6e0045d5783ff28dedcf05813074fe407ca3846e5e2a7246f2793ac5614e4851
  - `bach-invention-01.mid` 9b9a6213941932d5171d9102d85912c3c1c61f8176ce02005cd2198881823c2d
  - `KV331_1_1_tema.mid` 028e017fe5030fa982d906b649c578e4e853473b8cb6b987410ed4edfc00c884
- **Ids:** none clashes with a song already in `web/public/songs/`.
- **Credits:** the Invention (CC BY-SA 3.0, jeff covey) needs a `CREDITS.md` line, through a separate `docs:` PR.
- **Lesson from pack 5:** every chart also runs `sheet-xml.test.ts` locally before it's committed. Pack 5's Old
  French Song passed the library test and failed that one in CI (#989).
- **How to undo:** each chart's `source` field carries this provenance. To swap a source, re-chart from the new file
  and edit its row here.

## Excerpts and how to rebuild them
These are the commands, run from `game-tools/midi-to-chart/` with the five files in `source/`. Each adds `--id`,
`--title`, `--composer`, `--catalog`, `--source` and `-o`, taken from the chart's own fields.

```bash
.venv/bin/python convert.py source/Chop-28-7.mid --rh 1 --lh 2 --pickup 1 --bars 1-17 --bpm 90 ...             # chopin-prelude-7
.venv/bin/python convert.py source/waltz-op39-15.mid --rh 1 --lh 2 --bars 1-16 --bpm 90 ...                     # brahms-waltz-15
.venv/bin/python convert.py source/SchumannOp15No07.mid --rh 1 --lh 2 --spans 0-33,1-33 --start-beat 3 --bpm 56 ...  # traumerei
.venv/bin/python convert.py source/bach-invention-01.mid --rh 1 --lh 2 --spans 0-56.5 --bpm 76 ...              # invention-1
.venv/bin/python convert.py source/KV331_1_1_tema.mid --rh 1 --lh 2 --spans 0-48 --bpm 56 ...                   # mozart-331-theme
```

- **Converter fixes these need:** the Invention's 32nd notes need #999 (on main). Träumerei's grace groups need
  #1012; main's converter before it refuses the file.
- **Repeats:**
  - **Träumerei:** two spans write out bars 1-8 twice. The pickup sits before the repeat sign, so the second span
    starts at bar 1.
  - **K. 331:** the MIDI already unfolds the A section's repeat, so one span covers both passes. The B section isn't
    charted: the whole Tema with its repeats runs 116 s at 56.
- **One edit after the converter, in Träumerei:** four left-hand releases, two in each pass, follow the score.
  LilyPond's MIDI holds a note tied through a grace 71 ticks (of 384) past its written end.
  - The F tied from bar 2's `\grace { bes16 f'~ }` is `f2.` and ends with bar 2: chart beats 9-12 and 41-44.
  - The A held from bar 5 through bar 6's grace ends after bar 7's `a4.`: chart beats 21-29.5 and 53-61.5.
  - The converter's snapped ends were 1/6 beat later (3.1667 and 8.6667 beats long). `diff` against a fresh
    rebuild shows only these four durations.
- **Chopin** was rebuilt after #999. Bar 15's A, the note before the grace, now ends at 1/8 beat instead of 1/6, so
  the command above reproduces the chart.
