---
name: "Roll pages polish: /sonata upright with a quiet readout, /composers-hands stops clean and says when it's silent"
depends_on: ["build-sonata", "composers-hands", "experiments", "duo-tokens"]
owns: ["specs/features/roll-pages-polish/", "changes/roll-pages-polish.md", "specs/decisions/roll-pages-polish-"]
assignee: "eric"
---

# Roll pages polish

Issues #1204, #1205, #1206 and #1207, from a sweep of the experiments merged tonight. The Lab's two piano-roll pages
share a header and a layout: /sonata, the night as a roll, and /composers-hands, a composer's roll on the DGX. /sonata
is still italic and re-reads its links on every step; /composers-hands can leave notes and the pedal down when it
stops, and doesn't say when it will be silent. One PR, since they're one thing a person sees: the Lab's roll pages.
It's a normal game-lane change with the design pass, and it has no flag.

## The changes
1. **/sonata upright (#1204):** no `font-style: italic` in `build-sonata/sonata.module.css` (the wordmark `:29`, the
   count `:66`, the caption `:78`). The kit is upright (`specs/context/visual-direction.md:90`), and italic isn't
   loaded (`app/layout.tsx:13-14`).
2. **/sonata's readout (#1205),** in `SonataPage.tsx`:
   - the live region (`:136`) holds only the selected PR's lines; the action links (`:146-156`) move outside it, so an
     arrow step no longer re-reads them;
   - the roll (`:166-175`), focusable and stepped with the arrow keys, gets a role that says so (for example
     `role="slider"` with `aria-valuetext` naming the PR), or keeps `img` with the arrow-key hint in its label. Log the
     choice in `specs/decisions/roll-pages-polish-roll-role.md`.
3. **/composers-hands stops clean (#1206),** in `ComposersHands.tsx`: every stop (the button, the finish, unmount and
   a new `pagehide` handler):
   - clears the output's queue where it supports it;
   - sends All Notes Off now and again after `AHEAD_MS` (`:30`): today it sends it once, now (`:223`), while note-ons
     are queued up to 150 ms ahead (`:168-169`);
   - sends CC64 0: Listen plays the roll's pedal (`:165`, `rolls.ts:65`) and nothing lifts it today.
   `/conduct` does the same (`conductor/session.ts:65-68`).
4. **/composers-hands's status (#1207):** the status line (`:362`, "No piano output: the highway plays silent") sits in
   a polite status region. The look doesn't change.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/game/x/build-sonata/SonataPage.tsx`, `sonata.module.css`, `build-sonata.test.ts` | build-sonata |
| `web/src/game/x/composers-hands/ComposersHands.tsx`, `composers-hands.test.ts` | composers-hands |

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080 (plus reduced motion for /sonata, whose panels rise in):
  - /sonata with a PR selected;
  - /composers-hands with the test roll (`?roll=chart`), at rest and with the "No piano output" status.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
The test setup has no DOM library and `web/package.json` is frozen: render with `renderToStaticMarkup` and keep the
stop's messages in a small pure function a test can call.

- **(a) #1204:** a grep of `sonata.module.css` finds no `italic`. Report the grep.
- **(b) #1205:** a `renderToStaticMarkup` test finds the live region without the three action links inside it, and
  the roll's role as logged.
- **(c) #1206:** a test with a fake output records a stop's messages and finds the queue cleared (when the fake has
  `clear()`), All Notes Off at now and at now + `AHEAD_MS`, and CC64 0.
- **(d) #1207:** a `renderToStaticMarkup` test finds the status line inside a status region.
- **Unit tests:** `pnpm -C web exec vitest run src/game/x/build-sonata src/game/x/composers-hands`.
- **(e) Shots and taste v2 scores** in the PR (Design pass above).
- Browser checks run in CI's suite; the done note says "not verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/roll-pages-polish-*.md`.
- No new dependency and no new token. The sonata's notes, the rolls and the scheduler's timing stay as they are.
