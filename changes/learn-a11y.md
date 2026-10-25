## What shipped
- /learn's map has one h1 (visually hidden, "Your map"). "Nothing to play" is its page's h1, in the stage header.
- While Next plans, a `role="status"` line says "Planning your next step…".
- Focus stays in the take's actions after Start, Stop, the example and hear buttons, and at a take's end.
- The verdicts and the off-list sit in one polite live region.
- The goal chips read their charts' titles.
- Only the selected encoding tab names a panel.
## Where it lives
- `web/src/learn/frontend/graph/` (`MasteryGraphHome.tsx`, `graph.module.css`, `song-titles.ts`)
- `web/src/learn/frontend/playing/` (`TakeParts.tsx` `useKeepFocus`, `NoPassage`, `NodePractice`, `PlayCheck`, `PlayThroughWorkspace`, `PracticeWorkspace`)
- `encoding/EncodingSandbox.tsx`
- `learn-a11y.test.tsx`
## How to check it
- `pnpm -C web exec vitest run src/learn/frontend`: 257 pass.
- Focus was checked in the in-app browser (list in the PR).
- `encoding/verify-encoding.mjs`: not verified locally; covered by main's scheduled full run.
## Gaps
- A take's end on node practice and the play check needs a piano, so focus there is untested.
- The end of "Hear it" wasn't observed after the last hook fix: the hidden pane's listen never finished.
- `song-titles.ts` is a copy of the charts' titles, held to them by a test; regenerate it when a chart's title changes.
