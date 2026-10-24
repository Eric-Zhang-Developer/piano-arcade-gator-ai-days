---
name: "UI tokens: the color and type tokens and the display font"
depends_on: []
owns: ["web/src/game/ui-tokens/"]
assignee: "eric-agent-1"
---

# UI tokens

The tokens every other frontend feature uses: `visual-direction.md`'s color table as CSS variables and as one
TypeScript module (canvas code can't read CSS cheaply), and the display font. Nothing on screen changes yet.

## Plan
1. `web/src/game/ui-tokens/index.ts`: every token in the table, by the same name in camelCase
   (`--pa-hand-r` → `handR`), plus the tier colors and `fontDisplay` (the CSS family string).
2. A `fix(core-loop)` PR (core-loop owns `layout.tsx` and `globals.css`): load Saira with `next/font/google`
   (weights 700, 800, 900; normal and italic; `display: "swap"`; CSS variable `--pa-font-display`), and declare every
   color token on `:root` in `globals.css`. The body font stays `system-ui`.

## Requirements
- Values exactly as `visual-direction.md` lists them. Existing colors keep their values.
- A helper `whenDisplayFontReady(): Promise<void>` (resolves on `document.fonts.load` of the display face, or after
  1 s), so canvas code can draw with the font without a flash of the fallback.
- No visible change: same layout, same colors, same font on every screen.

## Validation
- `pnpm -C web test`: every CSS variable in `globals.css` equals its value in the TypeScript module (read the CSS
  file as text). The helper resolves within 1 s with no font available.
- `verify.py --slug ui-tokens` passes. Screenshots of `/` and `/play` before and after: identical.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/ui-tokens-*.md`.

Frontend lane: #157. Issue: #145.
