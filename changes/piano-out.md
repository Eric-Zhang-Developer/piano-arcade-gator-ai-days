## What shipped
The `piano-out` plugin records each take from the input it wraps, and `ReplayOnPiano` ("Replay on piano" / Stop) plays the last take through the Portable Grand output with its real gaps and velocities. Local Control goes off (CC 122 = 0) for the replay and back on at its end, on Stop, on a new song and on `pagehide`. Stop sends All Notes Off on all 16 channels, twice, 300 ms apart. Without a piano output the button renders nothing. The button sits beside Retry on the results screen (#113), checked on the sim's fake piano. The piano count-in is beat-track's, as the spec says.

## Where it lives
`web/src/game/piano-out/index.ts`, `web/src/game/piano-out/ReplayOnPiano.tsx`, `web/src/game/piano-out/piano-out.test.ts`, one line in `web/src/game/layers.ts`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/piano-out/web verify ...` pass at cae5b78 (input still judged 42/42 PERFECT through the recording wrapper, on test input and the sim MIDI path)

## Gaps
- Validation step skipped: Eric on the piano (sounds like the take, keys silent, no stuck notes after Stop).
