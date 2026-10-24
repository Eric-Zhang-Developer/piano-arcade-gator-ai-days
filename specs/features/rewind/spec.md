---
name: "Rewind: in wait mode, ← moves back one bar and → skips ahead one, with the clock and holds set right"
depends_on: ["wait-mode", "wait-hud", "bar-lines", "play-slots"]
owns: ["web/src/game/rewind/"]
assignee: "eric"
---

# Rewind

In wait mode, and so in chunk-practice's learn steps (`mode=wait`), a slip means playing on or retrying from the
first bar. Stepping back a bar to replay a passage is how a teacher drills it.

Issue: #364

## Plan
The clock lives in `/play` (`web/src/app/play/page.tsx`), so most of this is small fixes in their owners' files.
Five PRs, in this order, the done note last:
1. `contract:` the `resume` comment in `web/src/contracts/index.ts` (comment only): after a rewind, `resume`'s
   `atMs` is the new chart time, not the pause's. Every consumer already re-anchors on it (scenes, hand-mode, beat,
   midi-watchdog: `grep -n '"resume"' web/src/game`), so hand-mode's other hand replays the bar.
2. `fix(wait-mode)`: `barStep(barStarts, nowMs, dir)`, the bar start to jump to, or `null`; `holdClock` gets
   `seek(chartMs, outerMs)`, and `shouldHold` gets a floor, so notes before the last seek's target are never held for.
3. `fix(core-loop)`: `Judge.rewind(fromMs)` un-judges every note at or after `fromMs` (its judgment and `noteState`)
   and resets the combo. `/play` handles ← and → as Requirements say.
4. `fix(wait-hud)`: on a `resume` whose `atMs` isn't its pause's, `hits` becomes the count of notes before `atMs`.
5. `feat(rewind)`: `web/src/game/rewind/`: a start-panel hint in wait mode, `verify-rewind.mjs`, the done note, and
   one line in `layers.ts`.

## Requirements
- **Keys:** ← (`ArrowLeft`) and → (`ArrowRight`), no modifiers, no repeat; only in wait mode, while playing (not in
  the pause menu or countdown), and past the count-in (chart time ≥ 0). In plain mode they do nothing. They work
  with `input=test` too (Esc doesn't), so the headless check can press them.
- **Targets** (bar starts are `hw.barLines`' `atMs`, the chart /play plays): ← goes to the start of the bar before
  the one now is in (bar 1 stays at bar 1's start); → to the next bar's start. → in the last bar does nothing.
- **What happens, in order:** a `pause` at the current time; held keys end there, as Esc's pause does; on ←,
  `judge.rewind(target)`; `wait.seek(target)`; a `resume` at the target. The clock then runs from the bar start and
  holds at its first note, as wait mode always does. Notes skipped by → stay unjudged and aren't held for; the
  take's end marks them MISS as today (wait mode's results aren't scored).
- **Hint:** wait mode's start screen adds `← → back or ahead a bar`, next to "Wait mode: the song waits".

## Validation
- `pnpm -C web test`: `barStep` on Twinkle's bars (2400 ms each at 100 bpm): from 3000 ms, ← gives 0 and → 4800;
  from 500 ms ← gives 0; → in bar 12 gives `null`. `holdClock` after `seek(0)` reads 0 and holds at a 0 ms note;
  after `seek(4800)` it never holds at a skipped 3000 ms note. `Judge.rewind(2400)` makes bar 2's notes pressable
  again and leaves bar 1's judged. wait-hud recounts on a moved `resume` and not on a plain one.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/rewind/verify-rewind.mjs --out <dir>`: prints `verify-rewind: pass` and exits 0, or names each
  failed step and exits 1. On `/play?song=twinkle&mode=wait&input=test`:
  1. Press bar 1's four notes and bar 2's first -> `__pianoArcade.now()` holds at 3000, `__pianoArcadeWaitHud.n` 6.
  2. Press ← -> `now()` is 0 and holds; `n` is 1. Press bar 1's notes again -> `n` is 5 (they were judgeable).
  3. The clock now holds at 2400 (bar 2's first note, un-judged by ←). Press → -> `now()` is 4800 and holds at
     bar 3's first note; `n` is 8 (bar 2's three notes skipped).
  4. The same keys on `/play?song=twinkle&input=test` (plain mode) -> `now()` keeps rising, so the check can fail.
  5. One chunk learn step (`from=5&to=8&tempo=70&passes=1&mode=wait&practice=1`): ← in its second bar goes to its
     first bar's start. Screenshots of the start-screen hint at 1280×720 and 1920×1080 in `<dir>`.
- `verify.py --slug rewind` passes, plain mode unchanged.
- On the piano (Eric; mark it in the done note): learn Für Elise's bars 1–4, use ← after a slip; with `hands=R`,
  does the left hand replay the bar?

## How it's built and checked
The only look is the hint line: follow `specs/context/visual-direction.md`, build with the `frontend-design`
skill, and review with taste v2's step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after
screenshots of the wait-mode start screen go in the PR.

## Defaults
- One press, one bar; no key repeat and no on-screen flash: the bar numbers on the highway (bar-lines) say where.
- The take's events keep their chart times, so a rewound take has overlapping times: replay and Download MIDI play
  them in time order. A Gap, not fixed here. The sheet window's colored noteheads stay until re-judged.
- If the `contract:` PR is refused, park rewind and file a `needs-human` issue: the event's meaning is shared.
- Log choices the spec doesn't make in `specs/decisions/rewind-*.md`.
