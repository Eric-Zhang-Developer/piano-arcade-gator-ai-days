## What shipped
Laptop sounds at game events, all synthesized (no files): a stinger on each combo milestone, a rising sweep on fever, a drumroll from `songEnd` then a rank hit 900 ms later, a fanfare after it on a full combo, and a quiet low cue on each miss. Scheduled on the audio clock from `GameEvent.atMs`; audio starts on the Start press. Volume (`pianoArcade.sfxVolume`, default 0.5), mute and the miss cue are saved in `localStorage`.

## Where it lives
`web/src/game/sound/index.ts` (scheduler, synth, plugin), `web/src/game/sound/SfxControls.tsx`, `web/src/game/sound/sound.test.ts`, one line in `web/src/game/layers.ts`, `specs/decisions/juice-sound-rank-timing.md`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/juice-sound/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/juice-sound/20261024T071058Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/juice-sound/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/juice-sound/20261024T071058Z/sim` pass at 2b76b95

## Gaps
- `SfxControls` isn't on screen yet: `/play` is core-loop's, so mounting it on the start screen is a follow-up `fix(core-loop)` PR. Until then the saved defaults apply (50%, unmuted, miss cue on).
- Validation step skipped: Eric's mix check on the piano through the line-out. Headless, a Perfect Twinkle run created exactly the expected nodes (12 oscillators, 23 noise bursts) with no page errors; nobody has listened to it.
- Twinkle (42 notes) never reaches fever (50), so the sweep is only covered by the Vitest scheduler test.
