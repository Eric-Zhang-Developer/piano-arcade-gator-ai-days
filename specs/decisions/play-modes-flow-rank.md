# play-modes: Flow ranks B at best below 90% held tempo

**Context.** Flow follows the player's tempo (0.5–1.3× the chart's), so a take at half speed could rank S. Eric,
2026-10-25 (#835): Flow as the default "would reward people for having terrible tempo". The spec makes the cap the
planner's call and has this PR write it down.

**Options.** A: no cap, only show the tempo. B: cap the rank below a held tempo. C: scale accuracy by the tempo.

**Choice: B.** Below 90% held tempo (`playModeSettings.rankCapTempo`), a Flow take ranks B at best
(`playModeSettings.capRank`); `flowRank` only ever lowers the rank. The held tempo is the median of `?tempo` × the
clock's rate after each hit, as a whole percent of the song's own BPM (`heldTempo`). It shows in Flow's results
headline ("Steady at 72% of tempo · …") and in the stats line beside the rank ("Tempo 72%"), so a B next to 100%
accuracy explains itself. C would change what accuracy means across screens.

**How to undo.** Make `flowRank` return its rank unchanged (or set `rankCapTempo` to 0) in
`web/src/game/play-modes/modes.ts`. The tempo stays shown.
