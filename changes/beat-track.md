## What shipped
A drum beat played by the piano itself (GM drums, channel 10) from the count-in to the end of each song: side stick on count-in beats, then kick on each bar's beat 1 and hi-hat on every beat, queued 300 ms ahead with `MIDIOutput.send` timestamps on the chart clock. With no "Portable Grand" output it plays laptop clicks instead; `?beat=off` turns it off; a corner label says where it plays.

## Where it lives
`web/src/game/beat/index.ts` (+ `beat.test.ts`) · one line in `web/src/game/layers.ts`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/beat-track/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/beat-track/20261024T054744Z` pass at 569c28f (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/beat-track/20261024T054744Z)

## Gaps
Not verified on the piano: nobody has heard it yet. A headless run with a stubbed "Portable Grand" output logged every hit on an exact beat, and laptop clicks exactly 600 ms apart (the first count-in click is dropped while the audio device starts). Eric's playtest and the scores in findings.md are still to come (#47). The beat stops when the results screen appears, about a bar before the spec's end-of-bar. Chrome may ask for MIDI permission on page load, because the output is requested before Start. No band, calibration, GOOD tier or FAST/SLOW (out of scope by spec).
