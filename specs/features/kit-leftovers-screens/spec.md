---
name: "Kit leftovers on whole screens: the chunk panel, the phone guard and the crash screen on the Duo kit"
depends_on: ["duo-tokens", "chunk-practice", "adaptive-chunks", "phone-guard", "crash-guard"]
owns: ["specs/features/kit-leftovers-screens/", "changes/kit-leftovers-screens.md", "specs/decisions/kit-leftovers-screens-"]
assignee: "eric"
---

# Kit leftovers on whole screens

Issues #1133, #1134 and #1136, from the polish refill. Three panels a player can land on still wear the old look:
rounded corners, italic type and a hype-pink glow. The kit is zero radius and upright (`duo-tokens/Kit.tsx`,
`specs/features/duo-tokens/spec.md`), `specs/context/visual-direction.md:89-90` says "No italic", italic isn't loaded
(`app/layout.tsx:13-14`), and hype pink is kept for the five moments (`pause-skin.module.css:2`, #783). The 404 page
moved onto the kit the same way (#891). One PR, since they're one thing a person sees: the panels that replace the
game. It's a normal game-lane change with the design pass, and it has no flag.

## The changes
1. **The chunk-practice panel (#1133),** the featured slot after every PRACTICE take
   (`results-layout/index.tsx:24`), outside the results action row, so it keeps its own shapes today
   (`chunk-practice/chunk-practice.module.css`):
   - Next chunk, Again and Slower (`.next`, `.ghost`, `:108-121`) become the kit's buttons: `kitButton("primary")`
     for the way on, `kitButton("secondary")` for the others, zero radius, upright type;
   - the pips (`:23`) and the meter (`:80`, `:88`) get square corners;
   - the current pip is `--pa-primary`, with no pink glow (`:35`);
   - the verdict line is upright (`:59`).
2. **The phone guard (#1134),** the card a phone or narrow window gets instead of the game
   (`phone-guard/phone-guard.module.css`):
   - the card is the kit's panel: zero radius (`:22`), a hairline instead of the pink ring and glow (`:24`);
   - the wordmark is upright (`:33`).
3. **The crash screen (#1136),** what `GameBoundary` shows when the game throws (`crash-guard/crash-guard.module.css`,
   `boundary.tsx`):
   - the card and buttons use the kit's `Panel` and `Button` from `duo-tokens`, zero radius (`:21`, `:47`);
   - the title and buttons are upright (`:28`, `:48`);
   - no pink radial glow (`:11`);
   - the copy and both actions are unchanged.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/game/chunk-practice/chunk-practice.module.css`, `index.tsx`, `chunk-practice.test.ts` | chunk-practice, adaptive-chunks |
| `web/src/game/phone-guard/phone-guard.module.css`, `index.tsx`, `phone-guard.test.ts` | phone-guard |
| `web/src/game/crash-guard/crash-guard.module.css`, `boundary.tsx`, `crash-guard.test.ts` | crash-guard |

`web/src/game/results-layout/` is held by #600. This spec doesn't need it: the panel's look lives in its own files.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after:
  - the chunk panel after a pass and after a fail, at 1280×720 and 1920×1080 (`chunk-practice/verify-chunks.mjs`
    shows how it reaches each);
  - the phone guard at 375×812, plus 1280×720 and 1920×1080 showing it stays hidden;
  - the crash screen at 1280×720 and 1920×1080, forced the way `crash-guard/verify-crash.mjs` forces it
    (`/?crash=render` and `/play?crash=render`).
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
- **(a) No old look left:** a grep of the three CSS files finds no `italic`, no `border-radius` above 0, and no
  `255 47 208` / `255, 47, 208`. Report the grep.
- **(b) The chunk panel:** a `renderToStaticMarkup` test shows the way-on button carries `kitButton("primary")`'s
  class and the others `kitButton("secondary")`'s; `chunk-practice.test.ts` stays green.
- **(c) The crash screen:** a test renders the fallback and finds the kit's `Panel` and `Button`, the same copy and
  both actions; `crash-guard.test.ts` stays green.
- **(d) The phone guard:** `phone-guard.test.ts` stays green; it still shows at 375×812 and stays hidden at desktop
  sizes (the shots).
- **Unit tests:** `pnpm -C web exec vitest run src/game/chunk-practice src/game/phone-guard src/game/crash-guard`.
- **(e) Shots and taste v2 scores** in the PR (Design pass above).
- `verify-chunks.mjs`, `verify-phone.mjs` and `verify-crash.mjs` run in CI's browser suite; the done note says "not
  verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/kit-leftovers-screens-*.md`.
- No new dependency and no new token. Copy and behavior stay as they are.
