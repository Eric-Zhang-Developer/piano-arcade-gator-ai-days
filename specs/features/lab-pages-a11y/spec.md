---
name: "Lab pages a11y: /real-keys, /conduct and /highlight get titles, announcements, focus and a lit Lab slot"
depends_on: ["experiments", "real-keys", "conductor", "highlight-reel", "nav-bar", "lab", "duo-tokens"]
owns: ["specs/features/lab-pages-a11y/", "changes/lab-pages-a11y.md", "specs/decisions/lab-pages-a11y-", "web/src/app/real-keys/layout.tsx"]
assignee: "eric"
---

# Lab pages a11y

Issues #1128, #1129, #1143 and #1130, from the polish refill. The experiment pages the Lab opens each miss one
accessibility or navigation basic. One PR, since they're one thing a person sees: the Lab's own pages. It's a normal
game-lane change with the design pass, and it has no flag.

## The changes
1. **/real-keys (#1128):**
   - the tab reads `Real Keys · Étude`, built from `APP_NAME` (`web/src/game/app-name`), through a new
     `web/src/app/real-keys/layout.tsx`, the way `/conduct` and `/highlight` name theirs (`app/conduct/page.tsx:6`);
   - the page has exactly one h1: today its name is a `<span className={css.title}>` (`RealKeys.tsx:613`);
   - a Lab link on the rail, hidden under `?capture=1`, like `/conduct`'s (`Conduct.tsx:279`). The nav bar stays
     hidden here (`nav-bar/slots.ts:24`), so this link is the way back;
   - the canvas corner labels use a font that resolves: `ctx.font` can't read `var(--pa-font-data)` (`:439`), so the
     assignment is ignored. Use `canvasFonts.data()` from `duo-tokens/canvas.ts`, at 12 px or more;
   - nothing on the page is under 12 px, the kit's floor (`duo-tokens/Kit.tsx:107`), including the label at
     `clamp(11px, …)` in `real-keys.module.css:71`.
2. **/conduct (#1129):**
   - the camera error line (`Conduct.tsx:284`) is `role="alert"`, as `/highlight`'s is (`Highlight.tsx:201`);
   - the hold / conduct / cut-off line (`data-testid="conduct-state"`, `:305`) is a polite status region whose text
     changes only when the state changes, not every frame;
   - the tracker's "Loading the hand tracker…" line (`:296`) is announced, and so is the tracker being ready.
   The look doesn't change.
3. **/highlight (#1143):**
   - pressing Render reel from the keyboard no longer drops focus to the page: today the button disables itself
     (`disabled={state !== "ready"}`, `:233`);
   - when the reel is done, focus moves to Save video;
   - a polite status region announces that the reel is ready (the "… MB WebM · … late frames" line, `:236-238`).
   The look doesn't change.
4. **The Lab slot (#1130):** `LAB_PAGES` (`nav-bar/slots.ts:32-36`) also takes the pathname of every
   `experiments[].href` (`web/src/game/x/index.ts`), so `/conduct`, `/highlight` and any later experiment page light
   Lab without an edit there.
   - **Bundle check:** `slots.ts` runs in the nav bar on every page, and `x/index.ts` imports every experiment's
     module. Before and after, compare the nav bar's client chunk (the dev server's network panel is enough). If the
     import pulls experiment code into every page, keep the hrefs in `slots.ts` as a list that `nav-bar.test.ts`
     pins against `experiments[].href` instead, and log the choice in `specs/decisions/lab-pages-a11y-nav.md`.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/app/real-keys/layout.tsx` | new, this spec |
| `web/src/game/x/real-keys/RealKeys.tsx`, `real-keys.module.css`, `real-keys.test.ts` | real-keys |
| `web/src/game/x/conductor/Conduct.tsx`, `conductor.test.ts` | conductor |
| `web/src/game/x/highlight-reel/Highlight.tsx`, `highlight.test.ts`, `verify-highlight.mjs` | experiments (`web/src/game/x/`) |
| `web/src/game/nav-bar/slots.ts`, `nav-bar.test.ts` | nav-bar |

`web/src/game/x/index.ts` is held by #1170 (speaking-piano) and #1166 (build-sonata). This spec reads it and doesn't
edit it. If an edit there turns out to be needed, switch once those PRs free it.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), at
  1280×720 and 1920×1080: `/real-keys` (rail with the Lab link and h1, the corner labels), `/conduct` and
  `/highlight` (each with the nav bar's Lab slot lit). `/real-keys` and `/conduct` need a camera: shoot the state the
  page reaches without one, and say so.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
The test setup has no DOM library and `web/package.json` is frozen: render with `renderToStaticMarkup` (as
`x/x.test.tsx` does) and keep any focus or announce logic in small pure functions the tests can call.

- **(a) /real-keys:**
  - its `metadata.title` equals `` `Real Keys · ${APP_NAME}` `` (a unit test imports the layout's metadata);
  - the page's markup has exactly one `<h1`;
  - the rail has a link to `/lab`, absent under `?capture=1`;
  - a grep of `RealKeys.tsx` finds no `var(` in a `ctx.font` string;
  - a grep of `real-keys.module.css` and `RealKeys.tsx` finds no font size under 12 px.
- **(b) /conduct:**
  - the error line renders with `role="alert"`;
  - the state line renders with `role="status"` (or `aria-live="polite"`);
  - a test drives the state through hold, conduct and cut-off and shows the region's text changes once per state
    change, not per frame;
  - the loading line sits in a polite region.
- **(c) /highlight:**
  - a status region renders and carries the done line once the reel is done;
  - the focus rule (Render keeps focus while it runs; Save video takes it when it appears) is a pure function or
    effect a test covers;
  - `verify-highlight.mjs` gains a check that, after a keyboard-started render, `document.activeElement` is Save
    video. It runs in CI's browser suite, not locally.
- **(d) The Lab slot:** `nav-bar.test.ts` asserts Lab is current on `/conduct` and `/highlight`, and on every
  `experiments[].href` pathname no other slot owns.
- **Unit tests:** `pnpm -C web exec vitest run src/game/x/real-keys src/game/x/conductor src/game/x/highlight-reel src/game/nav-bar src/game/x/x.test.tsx`.
- **(e) Shots and taste v2 scores** in the PR (Design pass above).
- The done note says "not verified locally; covered by main's scheduled full run" for the browser checks.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/lab-pages-a11y-*.md`.
- No new dependency. No visual change to `/conduct` or `/highlight` beyond the nav bar's lit slot.
