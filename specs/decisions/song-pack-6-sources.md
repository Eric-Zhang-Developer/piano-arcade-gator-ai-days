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
  - Träumerei's `\repeat volta 1` is a single pass.
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
