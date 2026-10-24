# hud-skin: GREAT keeps its literal color, and the canvas resolves the font variable

**Context:** the spec says judgment colors come from the tokens, but `visual-direction.md` names no GREAT token, and
canvas `ctx.font` can't read `var(--pa-font-display)`.

**Options:** for GREAT, a new `--pa-great` token (a `contract`-free but palette-deciding change in ui-tokens) or the
literal `#5ef2c4` it already had. For the font, resolve the variable with `getComputedStyle` once the face has loaded,
or hard-code `"Saira"`.

**Choice:** GREAT stays literal: naming it is visual-direction's call, and its value equals `--pa-hand-r`, which a
future token decision may want to separate. The font is resolved from the variable once `whenDisplayFontReady()`
settles, so next/font's fallback family comes along and a font change in `layout.tsx` reaches the HUD.

**How to undo:** use `handR` (or a new token) for GREAT in `web/src/game/hud/index.ts`; replace the resolved family
with a literal.
