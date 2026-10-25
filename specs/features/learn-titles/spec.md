---
name: "Learn titles: each /learn page names its own tab, in the form <page> · Learn · Étude"
depends_on: ["learning-ui"]
owns: ["specs/features/learn-titles/", "changes/learn-titles.md", "specs/decisions/learn-titles-", "web/src/app/learn/layout.tsx", "web/src/app/learn/brand-preview/page.tsx", "web/src/app/learn/play-through/page.tsx", "web/src/app/learn/practice/page.tsx", "web/src/app/learn/review/theory/page.tsx", "web/src/app/learn/understand/page.tsx", "web/src/app/learn/learn-titles.test.ts"]
assignee: "eric"
---

# Learn titles

Issue #1141, from the polish refill. Every `/learn` tab reads "Learning room | Piano Arcade", from the one title in
`web/src/app/learn/layout.tsx:3`; no page under it sets its own. The game pages name themselves from `APP_NAME`
(`web/src/game/app-name/index.ts`, for example `app/lab/page.tsx:5`). #670 asks for the rename in `/learn`; this is
the per-page half, and it does the name in the titles too.

**Lane.** `/learn` is the learning lane, which has no person yet (AGENTS.md, Lanes); #1141 says to spec it with
`assignee: "eric"`. learning-ui has no assignee, so the lane rule can't open its files to this PR: this spec owns the
six files it edits and one new test, listed in `owns`. `fix(learning-ui)` PRs still pass on learning-ui's own `owns`.

## The change
- The layout's title becomes Next's title object, from `APP_NAME`: a `default` of `` `Learn · ${APP_NAME}` `` (the
  fallback, which `/learn` itself and any page without its own title show) and a `template` of
  `` `%s · Learn · ${APP_NAME}` ``. Its description stays.
- Each rendering page exports `metadata` with its own short name: `brand-preview`, `play-through`, `practice`,
  `review/theory` and `understand`. Take each name from the page's own on-screen heading (its component under
  `web/src/learn/frontend/`), not from here, and list the pairs in the PR.
- `explore/page.tsx` and `review/page.tsx` only redirect to `/learn`, so they need no title.
- No page under `web/src/app/learn/` keeps "Piano Arcade" in its metadata.

## Files
| File | Owner |
|---|---|
| `web/src/app/learn/layout.tsx` and the five `page.tsx` above | learning-ui (done; no lane), owned here |

Check again before each edit (`gh pr list --state open`, then each PR's files), and avoid every file in seeko-codes'
open PRs (`gh pr list --author seeko-codes`). When this spec was written:
- **`web/src/app/learn/practice/page.tsx`:** held by #1147 (seeko-codes, practice and a cold play check record
  attempts), which also adds `web/src/app/learn/check/page.tsx`. Switch once #1147 frees it; until then, the
  layout's fallback covers both pages. If #1147 is still open when the rest is done, ship without it, say so in the
  done note's Gaps, and tell the planner.
- **`web/src/learn/frontend/graph/`:** held by #1120 (seeko-codes). Read-only here; nothing in `web/src/learn/` is
  edited.

## Validation
- **(a) Titles:** a unit test, `web/src/app/learn/learn-titles.test.ts` (tests already sit beside routes there), imports each page's `metadata` and the layout's, and checks:
  - the layout's `template` is `` `%s · Learn · ${APP_NAME}` `` and its `default` is `` `Learn · ${APP_NAME}` ``;
  - each of the five rendering pages (four if #1147 still holds practice) has a non-empty `title`.
- **(b) No old name:** `grep -rn "Piano Arcade" web/src/app/learn/` prints nothing.
- **(c) In the browser:** on your own dev server, each page's `document.title` reads `<page> · Learn · Étude`, and
  `/learn` reads `Learn · Étude`. List them in the PR.
- **Unit tests:** `pnpm -C web exec vitest run src/app/learn/learn-titles.test.ts`.
- **Design pass:** none. Only the tab's title changes; no page's layout, style or pixels do. The PR's Design section
  says so.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/learn-titles-*.md`.
- No copy on the pages changes, and no rename beyond the titles (#670 keeps the rest).
