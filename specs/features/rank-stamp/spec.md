---
name: "Rank stamp: the rank letter stamps down"
depends_on: ["results-layout"]
owns: ["web/src/game/rank-stamp/"]
assignee: "eric-agent-1"
---

# Rank stamp

The rank letter lands with weight: the end of the results shot.

## Plan
1. A `fix(juice-visual)` PR: juice-visual's scale-in reveal of the rank becomes the stamp. Shared timing lives in
   `web/src/game/rank-stamp/`.

## Requirements
- The rank starts 1.2 s after results show (the tally's end), drops from about 1.6× to 1× in about 300 ms with a
  slight overshoot, and a brief gold flash rings out from it.
- Reduced motion: the rank shown at once, no flash.
- One loud thing at a time: nothing else animates during the stamp.

## Validation
- `pnpm -C web test`: the scale curve starts at 1.6, ends at exactly 1, and overshoots once.
- `verify.py --slug rank-stamp` passes. Three screenshots of the stamp in the PR.
- Eric's eye (mark it in the done note): the stamp lands. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/rank-stamp-*.md`.

Frontend lane: #157. Issue: #156.
