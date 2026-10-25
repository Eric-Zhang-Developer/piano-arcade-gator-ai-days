## What shipped
- Hand palette's and Menu sounds A/B's start-panel labels are set in the kit's data face (JetBrains Mono), not a system monospace, at 12 px or more (#1208).
- Rewind's ← → chips are square, a cyan hairline on a faint cyan field, like the help overlay's (#1209).
- The /real-keys rail title is upright Saira 900 (#1210).

## Where it lives
`web/src/game/x/hand-palette/index.tsx`, `web/src/game/x/ui-sounds-ab/index.tsx`, `web/src/game/rewind/index.tsx` (+ new `rewind.test.tsx`), `web/src/game/x/real-keys/real-keys.module.css`.

## How to check it
`pnpm -C web exec vitest run src/game/x/hand-palette src/game/x/ui-sounds-ab src/game/rewind src/game/x/real-keys` (44 pass, 2 skipped). Browser checks: not verified locally; covered by main's scheduled full run. In the dev server, the Palette and See as labels compute to JetBrains Mono at 12px (1280×720).

## Gaps
- The start screen hides rewind's panel (`StartScreen.tsx`, `hidden`), so the square chips show nowhere today. The unit test checks them, and there's no shot.
- /real-keys was shot without a camera (Camera off state).
