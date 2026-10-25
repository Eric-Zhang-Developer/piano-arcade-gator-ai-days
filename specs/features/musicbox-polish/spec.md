---
name: "Music box polish: /musicbox names its tab, closes its audio, and its toggles say one thing"
depends_on: ["pinned", "experiments", "duo-tokens"]
owns: ["specs/features/musicbox-polish/", "changes/musicbox-polish.md", "specs/decisions/musicbox-polish-", "web/src/app/musicbox/layout.tsx"]
assignee: "eric"
---

# Music box polish

Issues #1198, #1199 and #1200, from a sweep of the experiments merged tonight. /musicbox, where Pinned turns a take
into a brass cylinder, misses a tab title, leaves an AudioContext open on every crank, and its two toggles speak
twice. One PR, since they're one thing a person sees: the /musicbox page. It's a normal game-lane change with the
design pass, and it has no flag.

## The changes
1. **The tab title (#1198):** a new `web/src/app/musicbox/layout.tsx` sets `metadata.title` to
   `` `Pinned · ${APP_NAME}` ``, the experiment's title (`x/pinned/index.tsx:10`), the way `/simon` names its client
   page (`app/simon/layout.tsx:4-5`). Today `app/musicbox/page.tsx:1-7` has no title.
2. **The crank's audio (#1199),** in `Pinned.tsx`: Stop (`:74-79`), the natural end (`:55-57`) and unmount (`:72`)
   close the crank's AudioContext, or one context is made once and reused. Today each crank makes a new one (`:85`)
   and none is closed.
3. **The toggles and the label (#1200):**
   - Turn the crank and Macro (`:150-155`) each keep a fixed label with `aria-pressed`, or change their label with no
     `aria-pressed`. Today they do both ("Stop", pressed; "Wide", pressed). Pick one rule for both buttons;
   - the rail's mono label (`pinned.module.css:126-128`, `clamp(11px, …)`) is 12 px or more, the kit's floor
     (`duo-tokens/Kit.tsx:107`).

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/app/musicbox/layout.tsx` | new, this spec |
| `web/src/game/x/pinned/Pinned.tsx`, `pinned.module.css`, `pinned.test.ts` | pinned |

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080: /musicbox at rest (the scripted take, with its mono label) and while cranking.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
The test setup has no DOM library and `web/package.json` is frozen: render with `renderToStaticMarkup` and keep the
audio lifecycle in a small function a test can drive with a fake AudioContext.

- **(a) #1198:** a unit test imports the layout's metadata and finds `` `Pinned · ${APP_NAME}` ``.
- **(b) #1199:** a test with a fake AudioContext cranks, stops, cranks again, and finds no more than one context left
  open.
- **(c) #1200:**
  - a `renderToStaticMarkup` test renders both buttons in both states and checks the chosen rule;
  - a grep of `pinned.module.css` and `Pinned.tsx` finds no font size under 12 px.
- **Unit tests:** `pnpm -C web exec vitest run src/game/x/pinned`.
- **(d) Shots and taste v2 scores** in the PR (Design pass above).
- Browser checks run in CI's suite; the done note says "not verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/musicbox-polish-*.md`.
- No new dependency and no new token. The cylinder, the comb voice and the STL stay as they are.
