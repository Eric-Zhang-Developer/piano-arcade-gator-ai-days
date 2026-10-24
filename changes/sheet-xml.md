## What shipped
`chartToMusicXml(chart)` writes MusicXML 4.0 for a chart: two staves, chords, up to four voices per hand, and tied pieces across barlines. `placeNotes(chart)` gives each note's staff, onset and pitch for sheet-view. The key comes from a Krumhansl–Schmuckler estimate; a table built from each chart's LilyPond source corrects it. The encoding line reads "generated from the chart".

| Chart | Written | Where it came from |
|---|---|---|
| chopin-prelude-4 | E minor, 2/2 | table: Mutopia 921 `chp-28-04-a4.ly:50-51` `\key e \minor` `\time 2/2` (the estimate gave A minor) |
| clair-de-lune | D♭ major, 9/8 | estimate and meter rule; `debussy_Ste_Bergamesq_Clair.ly:562-563` agrees |
| fur-elise | A minor, 3/8 | estimate; `fur_Elise_WoO59.ly:41-42` agrees |
| gymnopedie-1 | B minor, 3/4 | table (mode only): Mutopia 37 `gymnopedie_1.ly:32-33` `\key b \minor` (the estimate gave D major) |
| maple-leaf-rag | A♭ major, 2/4 | estimate; `maple.ly:35-36` agrees |
| minuet-g | G major, 3/4 | estimate; `anna-magdalena-04.ly:32-33` agrees |
| moonlight-3 | C♯ minor, 4/4 | estimate; `moonlight3-a4.ly:110-111` agrees |
| nocturne-op9-2 | E♭ major, 12/8 | table (meter only): Mutopia 1590 `chopin_nocturne_op9_n2.ly:92-93` `\time 12/8` (the rule gave 6/4) |
| ode-to-joy | G major, 4/4 | estimate; Mutopia 528 `ode.ly:60-61` agrees |
| twinkle | C major, 4/4 | estimate; Wikipedia rev 1378689555 LilyPond `\key c \major \time 4/4` agrees |

## Where it lives
`web/src/game/sheet-xml/` (`index.ts`, `key.ts`, `overrides.ts`, `sheet-xml.test.ts`); OSMD renders in `specs/features/sheet-xml/shots/`.

## How to check it
`pnpm -C web test` (sheet-xml: 49 tests, every chart read back note for note). `verify.py` printed: verify: `pnpm -C web verify && node web/src/game/sim/verify-sim.mjs` pass at f917535 (sheet-xml changes nothing it plays). All ten charts loaded in OSMD 2.2.0 in a headless smoke check (twinkle 12 bars … fur-elise 45).

## Gaps
- Pickups print as a full bar of rests, so bar numbers run one ahead (chopin-prelude-4, fur-elise, maple-leaf-rag, nocturne-op9-2).
- No beaming: OSMD shows eighths with flags. Sheet-view decides whether to auto-beam.
- Every source was read, so no chart is on an unchecked estimate.
- Not checked by a person: whether the Ode to Joy and Minuet scores read right to a pianist.
