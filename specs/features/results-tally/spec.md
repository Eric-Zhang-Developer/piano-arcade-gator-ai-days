---
name: "Results tally: the counts tally up one by one"
depends_on: ["results-layout"]
owns: ["web/src/game/results-tally/"]
assignee: "eric-agent-1"
---

# Results tally

The counts tally up, arcade style.

## Requirements
- `tally(t, target)` in `web/src/game/results-tally/`: pure, eased, reaching `target` exactly at the end.
- The counts tally in order (PERFECT first), all done within 1.2 s in total (`visual-direction.md`).
- Reduced motion: the final numbers at once.
- The DOM shows the final numbers once the tally ends, so verify scripts that read them still pass. If one reads
  before 1.2 s, the scripts wait for the end, not the tally for the scripts.

## Validation
- `pnpm -C web test`: starts at 0, ends exactly at `target`, never overshoots, never decreases.
- `verify.py --slug results-tally` passes. A short screen recording or three screenshots of the tally in the PR.
- Eric's eye (mark it in the done note): the tally feels arcade, not slow. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/results-tally-*.md`.

Frontend lane: #157. Issue: #155.
