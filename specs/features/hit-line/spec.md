---
name: "Hit line: the animated electric judgment line"
depends_on: ["note-pills"]
owns: ["web/src/game/hit-line/"]
assignee: "eric-agent-1"
---

# Hit line

The judgment line as a glowing, gently moving "electric" stroke that brightens at each lit key
(`reference-notes/synthesia-brahms.md`, frame 2m13s).

## Plan
1. The stroke's path as a pure function of time and width in `web/src/game/hit-line/` (seeded, no randomness per
   frame that could flicker).
2. A `fix(core-loop)` PR: `drawHighway` draws it instead of the flat line.

## Requirements
- At most 6 px tall around `judgmentLineY`, so it never covers an arriving note. White core, a soft glow.
- Brightens over a pressed key in that key's light color.
- Reduced motion: a static line.

## Validation
- `pnpm -C web test`: the path stays within ±3 px of the line and is the same for the same time.
- `verify.py --slug hit-line` passes. A screenshot crop of the line with two keys lit.
- Eric's eye (mark it in the done note): the line is lively but not distracting. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/hit-line-*.md`.

Frontend lane: #157. Issue: #152.
