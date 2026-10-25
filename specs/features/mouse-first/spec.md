---
name: "Mouse first: every action clickable, key hints off / and /simon, shortcuts listed on the ? card"
depends_on: ["duo-select", "select-layout", "song-preview", "song-options", "options-panel", "first-run", "simon-says-spike"]
owns: ["specs/features/mouse-first/", "changes/mouse-first.md", "specs/decisions/mouse-first-"]
assignee: "eric"
---

# Mouse first

Issue #772. Eric, 2026-10-25: "We primarily will navigate by mouse, so all the key instructions are kind of
annoying." He also likes that a take goes back to the songs by itself: that stays.

## Plan
**One PR: `feat(mouse-first)`**, under AGENTS.md's "Ownership is open within a lane" rule. It owns no code of its
own; it changes other eric-lane features' files on `/` (the select) and `/simon`. Before you start, check no open PR
is working on those files (`gh pr list`, then its files). #600 (`fix: improve piano timing, hold scoring and arcade
controls`) touches `select-layout/index.tsx`, `options-panel/index.tsx` and `song-preview/index.tsx`: if it is still
open, build anyway and ask the planner to hold the PR until #600 merges or closes.

## Requirements
**Every action is clickable; keys are only shortcuts** (scope added on #772, Eric 2026-10-25: "a lot of the cool
features we have are hidden behind ... a keyboard key instead of a button. For instance, the demo feature ... There's
no demo button", then "Let's do it"). The buttons and the hint removal land in **this same PR**: hints off without
buttons would make features impossible to find. Don't merge hint removal ahead of the buttons.
- **Key-only today** (from `help-overlay/keys.ts`): W watch, L learn, E easy, F first run, X lab, Esc pause, ← →
  rewind while learning. Each gets a control. Z/X octave stays key-only (a laptop-play aid), and named operator
  tricks (Shift+Esc demo reset) stay key-only, listed on the `?` card as such.
- **Select:** PLAY stays the primary action. **LEARN and WATCH** (the demo) join PRACTICE as secondary buttons on the
  focused panel, the same 2×2 pattern as duo-start (#763). Easy/Normal become clickable chips.
- **Playing (`/play`):** a small pause button in a corner, hidden under `?capture=1`. Learn mode gets on-screen ◀ ▶
  bar buttons for rewind.
- First run and the lab are reached by link (the lab through the nav bar). Everything else goes in the Options
  drawer or on the `?` card, not on the screen.
- **A test enforces it:** each `HelpLine` in `help-overlay/keys.ts` names its control (an accessible name), and a
  test fails when a help line's control doesn't exist on its screen. It extends the existing "every key handler has a
  help line" test.
- **The `<kbd>` badges and key-hint lines come off `/` and `/simon`.** Today's, on origin/main:
  - `web/src/game/select-layout/index.tsx`: the header line "↑↓ SELECT · ENTER PLAY · P PRACTICE · L LEARN · W WATCH
    · E EASY".
  - `web/src/game/song-preview/index.tsx`: "Press any key for previews". The line goes; a click already arms
    previews (its `pointerdown` listener). The "Preview: on the piano" / "laptop tones" states may stay.
  - `web/src/game/song-options/index.tsx`: the `H` badge on Hands and the `← →` badge on Speed.
  - `web/src/game/options-panel/index.tsx`: the `O` badge on Options.
  - `web/src/game/first-run/index.tsx`: the `F` badge on "First time? 30-second first song".
  - `web/src/app/simon/page.tsx`: the `Space` badge on Start / Again.
- **Every shortcut stays bound.** No key handler is removed or changed. A control may keep its key in `title` and
  `aria-keyshortcuts` (as `web/src/game/lab/LabLink.tsx` does today).
- **Shortcuts are listed only on the `?` help card** (help-overlay), behind one quiet "? controls" link on `/` and
  `/simon` that opens it. Every shortcut named above has a line on the card; add any that's missing (Simon's
  `Space`). The card's own `Esc` badge stays: it is the list.
- **The laptop-key letters drawn on the keys stay** (`labels=keys`): a gameplay aid, not a nav hint.
- **The automatic return to songs after a take stays.**
- **Not in scope:** besides the pause and rewind buttons above, `/play`'s start screen ("Laptop keys: A S D F …" in `web/src/app/play/page.tsx`, laptop-octaves'
  "Z / X: octave down / up" start panel, rewind's "← → back or ahead a bar"). duo-start rebuilds that screen and
  carries the same requirement. No other screens, no new controls, no change to what any control does.

## Design
AGENTS.md's "Visible changes" pass: invoke `frontend-design` before writing the UI and `design-taste-frontend`
(taste v2) for the look loop, up to 3 rounds of shots at 1280×720 and 1920×1080 from the dev server, and a Design
section in the PR with each round's score, the fixes and before/after shots. The "? controls" link is quiet: it
doesn't compete with the song list or Start.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests` for the touched features (select-layout, song-preview,
   song-options, options-panel, first-run, help-overlay, simon): every shortcut above is still handled, the help
   card has a line for each, and the new test finds each help line's named control on its screen.
2. The browser checks that assert hint text get updated to the new UI, not weakened: each still proves its key works.
   From `grep` over `verify-*.mjs` on origin/main:
   - `web/src/game/learn-from-select/verify-learn.mjs` reads the header hint for L, W and E: read the `?` card instead.
   - `web/src/game/song-preview/verify-preview.mjs` expects "Press any key for previews" before a key press.
   - `web/src/game/capture-mode/verify-capture.mjs` lists "Press any key for previews" among the words capture hides.
   - `web/src/game/simon/verify-simon.mjs` finds the button by `/Start/` and presses Space (should still pass).
   They run in main's scheduled full suite, per the no-local-checks rule. The done note names them: "not verified
   locally; covered by main's scheduled full run".
3. The design pass above.
4. Eric looks at it once. Mark that in the done note.

## Defaults
- **In `extras`, after hit-particles.**
- Log any choice this spec doesn't make in `specs/decisions/mouse-first-*.md`.
