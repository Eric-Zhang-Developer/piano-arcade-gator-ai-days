---
name: "HUD skin: the HUD restyled to the tokens"
depends_on: ["ui-tokens"]
owns: ["web/src/game/hud-skin/"]
assignee: "eric-agent-1"
---

# HUD skin

The HUD in the direction's look: same layout, same numbers.

## Plan
1. A `fix(hud)` PR: the HUD draws with the tokens (`ui-tokens`) and the display face, after
   `whenDisplayFontReady()`. Anything shared and new goes in `web/src/game/hud-skin/`.

## Requirements
- Numbers (combo, score, counts, multiplier) in the display face, italic; labels in the body face.
- Panel background `--pa-panel`; judgment colors and tier colors from the tokens (their values don't change).
- Layout, sizes, positions and every number unchanged; hud's tests and `verify-hud.mjs` pass unchanged.

## Validation
- `pnpm -C web test` and hud's verify script pass unchanged.
- Screenshots mid-song at both sizes, before and after.
- Eric's eye (mark it in the done note): the HUD reads at a glance while playing. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/hud-skin-*.md`.

Frontend lane: #157. Issue: #150.
