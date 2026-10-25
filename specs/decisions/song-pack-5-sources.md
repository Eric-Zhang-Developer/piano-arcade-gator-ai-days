# song-pack-5: the five sources, checked before charting

eric-agent-5, 2026-10-25. This is the spec's plan step 1. It checks each row of the table against its Mutopia page
and the files on it. All five hold: the right piece, the license the table names, a MIDI and a LilyPond source.

| id | Mutopia | Piece in the file | Edition (typesetter) | License | Printed tempo | MIDI tempo |
|---|---|---|---|---|---|---|
| `minuet-g-minor` | [76](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=76) | "Menuet", BWV Anh. 115, 3/4. The score notes the attribution to Petzold. | Bach-Gesellschaft (Allen Garvin) | Public Domain | none printed | ♩ = 140 (`\midi { \tempo 4 = 140 }`) |
| `musette-d` | [79](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=79) | "Musette", BWV Anh. 126, 2/4 | Bach-Gesellschaft (Allen Garvin) | Public Domain | none printed | ♩ = 120 |
| `happy-farmer` | [659](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=659) | *Album pour la jeunesse* No. 10, "Le gai laboureur", 4/4, eighth-note pickup | Peters (Philippe Hézaine) | CC BY-SA 2.5 | "Frais et gaillard", no metronome number | ♩ = 100 |
| `wild-horseman` | [655](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=655) | *Album pour la jeunesse* No. 8, "Le cavalier sauvage", 6/8, eighth-note pickup | Peters (Philippe Hézaine) | CC BY-SA 2.5 | "vif", no metronome number | ♩ = 152 |
| `old-french-song` | [2080](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080) | "Old French Song", Op. 39 No. 16, 2/4, eighth-note pickup | Schirmer, 1904 (David McNamara) | Public Domain | "Moderato assai." | ♩ = 70 |

- **Where the numbers come from:**
  - Each "MIDI tempo" is the file's own set-tempo event, read from the `.mid`. Each matches the `\midi` block in the
    `.ly`.
  - The printed tempos are the `.ly` text the PDF engraves.
  - None of the five prints a metronome number. Every number here is the typesetter's MIDI choice, not the
    composer's.
- **File hashes (sha256),** for the charts' `source` fields:
  - `anna-magdalena-05.mid` 6584a133df31cc3635af7c616b14e8c67f8d99df96a91371c54daf3745d4f444
  - `anna-magdalena-22.mid` 3b03c3939b767a0d46b77eba058d6decc0f191bfb1aa81a1a3bafc9c49098275
  - `schumann-op68-10-gai-laboureur.mid` 2cdada01ea988df090bfd0ab4bc377b28d97c7dee390a862822e541a47d921de
  - `schumann-op68-08-cavalier-sauvage.mid` 197f870dea372a09c7905b9b02c6ed3b4c6b10b18a3b79c421ca01947dc45991
  - `16OldFrenchSong.mid` 112c3b61dab55f58bc44d9f3522ef21b3479ffa1953097783ff8c4f10e40175d
- **Ids:** none clashes with a song already in `web/public/songs/`, so all five keep the table's ids.
- **Credits:** the two Schumann pieces (CC BY-SA 2.5, Philippe Hézaine) need a `CREDITS.md` line each, through a
  separate `docs:` PR. The three public-domain pieces need none, but their `source` field names the typesetter, as
  `minuet-g` does.
- **How to undo:** each chart's `source` field carries this provenance. To swap a source, re-chart from the new file
  and edit its row here.

## Excerpts and how to rebuild them
These are the commands, run from `game-tools/midi-to-chart/` with the five files in `source/`. Each adds `--id`,
`--title`, `--composer`, `--catalog`, `--source` and `-o`, taken from the chart's own fields.

```bash
.venv/bin/python convert.py source/anna-magdalena-05.mid --rh 1 --lh 2 --spans 0-48,0-48 --bpm 90 ...                     # minuet-g-minor
.venv/bin/python convert.py source/anna-magdalena-22.mid --rh 1 --lh 2 --spans 0-16,0-16,16-40,16-40 --bpm 90 ...         # musette-d
.venv/bin/python convert.py source/schumann-op68-10-gai-laboureur.mid --rh 1 --lh 3 --pickup 0.5 --bars 1-21 --bpm 90 ...  # happy-farmer
.venv/bin/python convert.py source/schumann-op68-08-cavalier-sauvage.mid --rh 1 --lh 3 --spans 0-72 --start-beat 2.5 --bpm 120 ...  # wild-horseman
.venv/bin/python convert.py source/16OldFrenchSong.mid --rh 1 --lh 2 --pickup 0.5 --bars 1-17 --bpm 60 ...                # old-french-song (held back: #989)
```

- **Repeats:**
  - **Minuet and Musette:** their MIDI files play each repeat once, so the spans write the repeats out.
  - **The Wild Horseman:** its MIDI already unfolds the A repeat, so one span covers A, A and B. The first try used
    two spans and played A three times; the note count against the LilyPond source caught it.
- **No edits after the converter.** Its one change: in the Happy Farmer, the right hand's B♭3 at beat 13 was cut to
  end where the left hand's B♭3 starts, half a beat later. This is the library's no-overlap rule.
