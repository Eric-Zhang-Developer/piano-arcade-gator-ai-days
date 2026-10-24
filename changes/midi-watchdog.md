## What shipped
`/play` now detects a MIDI input that goes silent and reconnects it. It re-requests MIDI access and restarts core's MIDI device, with no gap and no duplicate key events. A "reconnecting MIDI" notice shows until a message arrives. Unplugging shows "piano disconnected: laptop keys active". Each stall, recovery, unplug and replug goes to the console and to the plugin's `log` list. The 3 s rule applies only after a `0xFE` (Active Sensing) has been seen on the port. Until then, a stall is 10 s without MIDI while notes are due (`specs/decisions/midi-watchdog-active-sensing.md`).

## Where it lives
`web/src/game/midi-watchdog/` (`index.ts`, `watchdog.test.ts`) · one line in `web/src/game/layers.ts` · `specs/decisions/midi-watchdog-active-sensing.md`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/midi-watchdog/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/midi-watchdog/20261024T065335Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/midi-watchdog/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/midi-watchdog/20261024T065335Z/sim` pass at 5788957 (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/midi-watchdog/20261024T065335Z)
On `/sim`, by hand at 5788957: Start, then Unplug showed the disconnected notice. After Replug, 10 s of silence logged `stall … no MIDI for 10030 ms while notes were due` and showed "reconnecting MIDI". A key click then logged `recovered`.

## Gaps
- **Piano Validation not done (it needs Eric):** play for 10 minutes with two Chrome tabs open, then close one, and record any stall and recovery.
- **Active Sensing in Chrome is still unmeasured,** so on the real piano the 10 s fallback applies until a `0xFE` arrives.
- **The cure is unproven:** whether re-requesting access fixes Chrome's real stall isn't known, because the cause isn't.
- **New-port-object dedupe:** the case where Chrome hands back new port objects is tested only with two fake MIDIAccess objects.
- **The results screen doesn't show the stall list yet:** it's core-loop's file. The list is on the plugin as `log`.
- **Laptop keys** were already always on in `/play`, so "switch to laptop keys" is just the notice.
