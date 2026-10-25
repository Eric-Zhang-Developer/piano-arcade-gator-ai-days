---
name: "Take seams: leaving mid-take says quit, the WARNING card stands upright, the broken combo matches the HUD"
depends_on: ["core-loop", "help-overlay", "hand-mode", "difficulty", "miss-moment", "duo-tokens"]
owns: ["specs/features/take-seams/", "changes/take-seams.md", "specs/decisions/take-seams-"]
assignee: "eric"
---

# Take seams

Issues #1241, #1242 and #1243, from polish sweep 3 on the demo path. Three places in a take where two shipped pieces
disagree: /play's exit and the plugins that wait for `quit`, the WARNING card and the upright kit, and the miss
moment's dropping combo and the HUD it copies. One PR, since they're one thing a person sees: the take, start to
exit. It's a normal game-lane change with the design pass, and it has no flag.

**Two of the three files are held by open PRs** (Files below). Take this spec only once #600 and #713 have merged or
closed; until then, switch to the next ready feature.

## The changes
1. **Leaving mid-take says quit (#1241).** /play's unmount only calls `stopRef` (`app/play/page.tsx:115-118`), whose
   stop (`:432-444`) ends the frame loop and the devices; `quit` comes only from the pause menu (`:299-300`). So after
   the browser's Back from a running take:
   - help-overlay keeps `taking = true` (`help-overlay/index.tsx:24-25`): on the select, `?` and Controls open
     nothing until another /play loads;
   - hand-mode's sends already queued to the piano play out (`hand-mode/index.ts:138`);
   - audio-track works around it with its own pathname poll (`audio-track/index.ts:180`).
   The fix is in one place, /play: unmounting during a take emits one `quit` (at the clock's now) before the stop. A
   take that already ended (results showing) emits none. audio-track's poll stays: removing it is a separate change.
2. **The WARNING card upright (#1242):** WARNING and `Lv N` (`difficulty/index.ts:37`, `:40`, the video's 1:00 shot,
   `video-shots/shot-list.md` row 10) drop `italic`, at the same sizes and weights. CLEAR and FULL COMBO went upright
   the same way (#1131).
3. **The broken combo matches the HUD (#1243):** miss-moment draws the broken combo's old digits in a hard-coded
   `italic 900` (`miss-moment/index.ts:333`, `:337`), copied from the HUD combo (`hud/index.ts:289`). #713 sets the
   HUD combo upright. The broken digits take the same weight and slant as the HUD combo on main when this is built.
   If #713 closed unmerged and the HUD is still italic, keep them matching and log it in
   `specs/decisions/take-seams-combo-font.md`.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/app/play/page.tsx` | core-loop | **#600** (`fix:`, open): switch once #600 merges or closes |
| `web/src/game/difficulty/index.ts`, `warning.test.ts` | difficulty | **#600**: same |
| `web/src/game/miss-moment/index.ts`, `miss-moment.test.ts` | miss-moment | free; waits on **#713** (`hud/index.ts`) so the two match |
| `web/src/game/help-overlay/help-overlay.test.ts` | help-overlay | free; only if the quit test lives there |

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080:
  - the WARNING card (`/play?song=maple-leaf-rag`, or any song with `&warn=1`);
  - a combo break (`miss-moment/verify-miss.mjs` shows how it forces one), plus reduced motion.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
- **(a) #1241:** a test (a small pure function for "emit quit on unmount?" is fine) shows one `quit` when /play
  unmounts during a take and none after the results show. `verify-help.mjs` (or a new step in it) shows `?` opens
  the card on `/` after Back from a running take.
- **(b) #1242:** a test on the WARNING card's font strings finds no `italic`; `warning.test.ts` stays green.
- **(c) #1243:** a test finds the broken digits' font string has the HUD combo's weight and no `italic` (once #713
  is on main); `miss-moment.test.ts` stays green.
- **Unit tests:** `pnpm -C web exec vitest run src/game/difficulty src/game/miss-moment src/game/help-overlay`.
- **(d) Shots and taste v2 scores** in the PR (Design pass above).
- `verify-warning.mjs`, `verify-miss.mjs` and `verify-help.mjs` run in CI's browser suite; the done note says "not
  verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/take-seams-*.md`.
- No new dependency and no new token. Event shapes in `web/src/contracts/` don't change: `quit` already exists.
