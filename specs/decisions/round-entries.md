# round: the round charts, their sources and their entries

**Context.** The round's spec needs each chart from a cited notation source (decision 003), with its note count
checked and its entry interval taken from the source, not memory (eric-agent-7, 2026-10-25).

| Chart | Source | License | Notes | Entry | Where the source marks it |
|---|---|---|---|---|---|
| `rounds/frere-jacques` | Wikipedia, "Frère Jacques", the article's LilyPond score (https://en.wikipedia.org/w/index.php?title=Fr%C3%A8re_Jacques&oldid=1366602658), read 2026-10-25 | CC BY-SA 4.0 | 32 = (4 + 3 + 6 + 3) × 2, the four phrases each `\repeat unfold 2` | every 2 bars, 4 voices | Its MIDI score stacks the four 2-bar phrases (`first` … `fourth`) as four voices sounding together: a round entering every 2 bars. F major, 4/4, `\tempo 4=102`. |
| `rounds/row-your-boat` | Wikipedia, "Row, Row, Row Your Boat", the article's LilyPond melody (cited there to Gilbert DeBenedetti, gmajormusictheory.org), read 2026-10-25 | CC BY-SA 4.0 | 27, counted from the `\relative` line | every 2 bars, 4 voices | The article's SATB table starts each voice one line later. Each line is 2 bars of 6/8 ("Row, row, row your boat," is `c4. c4. \| c4 d8 e4.`). |

**Pitches** are the `\relative` reading of each line, from middle C = 60 (`c'`).

**Tempo.**
- **Frère Jacques:** the score's own 102.
- **Row, Row:** the article prints no tempo. 102 quarter beats a minute is our choice, the same pulse as Frère Jacques,
  and it's labeled so in the chart's `source`. 6/8 is charted as 3 quarter beats a bar, so the bar lines fall on
  the 6/8 bars.

**No third round:** neither source suggested one, and the spec makes it optional.

**Credits:** both are CC BY-SA, so they go in `CREDITS.md` through a separate `docs:` PR.

**How to undo:** delete `web/public/songs/rounds/`.
