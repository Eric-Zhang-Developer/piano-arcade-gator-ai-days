---
name: "Results polish: PRACTICE BARS is a link, Watch replay is a dialog on the kit, NEW RECORD's initials are heard"
depends_on: ["duo-results", "replay-view", "record-moment", "help-overlay", "duo-tokens"]
owns: ["specs/features/results-polish/", "changes/results-polish.md", "specs/decisions/results-polish-"]
assignee: "eric"
---

# Results polish

Issues #1244, #1245, #1246 and #1247, from polish sweep 3 on the demo path. The results are the video's ~0:30 and
~0:35 shots (`specs/features/video-shots/shot-list.md` rows 7 and 8): the tutor's line with its primary, then Watch
replay. The primary is a button pretending to be a link, the replay overlay lets focus wander behind it and has a
small caption off the kit, and typing initials after a NEW RECORD is silent to a screen reader. One PR, since
they're one thing a person sees: the results and what opens from them. It's a normal game-lane change with the design
pass, and it has no flag.

## The changes
1. **PRACTICE BARS X–Y is a link (#1244):** the tutor's primary (`duo-results/index.tsx:214`) is a `<button>` that
   calls `window.location.assign(href)`. It becomes an `<a href>` with `kitButton("primary")` (`duo-tokens/Kit.tsx:79`),
   as the select's "next for you" strip is (`duo-select/Select.tsx:61`). It keeps `data-testid="duo-practice"`, its
   label and its URL, so results-layout's sizing (`results-layout.module.css:196`) still applies.
2. **Watch replay is a dialog (#1245):** the overlay (`replay-view/overlay.tsx:122`) is a plain fixed `<div>`, so
   focus stays on Watch replay behind it and Tab walks the results under the black screen. It becomes a modal dialog
   with an accessible name: a native `<dialog>` with `showModal()`, as the Controls card is
   (`help-overlay/index.tsx:46`), or `role="dialog"` with `aria-modal` and the page inert. Stop has focus when it
   opens; focus goes back to Watch replay when it closes (Stop, Esc or the end). Esc still closes it (`:106-112`).
   Log the choice in `specs/decisions/results-polish-replay-dialog.md`.
3. **The replay's caption on the kit (#1246):** the caption (`overlay.tsx:124-126`) is a fixed 16 px in
   `rgba(255,255,255,0.8)` and the system face, and ends with "· Esc to stop". It becomes the kit's `MonoLabel`, at
   least 16 px at 1280×720 and 24 px at 1920×1080, with no key hint (mouse-first, #772; the ? card already lists Esc
   for the replay, `help-overlay/keys.ts:109`). Stop gets `title="Stop (Esc)"` and `aria-keyshortcuts="Escape"`, as
   the select's buttons do (`duo-select/Select.tsx:73`). The copy otherwise stays.
4. **NEW RECORD's initials are heard (#1247):** typing initials changes only the cells' `aria-label`
   (`record-moment/index.tsx:28`), which isn't live, and the saved line (`:23-25`) isn't announced. One polite live
   region carries the letters so far and then the saved or couldn't-be-saved line. The look doesn't change.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/game/duo-results/index.tsx`, `scores.test.ts` (or a new test beside it) | duo-results |
| `web/src/game/replay-view/overlay.tsx`, `replay-view.test.ts`, `verify-replay.mjs` | replay-view |
| `web/src/game/record-moment/index.tsx`, `record-moment.test.ts` | record-moment |

`web/src/game/results-layout/` and `web/src/game/replay-view/index.ts` are held by #600. This spec doesn't need them.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080:
  - the results after `/play?song=twinkle&bot=rank-a&input=test` (a weak run, so PRACTICE BARS shows);
  - Watch replay open from Details on the same take;
  - NEW RECORD's entry (`record-moment/verify-moment.mjs` shows how it reaches it), plus reduced motion.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
The test setup has no DOM library and `web/package.json` is frozen: render with `renderToStaticMarkup`.

- **(a) #1244:** a test renders `Tutor` and finds an `a[href]` with the practice URL, `data-testid="duo-practice"`
  and the kit's primary class. `verify-results.mjs` still clicks it and lands on the practice URL.
- **(b) #1245:** a test renders the overlay and finds a dialog with a name. `verify-replay.mjs` (or a new step) shows
  Stop focused on open and Watch replay focused after Esc.
- **(c) #1246:** a test finds no "Esc" in the caption and `aria-keyshortcuts="Escape"` on Stop; the caption's
  computed size is at least 16 px at 1280×720 and 24 px at 1920×1080 (read in the in-app browser, listed in the PR).
- **(d) #1247:** a test renders the entry and the saved line and finds each inside one polite live region.
- **Unit tests:** `pnpm -C web exec vitest run src/game/duo-results src/game/replay-view src/game/record-moment`.
- **(e) Shots and taste v2 scores** in the PR (Design pass above).
- `verify-results.mjs`, `verify-replay.mjs` and `verify-moment.mjs` run in CI's browser suite; the done note says
  "not verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/results-polish-*.md`.
- No new dependency and no new token. The replay's clock, the tutor's line and the initials' keys stay as they are.
