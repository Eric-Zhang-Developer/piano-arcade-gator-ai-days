---
name: "Foreman duo: /operator, /attract and /how fully restyled in the Duo look"
depends_on: ["duo-tokens", "operator-board", "operator-replay"]
owns: ["specs/features/foreman-duo/", "changes/foreman-duo.md", "specs/decisions/foreman-duo-"]
assignee: "eric"
---

# Foreman duo

Issue #774. Eric, 2026-10-25: "The foreman page needs a complete overhaul for our current theme as well." The
foreman's pages get the Duo look (`specs/context/visual-direction.md`, the duo-tokens kit), not only the synthwave
taken out.

## What exists (origin/main, 2026-10-25)
- **`/operator`** (operator-board, `eric`, done): `web/src/app/operator/`. `operator.module.css` opens with
  "Synthwave bookkeeping": a purple-to-black sky, a perspective grid, its own `--magenta: #ff5ad9`, CRT scanlines.
  `layout.tsx` loads VT323 (a pixel font) and IBM Plex Mono.
- **`/attract`** (operator-replay, `eric`, done): `web/src/app/attract/` and `web/src/replay/`. Its layout borrows
  `operator.module.css` and the same fonts; `attract.module.css` uses `--magenta` for rules, fills and
  `accent-color`; `replay/stage.ts` builds a magenta grid floor, a sun and a sky texture in three.js.
- **`/how`** (how-it-works, `eric-foreman-agent`, **not done**): #443, #460 and #731 are open; `web/src/app/how/`
  isn't on main yet.
- **Drafts:** #768 (`fix(operator-board)`) takes the grid and sky off `/operator`; #769 (`fix(operator-replay)`)
  takes the sun and grid off the `/attract` stage. Both only remove.
- **The kit:** `web/src/game/duo-tokens/` exports `Panel`, `Brackets`, `Button`, `DataCell`, `MonoLabel` and the
  canvas twins.

## Plan
One PR per page, under AGENTS.md "Ownership is open within a lane" (all three pages are `eric`'s lane). Before each
part, check that no open PR is working on that page's files.
1. **`feat(foreman-duo)` part 1, `/operator`.** Carries #768's removals over; #768 then closes unmerged, branch kept.
2. **`feat(foreman-duo)` part 2, `/attract`.** Carries #769's removals over (`replay/stage.ts`); #769 then closes
   unmerged, branch kept.
3. **`feat(foreman-duo)` part 3, `/how`.** Waits until `changes/how-it-works.md` is on main; this spec doesn't depend
   on how-it-works, so parts 1 and 2 aren't held up. Part 3 carries the done note, `changes/foreman-duo.md`.

## Requirements
- **A full restyle on the duo-tokens kit, not only removals:** zero radius; Saira condensed for labels and titles;
  the mono data face (`--pa-font-data`) for data; the bracketed `Panel` for each block; the kit's `Button` instead
  of hand-rolled ones; no browser-default controls (`<input>`, `<select>`, `<button>` all styled). VT323 goes: no
  pixel fonts.
- **Colors from visual-direction.md only:** the Duo tokens (`--pa-bg`, `--pa-panel`, `--pa-primary`,
  `--pa-secondary`, `--pa-line`, `--pa-ink`, `--pa-ink-dim`). No sun, grid or purple sky anywhere, the three.js stage
  included (#728). No hype pink: these aren't the game's hype moments, so the local `--magenta` goes. Judgment
  colors stay off chrome.
- **Nothing lost:** everything each page shows and does stays, with the same controls and links.
- **Mouse first (#772):** no key-hint clutter on the face; shortcuts that exist keep working.
- **`/operator` keeps the nav bar:** a separate `fix(nav-bar)` PR makes the bar show on `/operator`; the restyle
  keeps it visible, fits the page around it and never hides it.
- **Fits:** each page fits at 1280×720 and 1920×1080 with no horizontal scroll.
- Details beyond these come from #774 and visual-direction.md; invent none. Log any choice this spec doesn't make in
  `specs/decisions/foreman-duo-*.md`.

## Design pass
Every part, under AGENTS.md "Visible changes": invoke `frontend-design` before writing the UI and
`design-taste-frontend` for the look loop. Shots at 1280×720 and 1920×1080 (plus reduced motion where motion
changed) from a dev server in a slot (`devserver.1` to `.4`), scored against taste v2's `references/critique.md`,
top three problems fixed, at most 3 rounds. Each PR gets a **Design** section: skills, scores per round, fixes,
before/after shots.

## Validation
1. The existing checks for these pages keep passing: `web/src/operator/verify-operator.mjs`,
   `web/src/replay/verify-replay.mjs`, and how-it-works' own once it lands. Covered by main's scheduled full run; no
   local verify. The done note says "not verified locally; covered by main's scheduled full run".
2. The design pass above, in each PR's Design section.
3. Eric looks once at each page. Mark it in the done note.
