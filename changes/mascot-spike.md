## What shipped
- A tech spike that answers yes: codex keeps one gator across six poses.
- sheet-06's pose sets pass the code checks in every pose. sheet-01 fails on pointing.
- 44 images were generated (the cap is 120). The pick page is staged for Eric.

## Where it lives
- `spikes/mascot/`: `gen.sh`, `pack.mjs`, `png.mjs`, `check.mjs`, `pick.html`, `prompts.md`, `FINDINGS.md`, `PICK.md`.
- Images stay in the ignored `out/`.
- Also: `specs/decisions/mascot-spike-choices.md` and `specs/features/mascot-spike/shots/`.

## How to check it
- `node spikes/mascot/check.mjs spikes/mascot/out` exits 0 and prints a pass count for each of the 38 sets; its
  self-test passes.
- `pick.html` was checked in the in-app browser at 1280×720 and 1920×1080, with no console errors.

## Gaps
- **Pick pending.** Eric picks on `pick.html` (Validation 3).
- **Likeness is judged by eye.** The checks don't see the bow tie, which is under 2% of the figure.
- **Scale differs between pose sets.** Promotion should use one scale for all sets.
- **The reduced-motion shot is simulated.** The page's own `prefers-reduced-motion` rule was injected, since the pane
  can't emulate it.
- **The images exist only on this machine.** They are generated outputs in the ignored `out/`.
