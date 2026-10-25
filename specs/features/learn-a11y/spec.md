---
name: "Learn a11y: /learn has its h1 and says it's planning, take buttons keep focus, verdicts are heard, chips read titles"
depends_on: ["learning-ui", "learn-titles"]
owns: ["specs/features/learn-a11y/", "changes/learn-a11y.md", "specs/decisions/learn-a11y-", "web/src/learn/frontend/graph/MasteryGraphHome.tsx", "web/src/learn/frontend/graph/graph.module.css", "web/src/learn/frontend/playing/NoPassage.tsx", "web/src/learn/frontend/playing/PlayThroughWorkspace.tsx", "web/src/learn/frontend/playing/NodePractice.tsx", "web/src/learn/frontend/playing/PracticeWorkspace.tsx", "web/src/learn/frontend/playing/PlayCheck.tsx", "web/src/learn/frontend/playing/TakeParts.tsx", "web/src/learn/frontend/encoding/EncodingSandbox.tsx", "web/src/learn/frontend/learn-a11y.test.tsx", "web/src/learn/frontend/graph/song-titles.ts"]
assignee: "eric"
---

# Learn a11y

Issues #1273 to #1278, from the learning lane (gray area: no person set, so `assignee: "eric"`, as learn-titles
did). Six places where /learn works with a mouse and eyes but not with a keyboard or a screen reader. One PR, since
it's one thing a person sees: the path from the map into a take and back. Markup only; no new copy beyond one status
line and one heading.

## The changes
1. **One h1 (#1273).** /learn's map has none (`graph/MasteryGraphHome.tsx:98-122`; "Goal songs" is an h2 at
   `:122`), and "Nothing to play" is an h2 (`playing/NoPassage.tsx:9`). Each gets exactly one h1. On the map it may
   be visually hidden ("Your map" is the region's existing label, `:98`).
2. **Say it's planning (#1274).** While `next` is null (`MasteryGraphHome.tsx:117`), up to `nextPatience` (8 s,
   `:26`) after load and after each goal-chip toggle, a visible line in a `role="status"` region says the next step
   is being planned. It goes when the companion shows.
3. **Focus stays on the buttons (#1275).** After "See an example take", "Stop example" and a take's end
   (`playing/PlayThroughWorkspace.tsx:51-53`), Start / Stop (`playing/NodePractice.tsx:81`) and "Hear the opening"
   (`playing/PracticeWorkspace.tsx:55`), focus lands on a control in the same `.actions` group, not `<body>`. Prefer
   keeping one button mounted and changing its label over moving focus by hand.
4. **Verdicts heard (#1276).** "Passed", "Not yet", "Clean take" (`playing/PlayCheck.tsx:39`, `NodePractice.tsx:68`)
   and the off-list (`playing/TakeParts.tsx:20`) sit in an `aria-live="polite"` container that's mounted before the
   take starts.
5. **Chips read titles (#1277).** The goal-song chips render `{song.songId}` (`MasteryGraphHome.tsx:127`). They
   show and announce each song's `title` from its chart (`web/public/songs/<id>/chart.json`). No titles typed by
   hand: an id with no chart keeps its slug, and the PR lists any.
6. **Tabs point at real panels (#1278).** `encoding/EncodingSandbox.tsx:154` sets `aria-controls` on all three tabs;
   only the selected panel renders (`:162`). Every `aria-controls` points at an element in the page.

## Files
These files belong to learning-ui (done, no lane), so this spec owns them, as learn-titles did. Check again before
each edit (`gh pr list --state open`, then each PR's files), and avoid every file in seeko-codes' open PRs
(`gh pr list --state open --author seeko-codes`). When this spec was written seeko-codes had no open PR, but merged
five learning-ui fixes today: if one opens on any file above, switch once it frees it.

| File | Owner |
|---|---|
| `web/src/learn/frontend/graph/MasteryGraphHome.tsx`, `graph.module.css` | learning-ui (done; no lane), owned here |
| `web/src/learn/frontend/playing/NoPassage.tsx`, `PlayThroughWorkspace.tsx`, `NodePractice.tsx`, `PracticeWorkspace.tsx`, `PlayCheck.tsx`, `TakeParts.tsx` | same |
| `web/src/learn/frontend/encoding/EncodingSandbox.tsx` | same |
| `web/src/learn/frontend/learn-a11y.test.tsx`, `graph/song-titles.ts` (the chart-title lookup, if it needs its own file) | new, here |

The chart-title lookup reads `web/public/songs/`; it doesn't change any chart. learn-kit (#947, #1279–#1281) edits
other files on the same pages; the two PRs don't share a file.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080: /learn while the next step plans (the status line), /learn with the goal chips,
  and /learn/play-through with focus on the actions after "See an example take".
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
- **(a) #1273:** a render test finds exactly one `<h1` in /learn's map and in NoPassage.
- **(b) #1274:** a render test with `next` null finds a `role="status"` element with text.
- **(c) #1275:** in the browser, `document.activeElement` after each listed click (and a take's end) is a button or
  link inside `.actions`; list each in the PR.
- **(d) #1276:** a render test finds the verdict and the off-list inside one `aria-live="polite"` element, present
  before and after the take.
- **(e) #1277:** a render test finds no chip whose text equals its `songId` for songs with a chart.
- **(f) #1278:** a render test finds every tab's `aria-controls` id in the rendered markup.
- **Unit tests:** `pnpm -C web exec vitest run src/learn/frontend` (the existing graph, playing and encoding tests
  stay green).
- **(g) Shots and taste v2 scores** in the PR (Design pass above). The learning lane's own browser checks
  (`encoding/verify-encoding.mjs`) run in CI; the done note says "not verified locally; covered by main's scheduled
  full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/learn-a11y-*.md`.
- No new dependency. No change to `/learn/api/next` or to how the next step is planned.
