---
name: "Lab state and keys: experiments that outlive /play, swallow Enter and Space, or hang on a failed load"
depends_on: ["wrong-note-spike", "hand-palette", "screen-shake", "wet-paint", "wet-paint-polish", "pinned", "build-sonata"]
owns: ["specs/features/lab-state-keys/", "changes/lab-state-keys.md", "specs/decisions/lab-state-keys-"]
assignee: "eric"
---

# Lab state and keys

Issues #1323-#1330, from a post-merge bug review of the features merged on Oct 25. All are Lab experiments a judge
can open from `/lab`: state that leaks into the next page or take, keys swallowed page-wide, and two load paths that
end on a dead screen. One PR: the Lab as a judge clicks through it.

## The changes
1. **#1323 wrong-note:** the window keydown leaves Space and Enter alone when the target is a link, button or form
   control.
2. **#1324 hand-palette:** leaving /play by any route restores the colour settings and removes the filter and its
   interval (an unmount teardown, or a pathname guard like name-theme's `Guard.tsx`).
3. **#1325 hand-palette:** `songStart` re-applies the candidate after a Retry.
4. **#1326 screen-shake:** `draw` re-resolves its canvases when `ctx.canvas` changes (or `songStart` clears them).
5. **#1327 wet-paint:** the latest CC64 is tracked while framed and applied on Again.
6. **#1328 wet-paint:** Space is the pedal only when focus isn't on a button or link, and never while framed.
7. **#1329 pinned:** a failed chart load shows a visible error line (`role="alert"`).
8. **#1330 build-sonata:** the sonata chart prints (right hand kept to 4 voices in `make-sonata.mjs`, chart
   regenerated), or the Sheet music link is hidden for a chart that can't print; the sheet test covers `songs/x/*`
   and `songs/rounds/*`.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/app/wrong-note/page.tsx` | wrong-note-spike | free |
| `web/src/game/x/hand-palette/index.tsx`, `hand-palette.test.ts` | hand-palette | free |
| `web/src/app/play/page.tsx` (only if the teardown goes there) | judging-tiers | **#600** (draft): prefer the guard route, which doesn't touch it; else switch once #600 frees it |
| `web/src/game/x/index.ts` (only if needed) | experiments | **#1288** (record-follows): switch once #1288 frees it |
| `web/src/game/x/screen-shake/index.ts`, `screen-shake.test.ts` | experiments (`x/`) | free |
| `web/src/game/x/wet-paint/WetPaint.tsx`, `paint.ts`, `wet-paint.test.ts` | wet-paint | free |
| `web/src/game/x/pinned/Pinned.tsx`, `pinned.test.ts` | pinned | free |
| `web/src/game/x/build-sonata/make-sonata.mjs`, `build-sonata.test.ts`, `web/public/songs/x/build-sonata/chart.json` | build-sonata | free |
| `web/src/game/sheet-xml/sheet-xml.test.ts` | sheet-xml | free |
| `web/src/game/sheet-view/plugin.tsx` (only if hiding the link) | sheet-view | **#600**: prefer fixing the chart; else switch once #600 frees it |

## Design pass (AGENTS.md, Visible changes)
Only #1329's error line and #1330's sheet are new to the eye. Invoke `frontend-design`, then
`design-taste-frontend` (taste v2); shots of `/musicbox` with the chart blocked and of `/sheet?song=x/build-sonata`,
before and after, at 1280×720 and 1920×1080, from your own dev server in the in-app browser (one `devserver.N`
slot); score against `references/critique.md`, fix the top three, at most three rounds. The error line uses the
Duo kit's existing alert styles.

## Validation
- **(a)** Each issue's Done-when, each in a unit test:
  - #1323 keydown Enter with an `<a>` target: `defaultPrevented === false`, no `start()`.
  - #1324 apply B, run the leave path: `handColorSettings.colors` equals the snapshot, and no canvas keeps a filter.
  - #1325 `transformChart(p=B)` -> `songEnd` -> `songStart`: `colors.R === candidates.B.palette.R`; `draw` emits notches.
  - #1326 draw on fake canvas A, `songStart`, a milestone, draw on canvas B: B gets a non-empty `style.transform`.
  - #1327 cc 127 + note -> `frame()` -> cc 0 -> `again()`: pedal 0, Pedal cell Dry.
  - #1328 keyup Space with a `<button>` target isn't `defaultPrevented`.
  - #1329 `fetch` rejecting renders the alert line.
  - #1330 `chartToMusicXml` runs over every chart in `songs/x/*` and `songs/rounds/*` without throwing (or the
    test lists the ones that are allowed not to print and the link is hidden for them).
- **(b)** `pnpm -C web exec vitest run src/game/x src/game/sheet-xml` passes, plus the Checks in
  `specs/tech-stack.md`. Browser checks aren't run locally (AGENTS.md interim load rule).

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/lab-state-keys-*.md`.
- No new dependency, no new token, no change to `web/src/contracts/`.
