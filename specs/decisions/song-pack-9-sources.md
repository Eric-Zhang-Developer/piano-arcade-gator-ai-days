# song-pack-9: the five sources, checked before charting

eric-agent-13, 2026-10-25. Plan step 1. Each source was read at the cited revision (`action=raw`), its score
compiled with LilyPond 2.26.0, and the MIDI converted with `convert.py`. All five hold: the right tune, the license
the table names, and one printed melody line.

| id | Source | License | Source tempo | Chart `bpm` | Notes (score = chart) | Level (Twinkle 1) |
|---|---|---|---|---|---|---|
| `hot-cross-buns` | Wikipedia oldid 1380991341, `<score>` | CC BY-SA 4.0 | 4 = 120 | 100 | 17 | 1 |
| `mary-lamb` | it.wikipedia oldid 150827858, `<score>` | CC BY-SA 4.0 | 4 = 220 | 100 | 26 | 1 |
| `london-bridge` | Wikipedia oldid 1381574731, `<score raw>` | CC BY-SA 4.0 | 4=102 (`\midi`) | 102 | 24 | 1 |
| `jingle-bells` | Commons, File:Jingle Bells refrain vector.svg, page LilyPond | PD-self; tune PD-old | 4 = 100 | 100 | 51 (soprano) | 2 |
| `frere-jacques-solo` | copy of `rounds/frere-jacques` (Wikipedia oldid 1366602658) | CC BY-SA 4.0 | 4=102 | 102 | 32 | 1 |

- **Choices:**
  - Hot Cross Buns: the 4 bars marked "Alternative" are B A G, as the spec expects, so the chart is bars 9–12.
  - Mary: `\language "deutsch"` is compiled as written; the chart is G major, B4 A4 G4 A4 ...
  - London Bridge: the score's own `\unfoldRepeats` MIDI order, both volta endings.
  - Jingle Bells: compiled from the page's LilyPond (`convert-ly -e` from 2.10.33), not the Commons `.mid`, so no
    binary download. `--rh-voice top` on the women's staff keeps the soprano; its 51 notes match the LilyPond
    soprano voice bar by bar.
  - Frère Jacques: the round's 32 notes copied unchanged, new id, same `source`; the round's chart isn't touched.
- **Each `.ly`** is the `<score>` text wrapped in `\score { ... \layout { } \midi { } }` (London Bridge's is raw and
  carries its own `\midi`; Jingle Bells' ChoirStaff is wrapped the same way).
- **sha256:** wikitext `hcb` fdc4abb4…759c, `mary` d6578c31…9997, `london` fe47d0a8…099b, `jingle` 0af20a41…6a77,
  `frere` 82448ffc…984f. Compiled MIDI `hcb` 298d3727…022f, `mary` a9b0dc26…3f00, `london` f12e6b2e…2533,
  `jingle` 7f435bfe…7667.

```bash
.venv/bin/python convert.py source/hcb.midi --rh 1 --bars 9-12 --bpm 100 ...
.venv/bin/python convert.py source/mary.midi --rh 1 --bars 1-8 --bpm 100 ...
.venv/bin/python convert.py source/london.midi --rh 1 --bars 1-8 --bpm 102 ...
.venv/bin/python convert.py source/jingle.midi --rh 1 --rh-voice top --bars 1-8 --bpm 100 ...
```

**How to undo:** delete the song's folder; each chart's `source` field carries its provenance.
