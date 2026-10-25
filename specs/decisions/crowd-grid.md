# crowd: the beat grid, the meter and the spark

Feature `crowd` (#1345, PR #1361). It covers the choices the spec left open for the screen, in
`web/src/game/x/crowd/score.ts` and `crowdUi` in `index.tsx`.

## Picking backbeat or every beat
- **What the spec says:** "the grid with the higher on-beat share". Taken literally, it always picks every beat:
  - every backbeat (2 and 4) is also a beat;
  - so a clap within ±60 ms of the backbeat grid is within ±60 ms of the every-beat grid;
  - so every-beat's share is never lower.
- **The rule taken:** among the claps within ±60 ms of any beat, if at least 2/3 land on 2 and 4, the room is clapping
  the backbeat. A clap on 1 or 3 then counts as off.
  - The rule needs 4 such claps before it decides, and backbeat only exists in 2/4 and 4/4.
  - The settings (`scoreSettings`) are `backbeatShare` 2/3 and `minForGrid` 4.
  - Each clap's signed error is re-measured against whichever grid wins.
- **Other options:** score both grids and show the higher, which is the degenerate one; or ask the player for a
  grid, which the spec doesn't allow, since the room isn't the player.
- **How to undo:** set `backbeatShare` above 1, and it's every beat always.

## The meter
- **Where:** a bracketed Duo panel under the HUD band's right end. It's 16% of the width and 56% of the band's height,
  8 px below the band, with CROWD in the data face and the share in the numeral face.
- **The bar:** a 3 px primary-blue foot eases to the share with a 300 ms time constant (exponential, frame-rate
  independent), so one clap nudges it rather than jumping it.
- **Reduced motion:** the number alone, with no bar, no ease and no ruler.

## The spark (a tick on the hit line)
- **The scale:** ±120 ms maps to ±12% of the width around the hit line's centre. Errors beyond that are pinned to the
  edge.
- **The brackets:** two hairlines mark the ±60 ms on-beat bound.
- **Each tick:** a clap is a 3 × 14 px tick in ink when on beat and ink-dim when off. It rises 14 px and fades over
  1.2 s. Early is left, late is right.
- **Why ink and not the judgment colours:** the room's ticks are kept out of the player's judgment colours so they
  never read as the player's hits.
