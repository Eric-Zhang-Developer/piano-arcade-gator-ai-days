## What shipped
- `?` opens one card that lists every control on `/` and `/play`, and Esc closes it. The card doesn't open during a take.
- The card's lines live in `keys.ts`. A drift test reads the source of seven features' key handlers and fails when one handles a key the card doesn't list.
- The card is mounted in the root layout (#652). It gained the lab's X line (#505, #651) and duo-select's P line (#723).
- Line padding is tightened so the whole card fits at 1280×720 without scrolling. It overflowed by 37 px once P landed.
## Where it lives
- `web/src/game/help-overlay/`: `keys.ts`, `index.tsx`, `help-overlay.module.css`, `help-overlay.test.ts` and `verify-help.mjs`.
- The mount in `web/src/app/layout.tsx`. Screenshots are in `specs/features/help-overlay/`.
## How to check it
`node web/src/game/help-overlay/verify-help.mjs --out <dir>`: not verified locally; covered by main's scheduled full run. It passed 20/20 before the mount merged (#686), with the mount applied locally.
## Gaps
- Look: only `/` at 1280×720 was shot, from the dev server. 1920×1080 wasn't shot because the pane crops it. The card's type scales with the viewport height, so 1920 has the same proportions.
- The card is still pre-Duo: a 10 px radius, italic headings, and a cyan top edge.
- Eric's eye: not verified by Eric. Still to do: hand the laptop to someone new with only "press ? for help".
