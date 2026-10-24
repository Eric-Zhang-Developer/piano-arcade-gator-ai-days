## What shipped
A "Download MIDI" button on the results screen (any take with a press) saves `<chart id>-<YYYYMMDD-HHmm>.mid`: format 0, 480 PPQ, the chart's title, tempo and time signature, and every press with its played velocity, tick 0 on bar 1 (whole-bar shift for count-in presses). Hand-written, no new dependency.

## Where it lives
`web/src/game/take-midi/` (`takeToMidi`, `midiFileName`, the button), one line in `web/src/game/layers.ts`.

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/take-midi/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/take-midi/20261024T111120Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/take-midi/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/take-midi/20261024T111120Z/sim` pass at 6914ad7 (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/take-midi/20261024T111120Z)
Headless Chrome: Twinkle as the Perfect player, then Download MIDI saved `twinkle-20261024-0702.mid`. An independent Python decoder read 42 notes, 0 ticks off the chart's beats, 100 BPM, 4/4, 12 bars.

## Gaps
- Not opened in MuseScore or GarageBand: this Mac's MuseScore is the iPad build with no CLI export, so the spec's "notes sit in the right bars" check is the decoder's, not a notation program's.
- Laptop keys play at one fixed velocity, so dynamics in the file are untested end to end. Piano check (Eric): download a real take and open it.
- The file name uses the player's local time, not UTC.
