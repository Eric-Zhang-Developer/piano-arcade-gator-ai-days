---
name: "Select motion: a spring focus bar, no queue on a held arrow, and Find, chips and the panel that glide"
depends_on: ["main-page", "select-layout", "duo-select", "song-finder", "song-preview", "select-to-stage", "ui-sounds", "ui-sound-family", "perf-budget"]
owns: ["specs/features/select-motion/", "changes/select-motion.md", "specs/decisions/select-motion-", "web/src/game/select-motion/"]
assignee: "eric"
---

# Select motion

Issue #1212. It's a hero-tier polish item (#856): one deep pass on how the song select on `/` moves. It's a normal
game-lane change with the design pass, and it has no flag.

**Today (origin/main):**
- **Layout:** main-page (#1075) did it.
- **The only motion:** `@keyframes enter` on the detail panel (`duo-select/select.module.css:9` and `:197`, 200 ms,
  ease-out, a 12 px slide in from the left).
- **↑ / ↓** (`select-layout/index.tsx`, `onKeyDown`) plays `uiSound("move")`, focuses the next link and calls
  `scrollIntoView({ behavior: "smooth" })` on every keydown, auto-repeats included. So a held arrow stacks smooth
  scrolls, and the highlight jumps row to row (`SongRow`'s `focused`).
- **The panel** is remounted per song (`<FocusPanel key={song.id}>`), so each move replays `enter`.
- **A chip** (`jump`) focuses the section's first song and smooth-scrolls its header.
- **Hover** focuses the row under the mouse, unless the Find box has focus.
- **song-preview** waits `previewSettings.delayMs` (400) before it plays. That's unchanged.
- **select-to-stage's view transition** (`select-layout/go-to-stage.ts`) is unchanged, except that it starts from the
  bar's resting position.

**The model:** Apple's interaction design.
- springs, not durations;
- every motion can be interrupted and retargets from where it is;
- feedback within one frame;
- a held key never builds a queue.

## The pass
1. **The focus bar:** one bar behind the focused row, on a critically damped spring. A new target retargets it from
   its current position and velocity, with no restart and no queue.
2. **A held arrow:**
   - the OS's auto-repeat drives it, with zero queueing: each repeat moves the logical focus and retargets the one
     spring;
   - the list scrolls by the same spring, not by `scrollIntoView` smooth;
   - the spring stiffens with the repeat rate, so on key-up the bar reaches the focused row within 1 frame;
   - the response curve is logged.
3. **The detail panel:**
   - a crossfade with about a 6 px offset in the direction of travel (down or up);
   - during fast repeats it doesn't animate, and it settles once on stop;
   - song-preview's 400 ms wait is unchanged.
4. **Chip jumps:** a spring scroll to the section, the bar landing on its first song, and a brief settle on the
   section header (`main-page/Sections.tsx`).
5. **Find:**
   - a FLIP reflow of the rows that stay, under 200 ms;
   - rows that leave cut out, and rows that arrive fade in;
   - it never blocks typing: each keystroke retargets from the rows' current positions.
6. **One "focus changed" source of truth** in `select-motion/`: `moveFocus(target, { cause, step })`, where cause
   is key, repeat, chip, hover or find.
   - It sets the spring's target and calls `uiSound("move", 0, { key })` (ui-sound-family's move note, done) in the
     same handler, so the sound and the first frame of motion line up.
   - The keyboard, the chips, hover and Find all go through it.
7. **The mouse:**
   - hover moves the bar on the same spring, still never taking focus from the Find box;
   - the wheel scrolls freely, then snaps to a row once it settles.
8. **Reduced motion:** every move cuts, focus is instant, the panel swaps without the crossfade, and Find doesn't
   reflow.
9. **Don't touch** select-to-stage's view transition. It only hands off from the bar's resting position.

## How it's built
- **`web/src/game/select-motion/`** (new) holds:
  - the spring, pure and stepped by `dt`, with retarget, settle and a stiffness-from-repeat-rate function;
  - `moveFocus` and its subscribers;
  - the FLIP helper;
  - the wheel snap;
  - the bar as a component;
  - a dev-only frame and mark recorder for Validation (c).

**Every select file and who holds it** (checked when this spec was written; re-check each before any edit):

| File | Owner (done) | Held by | This pass |
|---|---|---|---|
| `web/src/game/select-layout/index.tsx` | select-layout | **#600** (abbasi2010, `fix:`, open, not a draft) | the keyboard, chip and hover calls go through `moveFocus`; the panel's `key` |
| `web/src/game/select-layout/select-layout.module.css` | select-layout | **#600** | the list's scroll container, if the bar needs it |
| `web/src/game/select-layout/go-to-stage.ts` | select-layout | free | only reading the bar's resting rect for the handoff |
| `web/src/game/song-preview/index.tsx`, `opening.ts` | song-preview | **#600** | nothing: the 400 ms wait stays |
| `web/src/game/duo-select/Select.tsx`, `select.module.css` | duo-select | free | the panel's crossfade replaces `enter`; `SongRow`'s highlight gives way to the bar |
| `web/src/game/main-page/Sections.tsx`, `main-page.module.css` | main-page | free | the header settle |
| `web/src/game/song-finder/Finder.tsx`, `finder.module.css` | song-finder | free | the FLIP reflow, measured before `setQuery` |
| `web/src/game/ui-sounds/index.ts` | ui-sounds | free | nothing: `uiSound` is called, not changed |
| `web/src/app/page.tsx` | (mount) | free | nothing |

- **The lane:** every row is the eric lane, so a `feat(select-motion)` PR may change the free ones while no open PR
  touches them. No main-page or select-layout follow-up PR was open, and no bundle PR touched these files, when this
  spec was written. #600 is the only holder. It's another person's PR, so its files stay closed until it merges or
  closes.
- **Until #600 frees `select-layout/index.tsx`:**
  - build and test `select-motion/` and the free files (the bar, the panel's crossfade, the header settle, Find's
    FLIP);
  - the swap in `select-layout/index.tsx` is small: `onKeyDown`'s three lines, `jump`'s two and the hover handler
    become `moveFocus(...)` calls, and the smooth `scrollIntoView` calls go;
  - do the look loop on a local branch with that swap applied, and don't push it;
  - keep the PR a draft;
  - if #600 is still open when the rest is done, tell the planner instead of waiting.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `apple-design` first, for springs, interruption and feedback.
- Then `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots and recordings from your own dev server in the in-app browser, with one dev-server slot.
- Score each round against `references/critique.md` and fix the top three problems. A hero item gets up to 5 rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the before and after shots and
  WebMs.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Shots and recordings**, before (origin/main) and after, in `specs/features/select-motion/shots/`:
- at 1280×720 and 1920×1080:
  - focus mid-list;
  - a chip jump landing (Composer);
  - Find mid-filter ("cho");
- the same set under reduced motion;
- WebMs at 60 fps of holding ↓ through 20 rows, before and after.

**(b) Taste v2:** the score for each round in the PR, up to 5.

**(c) Measured** in the in-app browser with `select-motion`'s recorder (`performance.mark` and rAF timestamps). It's
the worker's own dev server, 3 runs each, and the PR reports the runs and their spread.
- keydown to the first visual change within 1 frame (the mark at keydown to the next frame's paint timestamp);
- holding ↓ for 2 s:
  - within 1 frame of key-up, the bar's row equals the logical focus;
  - there are 0 queued animations (`document.getAnimations()` holds no scroll or bar animation beyond the one spring);
- a Find reflow at 40 songs in under 200 ms, from keystroke to the last row at rest;
- fast-scroll frame intervals (holding ↓ and a wheel fling) with p95 ≤ 16.7 ms, before and after. perf-budget's
  `probe.js` counts only fever frames on `/play`, so the recorder applies the same 16.7 ms budget to the select;
- the move sound and the motion start on the same frame (the `uiSound` call's mark and the spring's first step share
  a frame timestamp).

Unit tests (`pnpm -C web exec vitest run src/game/select-motion src/game/duo-select src/game/main-page src/game/song-finder src/game/select-layout src/game/ui-sounds`):
- the spring is critically damped (no overshoot);
- the spring retargets keeping its velocity;
- the spring settles in a bounded number of steps;
- stiffness rises with the repeat rate;
- `moveFocus` calls `uiSound` once per move, with the same cause and frame as the spring;
- reduced motion gives an instant cut;
- the FLIP helper inverts and plays from measured rects;
- the touched features' tests stay green.

Browser checks (`verify-select`, `verify-main`, `verify-finder`, `verify-move`): not verified locally; covered by
main's scheduled full run.

**Eric** (the morning page): at `localhost:3001`, hold ↓, tap the Composer chip, and type "cho" in Find. The done note
says `not seen by Eric` until he does.

## Gaps (accepted)
- The keyboard half ships only once #600 frees `select-layout/index.tsx`.
- Touch and swipe are out of scope.

## Defaults
- **In `extras`,** at the end.
- Log any choice this spec doesn't make in `specs/decisions/select-motion-*.md`: the spring constants, the repeat
  curve, the panel's offset and timing, the header settle, the wheel snap rule and Find's arrive and leave.
- The smaller option; no new dependency (no motion library).
