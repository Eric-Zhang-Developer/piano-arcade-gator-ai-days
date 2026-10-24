---
name: Bar loop: practice bars X to Y at a slower tempo
depends_on: ["core-loop"]
owns: ["web/src/game/bar-loop/"]
assignee: "eric"
---

# Bar loop

The bridge between the lanes: the coach's drill ("loop bars 9–12 at 70%") becomes a game mode. The learning lane
links to it; this feature makes it play. Register with `transformChart` in `web/src/game/layers.ts`.

## Requirements
- `/play?song=<id>&from=<bar>&to=<bar>&tempo=<percent>` plays only bars `from` to `to` of the chart, at `tempo`% of
  its BPM, looping with a one-bar count-in between passes until stopped.
- Each pass is judged as its own take and results; the results screen shows each pass's accuracy in order, so
  improvement is visible.
- Bars are 1-based and inclusive. `tempo` is from 25 to 150; default 100. A bar range outside the chart shows an
  error, not an empty highway.

## Validation
- Vitest: the pure `transformChart` keeps exactly the notes in the bar range, re-timed for the tempo, and rejects a
  bad range.
- `verify.py`: open `/play?song=twinkle&from=1&to=2&tempo=70&input=test`, play two Perfect passes, and see two
  100% passes listed.

## Defaults
- Without `from` and `to`, nothing changes: the whole chart plays once.
