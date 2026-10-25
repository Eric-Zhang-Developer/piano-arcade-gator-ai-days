---
name: "Kit leftovers, small: two start panels' labels on the data face, rewind's key chips square, /real-keys upright"
depends_on: ["duo-tokens", "experiments", "hand-palette", "ui-sound-family", "rewind", "help-overlay", "real-keys"]
owns: ["specs/features/kit-leftovers-small/", "changes/kit-leftovers-small.md", "specs/decisions/kit-leftovers-small-"]
assignee: "eric"
---

# Kit leftovers, small

Issues #1208, #1209 and #1210, from a sweep of the experiments merged tonight. Three small places still wear type or
corners off the Duo kit: labels in a font token that doesn't exist, rounded key chips, and an italic title. One PR,
since they're one thing a person sees: the kit's type and corners, the way kit-leftovers-overlays gathered the
overlays. It's a normal game-lane change with the design pass, and it has no flag.

## The changes
1. **The start panels' labels (#1208):** Hand palette (`x/hand-palette/index.tsx:122`) and Menu sounds A/B
   (`x/ui-sounds-ab/index.tsx:74`) set their labels in `var(--pa-font-mono, …)`. No `--pa-font-mono` exists, so they
   fall back to the system monospace. They use the kit's `MonoLabel` or `var(--pa-font-data)` (`app/layout.tsx:26`), at
   12 px or more.
2. **Rewind's key chips (#1209):** rewind's start panel draws ← → as `<kbd>` chips with `borderRadius: 4`
   (`rewind/index.tsx:19-28`). The start screen hides that panel today (`duo-start/StartScreen.tsx`, `hidden`; the keys
   are in the help overlay), so this keeps the panel on the kit for when it shows. They become square and match the help overlay's chip
   (`help-overlay/help-overlay.module.css:131-140`).
3. **/real-keys upright (#1210):** the title (`x/real-keys/real-keys.module.css:106-107`) drops `italic`, as the
   kit has it (`specs/context/visual-direction.md:90`).

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature |
|---|---|
| `web/src/game/x/hand-palette/index.tsx`, `hand-palette.test.ts` | hand-palette |
| `web/src/game/x/ui-sounds-ab/index.tsx`, `ab.test.ts` | ui-sound-family |
| `web/src/game/rewind/index.tsx`, a new `rewind.test.tsx` | rewind |
| `web/src/game/x/real-keys/real-keys.module.css` | real-keys |

When this spec was written, `web/src/game/x/real-keys/real-keys.module.css` was held by #1188 (lab-pages-a11y), which
makes the same title an h1 and keeps its italic. Do changes 1 and 2 first; switch to change 3 once #1188 frees it, and
rebase on main before editing it. No open PR held the other files.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080:
  - the start screens of `/play?song=fur-elise&x=hand-palette&p=A` and `/play?song=twinkle&x=ui-sounds-ab` (the Lab's
    hrefs);
  - Learn mode's start screen, where the rewind hint would sit (hidden today, so no shot of it);
  - /real-keys's rail. It needs a camera: shoot the state the page reaches without one, and say so.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
- **(a) #1208:** a grep of `web/src` finds no `--pa-font-mono`; a grep of the two panels finds no font size under
  12 px. Report the greps.
- **(b) #1209:** a `renderToStaticMarkup` test of rewind's start panel (Learn mode's params) finds no `border-radius`
  above 0.
- **(c) #1210:** a grep of `real-keys.module.css` finds no `italic`.
- **Unit tests:** `pnpm -C web exec vitest run src/game/x/hand-palette src/game/x/ui-sounds-ab src/game/rewind src/game/x/real-keys`.
- **(d) Shots and taste v2 scores** in the PR (Design pass above).
- Browser checks run in CI's suite; the done note says "not verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/kit-leftovers-small-*.md`.
- No new dependency and no new token. Copy and behavior stay as they are.
