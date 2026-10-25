---
name: "Select a11y: an arrow step reads the song, not the panel; Song N of M is heard; GitHub says it opens a tab"
depends_on: ["duo-select", "main-page", "song-finder", "nav-bar", "select-motion"]
owns: ["specs/features/select-a11y/", "changes/select-a11y.md", "specs/decisions/select-a11y-"]
assignee: "eric"
---

# Select a11y

Issues #1236, #1237 and #1238, from polish sweep 3 on the demo path. The select is the video's 0:12 shot and the
first screen a judge sees (`specs/features/video-shots/shot-list.md` row 4). It looks right, but a screen reader hears
too much on every arrow step, never hears where it is in the list, and isn't told the nav's GitHub link leaves the
tab. One PR, since they're one thing a person sees: the select and the nav over it. It's a normal game-lane change
with the design pass, and it has no flag. Nothing should look different.

select-motion (#1212) changes `Select.tsx` and `Sections.tsx` too, so this spec depends on it.

## The changes
1. **An arrow step reads the song (#1236):** the `aria-live="polite"` on the focused panel's `<section>`
   (`duo-select/Select.tsx:43`) goes. A small polite region (or an sr-only status line) says the focused song's
   title, composer and level. The buttons (`:71-89`) and the preview options in `children` (`:90`) are outside any
   live region. Find's own count (`song-finder/Finder.tsx:94`) stays as it is.
2. **Song N of M (#1237):** the counter's `aria-label` on a plain `<span>` (`main-page/Sections.tsx:52`) is never
   read. The visible `N / M` becomes `aria-hidden`, with an sr-only "Song N of M" beside it (or the counter gets a
   role that takes a name). Log which in `specs/decisions/select-a11y-place.md`.
3. **GitHub says it opens a tab (#1238):** the nav's GitHub link (`nav-bar/NavLinks.tsx:29-31`) gets the accessible
   name "GitHub (opens in a new tab)", with the arrow `aria-hidden`. The visible "GitHub ↗" stays.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/duo-select/Select.tsx` | duo-select | free; select-motion's PR will change it: switch to the next ready feature until that PR merges or closes |
| `web/src/game/main-page/Sections.tsx`, `main-page.test.ts` | main-page | free; same as above |
| `web/src/game/nav-bar/NavLinks.tsx`, `nav-bar.test.ts` | nav-bar | free (`slots.ts` is held by #1213 and isn't needed) |

A new `web/src/game/duo-select/select-a11y.test.tsx` (or a test beside each file) is fine.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, of `/` at 1280×720 and 1920×1080: the look shouldn't change, and the shots show it didn't.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
The test setup has no DOM library and `web/package.json` is frozen: render with `renderToStaticMarkup`.

- **(a) #1236:** a test renders `FocusPanel` and finds no `aria-live` ancestor around `select-play`, and one polite
  region whose text is the title, composer and level.
- **(b) #1237:** a test renders the strip and finds "Song N of M" as text, with the visible counter `aria-hidden`.
- **(c) #1238:** a test renders `NavLinks` and finds the GitHub link named "GitHub (opens in a new tab)".
- **Unit tests:** `pnpm -C web exec vitest run src/game/duo-select src/game/main-page src/game/nav-bar`.
- **(d) Shots and taste v2 scores** in the PR (Design pass above).
- `verify-select.mjs`, `verify-main.mjs` and `verify-nav.mjs` run in CI's browser suite; the done note says "not
  verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/select-a11y-*.md`.
- No new dependency and no new token. The look, the keys and the copy stay as they are.
