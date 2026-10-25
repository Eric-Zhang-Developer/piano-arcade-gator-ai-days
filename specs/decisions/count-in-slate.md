# count-in: no title slate

- **Context:** the spec asks for a small title and composer slate at the highway's top left in the listen half, and
  says it goes if the look loop reads it as a repeat.
- **Options:** A: the slate under the HUD band (moved below the WARNING card on Lv 13+ songs). B: no slate.
- **Choice:** B. Round 1 drew A on Twinkle: the slate repeated the HUD band's song card, the same title and composer,
  about 40 px straight above it. Three names in one glance read as a stutter, not a slate. The stage card before
  Start and the HUD's song card already carry the song.
- **How to undo:** bring back a `slate` alpha in `countInAt` (1 in the listen half, fading over the count half's first
  beat) and draw `chart.title` / `chart.composer` under `meterLayout(...).bottom`, or under `warningLayout` when the
  WARNING card shows.
