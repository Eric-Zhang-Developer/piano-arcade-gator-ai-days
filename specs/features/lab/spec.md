---
name: "Lab: one page that opens every experimental and hidden feature"
depends_on: ["song-select"]
owns: ["specs/features/lab/", "changes/lab.md", "web/src/app/lab/", "web/src/game/lab/", "specs/decisions/lab-"]
assignee: "eric"
---

# Lab

Issue #619. Eric, 2026-10-24: "the current UI basically kind of sucks for seeing our experimental features... a lot of
random crap that we have that's not on here." Today `/` links only to songs, `/calibrate` (options), first run,
`/progress` and login. It has two keys: **L** for wait mode and **W** for watch demo. Finished pages such as `/simon`, `/veritas`,
`/sheet`, `/sim`, `/attract`, `/cabinet`, `/operator` and `/learn` have no way in from `/`. Features reached by
`/play` params (bar loop, adaptive chunks, hands, rewind) are invisible. It also helps judges see the breadth in a minute.

## Plan
1. **`feat(lab)`:** `web/src/app/lab/page.tsx`, the entries in `web/src/game/lab/entries.ts` with their test,
   `verify-lab.mjs`, and the done note.
2. **`fix(song-select)`:** the way in from `/` (below). Nothing else on `/` changes.

## Requirements
- **One entry per done feature** (`changes/<slug>.md` on main), and none for a feature without one. Each entry has:
  - the feature's name;
  - one line of description, **copied from its `changes/<slug>.md` "What shipped"**, trimmed to about 20 words (never written fresh);
  - one button that opens it.
- **The entries at the time of writing** (the worker adds any feature done by then, and leaves out any that isn't):
  - **Play differently:**
    - wait mode, `/play?song=twinkle&mode=wait`;
    - flow-mode, once it's done;
    - adaptive chunks, the start screen's "Practice in chunks" or `practice=adapt`;
    - bar loop, `/play?song=fur-elise&from=1&to=4&tempo=70`;
    - hand mode, `hands=R`;
    - rewind, wait mode's ← and →. A key, not a URL: the line says so, and the button opens wait mode.
  - **Watch:** watch demo (`bot=perfect&audible=1&demo=1`, W on `/`), `/cabinet`, `/attract`.
  - **Score:** sheet-view, `/sheet?song=twinkle`.
  - **Experiments:** simon-says-spike `/simon`, veritas `/veritas`, piano-sim `/sim`.
  - **Behind the scenes:** operator-board `/operator`, calibration `/calibrate`.
  - **Learn:** learning-ui `/learn`.
- Take each song id in a URL from the library (`web/src/game/songs/`). If an id isn't there, use the first song.
- **The way in from `/`:** quiet, within `specs/context/visual-direction.md`. One small link in the select's footer
  ("Lab"), plus one key. These keys are taken on `/`: ↑ ↓ ← → Enter L W E F O H. **?** is help-overlay's. The worker
  picks the key and logs it in `specs/decisions/lab-key.md`.
- `/lab` fits 1280×720 and 1920×1080 with no page scroll if it can, else one scroll. Every button is a real link
  (Tab, Enter, and opening in a new tab all work). Esc or Back goes to `/`.
- **Not in scope:** no new feature, no change to any listed page, no screenshots or previews of the pages.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/lab`:
   - every entry's description is a substring of its `changes/<slug>.md` once whitespace and Markdown emphasis are
     stripped (the test reads the file);
   - every entry's slug has a `changes/<slug>.md`;
   - every entry's URL path is a page under `web/src/app/`.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug lab --worktree . --cmd "node {worktree}/web/src/game/lab/verify-lab.mjs --out {out}"`.
   It prints `verify-lab: pass` or names each failed step:
   1. `/` -> the footer link opens `/lab`, and the key does too.
   2. `/lab` -> each button's page loads with no error in the console (a 200 status and no page error).
   3. Screenshots `lab-1280.png` and `lab-1920.png`.
3. Eric looks at it once. Mark that in the done note.

## How it's built and checked
Follow `specs/context/visual-direction.md`, build it with the `frontend-design` skill, and review it with taste v2's
step 8, "Look", at 1280×720 and 1920×1080. Before and after screenshots go in the PR.

## Defaults
- **After flow-mode in `extras`,** with any idle worker except the standby (eric-agent-6). Cut if it isn't done by
  Sunday noon (2026-10-25 12:00 ET).
- Not-done pages (`/how`, `/forge`, `/about`, `/progress`) stay off until their done notes land. Adding one is a
  one-line `fix(lab)`.
- Log any choice this spec doesn't make in `specs/decisions/lab-*.md`.
