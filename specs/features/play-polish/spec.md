---
name: "Play polish: the start screen's ladder and buttons read on video, the toast's ring leaves the old cyan"
depends_on: ["duo-start", "play-modes", "notice-toast", "kit-leftovers-overlays", "duo-tokens"]
owns: ["specs/features/play-polish/", "changes/play-polish.md", "specs/decisions/play-polish-"]
assignee: "eric"
---

# Play polish

Issues #1239 and #1240, from polish sweep 3 on the demo path. /play's start screen sits beside the stage card in the
video's 0:16 shot (`specs/features/video-shots/shot-list.md` row 5), and its ladder and buttons stay small at every
size. The notice toast over a take still has a ring in the retired cyan. One PR, since they're one thing a person
sees: /play before and during the take, outside the canvas. It's a normal game-lane change with the design pass, and
it has no flag.

## The changes
1. **The start screen reads on video (#1239).** `specs/context/visual-direction.md` asks for at least 16 px at
   1280×720 and 24 px at 1920×1080 for anything the viewer reads. Today, at 1280 and 1920:
   - the LEARN → FLOW → PERFORM ladder, `play-modes/ladder.module.css:13`: 12 px and 16 px. The select's copy of the
     same ladder (`.mark .rung`, `:72`) is already `clamp(16px, 1.25vw, 24px)` (#1060, for #1033);
   - the mode buttons, `duo-start/start.module.css:75`: 12 px and 16 px;
   - the mode's caption, `:83`: 13 px and 17 px;
   - Songs and Options, `:104`: 12 px and 17 px.
   Each goes to at least 16 px at 1280 and 24 px at 1920, and the start screen still fits both sizes with no scroll.
   If a row no longer fits, log what gave way in `specs/decisions/play-polish-start-type.md`.
2. **The toast's ring (#1240):** `.pa-toast`'s `box-shadow: 0 0 0 1px rgba(39, 225, 255, 0.18)`
   (`notice-toast/index.ts:74`) is the retired cyan as a literal; kit-leftovers-overlays left it
   (`changes/kit-leftovers-overlays.md`, Gaps). It becomes the kit's hairline, `var(--pa-line)`. The accent bar, size
   and timing stay.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/game/play-modes/ladder.module.css`, `play-modes.test.ts` | play-modes |
| `web/src/game/duo-start/start.module.css`, `start.test.tsx` | duo-start |
| `web/src/game/notice-toast/index.ts`, `notice-toast.test.ts` | notice-toast |

`web/src/game/stage-card/` and `web/src/app/play/page.tsx` are held by #600. This spec doesn't need them.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080:
  - the start screen, `/play?song=fur-elise`, and with `&mode=wait` so a mode's caption shows;
  - a toast over a take (`verify-toast.mjs` raises one with `/play?song=fur-elise&bot=nobody&input=test`).
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots, with the
  computed font sizes of the four start-screen items at both sizes.

## Validation
- **(a) #1239:** the computed font size of the ladder's rungs, a mode button, the mode caption, Songs and Options is
  at least 16 px at 1280×720 and 24 px at 1920×1080, read in the in-app browser and listed in the PR. Neither size
  scrolls. `start.test.tsx` and `play-modes.test.ts` stay green.
- **(b) #1240:** a test on `toastCss` finds no `39, 225, 255` and finds `var(--pa-line)` in `.pa-toast`.
- **Unit tests:** `pnpm -C web exec vitest run src/game/duo-start src/game/play-modes src/game/notice-toast`.
- **(c) Shots and taste v2 scores** in the PR (Design pass above).
- `verify-toast.mjs` runs in CI's browser suite; the done note says "not verified locally; covered by main's
  scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/play-polish-*.md`.
- No new dependency and no new token. The copy, the order of the start screen and the toast's timing stay as they are.
