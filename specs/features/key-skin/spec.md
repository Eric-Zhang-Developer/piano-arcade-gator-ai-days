---
name: "Key skin: the drawn keyboard with sheen and a pressed glow"
depends_on: ["hit-line"]
owns: ["web/src/game/key-skin/"]
assignee: "eric-agent-1"
---

# Key skin

The drawn keyboard under the line, polished: it's in every shot of the video.

## Plan
1. Pure drawing helpers in `web/src/game/key-skin/`.
2. A `fix(core-loop)` PR: `drawHighway` draws the keys with them.

## Requirements
- White keys with a subtle top-to-bottom sheen; black keys with a thin top highlight.
- A pressed key glows in the hand color of the note it's playing, or plain white when it matches no note. Never red
  (a WRONG note is the HUD's and juice's to show).
- Key positions and widths unchanged: `Frame.keyX` gives the same numbers.

## Validation
- `pnpm -C web test`: `keyX` is unchanged for every pitch in a full 88-key layout.
- `verify.py --slug key-skin` passes. A screenshot with both hands pressing.
- Eric's eye (mark it in the done note): pressed keys are clear while playing. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/key-skin-*.md`.

Frontend lane: #157. Issue: #153.
