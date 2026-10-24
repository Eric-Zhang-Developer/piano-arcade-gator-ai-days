---
name: "Note pills: Synthesia-style notes, bright as they near the line"
depends_on: ["ui-tokens", "hand-colors"]
owns: ["web/src/game/note-pills/"]
assignee: "eric-agent-1"
---

# Note pills

Notes drawn the way `visual-direction.md` says: rounded pills sized to their key, hue by hand (from
`hand-colors`), brightness by time to hit.

## Plan
1. Pure helpers in `web/src/game/note-pills/`: `pillRect(key, isBlack)` and `brightness(msToHit, lookaheadMs)`.
2. A `fix(core-loop)` PR: `drawHighway` draws notes with them.

## Requirements
- Rounded ends; black-key notes about 56% the width of white-key notes (Synthesia's ratio, from
  `reference-notes/synthesia-brahms.md`).
- Brightness rises from about 35% at the top of the lookahead to 100% at the line; the head stays `--pa-flare`.
- Repeated notes stay visibly separate (core-loop's gap rule).
- Hue comes from `hand-colors`; this feature doesn't pick hand colors.

## Validation
- `pnpm -C web test`: widths, the brightness curve's ends and that it only rises.
- `verify.py --slug note-pills` passes. Screenshots of the densest committed song mid-passage.
- Eric's eye (mark it in the done note): play two hands; can you tell what's next and which hand. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/note-pills-*.md`.

Frontend lane: #157. Issue: #151.
