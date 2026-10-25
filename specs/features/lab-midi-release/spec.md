---
name: "Lab MIDI release: the DGX pages let go of every note and the pedal on Stop, pause and leaving"
depends_on: ["round", "speaking-piano", "conductor", "golden-demo", "inside", "composers-hands"]
owns: ["specs/features/lab-midi-release/", "changes/lab-midi-release.md", "specs/decisions/lab-midi-release-"]
assignee: "eric"
---

# Lab MIDI release

Issues #1310-#1314, from a post-merge bug review of the features merged on Oct 25. Each one leaves the DGX sounding
after the player asked it to stop. One PR: the thing a person hears is one moment, the piano going quiet.

**The shared cause.** Chrome's `MIDIOutput` has no `clear()`, so `out.clear?.()` does nothing. Messages are handed
to Chrome up to a lookahead ahead, so a single All Notes Off at `now` lands before notes already queued. The repo
already has the pattern these pages skip: `piano-out/index.ts:85-94` (`stopReplay`) and
`x/composers-hands/rolls.ts:73-81` (`silence`) send All Notes Off and pedal up now and again after the lookahead.
Reuse one of them; don't write a third.

## The changes
1. **#1310 round:** `quiet()` (`x/round/index.tsx:60-64`) repeats `silence(voices)` at `now + lookaheadMs`.
2. **#1311 speaking-piano:** `playback.ts` `stop()` repeats All Notes Off and pedal up at `now() + lookaheadMs`.
3. **#1312 conductor:** `session.ts` `silence()` repeats CC123 and CC64=0 at `now + scheduleSettings.lookaheadMs`.
4. **#1313 golden-demo:** a bot demo's pedal comes up on `pagehide` and on demo-reset's Shift+Esc
   (`scenes/index.ts` registers `pagehide` -> `cancel()`, or pedal-up joins demo-reset's and piano-out's silence).
5. **#1314 inside, composers-hands, speaking-piano:** `play()` claims the run (a token or `playing`) before its first
   await and bails after each await if superseded or unmounted, so a double click or leaving mid-await can't start a
   scheduler Stop can't reach.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/x/round/index.tsx`, `echo.ts`, `round.test.ts` | round | free |
| `web/src/game/x/speaking-piano/playback.ts`, `Speak.tsx`, `speaking-piano.test.ts` | speaking-piano | free; lab-camera-release edits `mic.ts` in the same folder |
| `web/src/game/x/conductor/session.ts`, `conductor.test.ts` | conductor | free; lab-camera-release edits `Conduct.tsx` |
| `web/src/game/scenes/index.ts`, `scenes.test.ts` | scenes | **#600** (draft): switch once #600 frees it, or take the demo-reset route below |
| `web/src/game/demo-reset/index.tsx` | demo-reset | free |
| `web/src/game/x/inside/Inside.tsx`, `inside.test.ts` | inside | free |
| `web/src/game/x/composers-hands/ComposersHands.tsx`, `composers-hands.test.ts` | composers-hands | free |

If #600 still holds `scenes/index.ts`, fix #1313 in `demo-reset/index.tsx` (pedal up beside its CC123) and say in the
PR that the reload path waits for #600; log it in `specs/decisions/lab-midi-release-pagehide.md`.

## Validation
Nothing a person sees changes, so there's no design pass; the PR's Design section says so.
- **(a)** Each issue's Done-when, checked in its own unit test with a fake output and fake timers:
  - #1310 `round.test.ts`: after a pause mid-echo, the last message on channels 2-4 is CC123, stamped at or after
    every queued note-on.
  - #1311 `speaking-piano.test.ts`: play, advance 1 s, stop; every note-on has a later 0x80 or CC123 on its channel.
  - #1312 `conductor.test.ts`: after `stop()`, the last CC64 is 0 and stamped at or after the last CC64=127 and note-on.
  - #1313 `scenes.test.ts` (or a demo-reset test): `pagehide` (or the reset) mid-pedal sends `[0xb0, 64, 0]`.
  - #1314 per page: two rapid `play()` calls give one interval, and Stop (or unmount mid-await) leaves none running.
- **(b)** `pnpm -C web exec vitest run src/game/x/round src/game/x/speaking-piano src/game/x/conductor
  src/game/scenes src/game/demo-reset src/game/x/inside src/game/x/composers-hands` passes.
- **(c)** The Checks in `specs/tech-stack.md`. On the real DGX, not verified here: the done note says "not verified on
  the DGX" and names the tests.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/lab-midi-release-*.md`.
- No new dependency, no change to `web/src/contracts/`.
