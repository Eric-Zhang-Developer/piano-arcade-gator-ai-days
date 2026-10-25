## What shipped
`?x=record-follows`: in Learn and Flow a recording time-stretches, pitch kept, to follow the player, and in Learn it holds (a spectral freeze) while the clock waits at a note; a kit chip reads `FOLLOWING · 0.82×` or `HELD`. The source is a local song's audio.json recording, or a synthetic one rendered from the chart (`&record=synthetic`, or when there's none). Lineage: Antescofo (https://forum.ircam.fr/projects/detail/antescofo/) and SmartMusic (https://www.smartmusic.com/, now MakeMusic Cloud).
## Where it lives
`web/src/game/x/record-follows/` (vocoder, beatmap, steer, driver, synth, worklet, the plugin, the tests); `web/src/game/score-follow/players.ts`; `specs/decisions/record-follows-dsp.md`; a Lab poster.
## How to check it
`pnpm -C web exec vitest run src/game/x/record-follows src/game/score-follow`: drift+jitter on moonlight-1 7 ms median / 57 ms p95 (bars 40 / 80); per-beat change ≤ 3.1%; CPU ~3% of the block budget under node. Browser: not verified locally; covered by main's scheduled full run. Not heard by Eric.
## Gaps
The highway runs on the mode's clock, not the record's (no clock hook in /play); the per-beat record-to-highway gap is only logged. The sound is synthetic until Eric approves a real recording (#1289). (c) was measured offline under node, not in the worklet. (e) listening is Eric's.
