---
name: "Wet paint polish: /paint names its tab, clears the LED strip, and hands focus to the framed painting"
depends_on: ["wet-paint", "experiments", "led-game", "duo-tokens"]
owns: ["specs/features/wet-paint-polish/", "changes/wet-paint-polish.md", "specs/decisions/wet-paint-polish-", "web/src/app/paint/layout.tsx"]
assignee: "eric"
---

# Wet paint polish

Issues #1195, #1196 and #1197, from a sweep of the experiments merged tonight. /paint, the free-play painting the Lab
opens, misses a tab title, leaves keys lit on the LED strip, and gives a keyboard or screen-reader player no sign that
the painting is framed. One PR, since they're one thing a person sees: the /paint page. It's a normal game-lane change
with the design pass, and it has no flag.

## The changes
1. **The tab title (#1195):** a new `web/src/app/paint/layout.tsx` sets `metadata.title` to
   `` `Wet Paint · ${APP_NAME}` ``, the way `/simon` names its client page (`app/simon/layout.tsx:4-5`, #953).
   Today `app/paint/page.tsx:1-6` is a client page with no title.
2. **The LED strip (#1196),** in `WetPaint.tsx`:
   - framing sends a key-off (or `CLEAR`) for each held key and clears the on-screen keys. Today `play()` returns early
     once framed (`:92`), so the key-offs at `:104` never go out;
   - Again, unmount and `pagehide` send `CLEAR` when the strip is connected. The page uses `connect()` (`:298`), and
     only `autoConnect()` registers a `pagehide` CLEAR (`leds/serial.ts:112-119`), so nothing clears it today.
     `leds/` stays as it is: the clearing lives in this page.
3. **The framed painting (#1197):**
   - when the painting is framed, focus moves to Save PNG, and the dialog (`:321`) has `aria-modal="true"`;
   - Again puts focus back on the page;
   - a polite status region announces the frame (the caption line is enough), including the auto-frame after a
     minute (`:157`);
   - the piano status line (`:305-308`) is announced.
   The look doesn't change.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/app/paint/layout.tsx` | new, this spec |
| `web/src/game/x/wet-paint/WetPaint.tsx`, `wet-paint.test.ts` | wet-paint |

`web/src/game/leds/` (led-game) is read, not edited.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080: /paint at rest, and the framed painting with Save PNG focused (`window.__wetPaint`
  plays notes and frames, `WetPaint.tsx:228-256`).
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
The test setup has no DOM library and `web/package.json` is frozen: render with `renderToStaticMarkup` (as
`x/x.test.tsx` does) and keep any focus, announce or clearing logic in small pure functions the tests can call.

- **(a) #1195:** a unit test imports the layout's metadata and finds `` `Wet Paint · ${APP_NAME}` ``.
- **(b) #1196:**
  - a test drives note-on, then Frame it, and finds the messages sent include a key-off for that key or `CLEAR`;
  - Again, unmount and `pagehide` each send `CLEAR` when the strip is connected (a test of the pure part).
- **(c) #1197:**
  - the focus rule (Save PNG takes focus when framed; Again gives it back) is a pure function a test covers;
  - a `renderToStaticMarkup` test finds the dialog's `aria-modal="true"` and a polite status region.
- **Unit tests:** `pnpm -C web exec vitest run src/game/x/wet-paint src/game/x/x.test.tsx`.
- **(d) Shots and taste v2 scores** in the PR (Design pass above).
- Browser checks run in CI's suite; the done note says "not verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/wet-paint-polish-*.md`.
- No new dependency and no new token. The painting, its rules and its colors stay as they are.
