## What shipped
- While the chart clock holds (Learn, Flow's wait, the pause menu), a wrong key's pulse and a broken combo's digits end on wall time in their own 180 and 200 ms.
- Learn breaks no combo, so no stray "10" lands on "11 / 42".
- A rewind drops pulses ahead of the clock.
- A song that ends in fever drains its heat 1 → 0 over results-landing's out, on `landingT()`.
- #1332 (the key release in `core/highway.ts`) is not in this PR: #747 and #600 hold that file.
## Where it lives
- `web/src/game/miss-moment/` (`index.ts` `heldT`, test, `verify-miss.mjs` Learn step)
- `web/src/game/fever-arc/` (`arcAt`'s `landingMs`, test)
- `results-landing/verify-landing.mjs` (fever handoff check)
- `changes/fever-arc.md`, `specs/decisions/frozen-clock-fades-fever.md`
## How to check it
- `pnpm -C web exec vitest run src/game/miss-moment src/game/fever-arc`: 25 pass.
- In-app browser, same steps on main and branch:
  - Learn, wrong key on note 11: main still shows "10" and a red key 860 ms later; the branch is clean by 800 ms, with the clock held at 6600.
  - Perfect Twinkle with the landing: main logs 0 handoff frames; the branch logs 24 and no sustain after them.
- `verify-miss.mjs` and `verify-landing.mjs`: not verified locally; covered by main's scheduled full run.
## Gaps
- #1332 stays open.
- The "WRONG" judgment word also holds while the clock holds; it's drawn in `core/highway.ts` (held).
- Without the landing, fever still cuts at the results (decision above).
- No reduced-motion shot: the in-app browser has no reduced-motion emulation. The unit tests cover that branch's timing.
