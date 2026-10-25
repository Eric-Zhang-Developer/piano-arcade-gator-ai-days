---
name: "Select reload: after a reload the panel's song has focus and its BEST shows your best"
depends_on: ["song-finder", "records", "duo-select", "main-page"]
owns: ["specs/features/select-reload/", "changes/select-reload.md", "specs/decisions/select-reload-"]
assignee: "eric"
---

# Select reload

Issues #1271 and #1272, two children of #754 on the music select. Both show on `/` after a reload, the moment a
judge opens the game after a demo reset. One PR, since they're one thing a person sees: the select as it first
loads. Each reproduces on origin/main first, under `verify.lock`.

**Both app files are held by an open PR** (Files below). Take this spec only once #1252 (select-motion) has merged or
closed; until then, switch to the next ready feature.

## The changes
1. **Focus after a reload (#1272).** `verify-finder.mjs` fails on main: `after the reload, focus is on the panel's
   song, so Enter plays it (BODY)`. eric-review-agent's reading on #1075, not yet confirmed: with a saved Recent or
   Composer sort, the client re-sorts on hydration and moves the autofocused row into another section's `<ol>`, so
   React remounts it and focus falls to `<body>`; Finder's refocus effect only acts while focus is inside an `<ol>`
   (`song-finder/Finder.tsx:71`). Confirm the cause in the browser first, then fix it where it starts. After a
   reload with any saved sort, focus is on the panel's song and Enter, P and L act on it.
2. **BEST after a take (#1271).** `verify-records.mjs` reads Twinkle's BEST as "—" right after an S take
   (`records/verify-records.mjs:96-112`, `duo-select/Select.tsx:57`). It failed first attempts on main before and
   passed retries, so it's intermittent. Find which side is wrong:
   - the app: the select shows "—" for a song with a stored best (fix in the app, add a unit test);
   - the check: it reads before the panel's song settles, or Twinkle isn't the first, focused row any more since
     main-page's sections (#1075). Fix the check's wait or its pick of the song, with its assertion unchanged
     (Twinkle "100.0%", Ode to Joy "—").
   #1272 may be the same cause (the focused row moving on hydration). If one fix closes both, say so.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/song-finder/Finder.tsx` | song-finder | **#1252** (select-motion, draft): switch once #1252 frees it |
| `web/src/game/duo-select/Select.tsx` | duo-select | **#1252**: same. select-a11y (#1258, no PR yet) also edits it: check before each edit |
| `web/src/game/main-page/Sections.tsx` | main-page | **#1252**: same, only if the sections cause it |
| `web/src/game/song-finder/verify-finder.mjs`, `records/verify-records.mjs`, `records/*.ts` | song-finder, records | free |

`KNOWN_RED` (`web/e2e/run-checks.mjs`) isn't edited here; both entries leave under
`specs/decisions/ci-browser-known-red.md`'s rule.

## Design pass (AGENTS.md, Visible changes)
Only if a fix changes what the select shows or how focus is drawn. Then:
- Invoke `frontend-design`, then `design-taste-frontend` (taste v2) for the look loop.
- Shots of `/` after a reload with a saved Recent sort, focus visible, before and after, at 1280×720 and
  1920×1080, from your own dev server in the in-app browser (one dev-server slot, `devserver.1` to `.4`).
- Score against `references/critique.md`, fix the top three problems, at most three rounds.
- If nothing visible changes (focus lands where it always should have), the PR's Design section says so.

## Validation
- **(a) #1272 reproduced, then fixed:** `node web/src/game/song-finder/verify-finder.mjs --out <dir>` under
  `verify.lock` prints the BODY line on origin/main, and passes on the branch with its assertion unchanged.
- **(b) #1271 reproduced, then fixed:** `node web/src/game/records/verify-records.mjs --out <dir>` under
  `verify.lock`, run 3 times on origin/main and 3 times on the branch; the PR lists all six results and names the
  cause. Its assertion (`:112`) is unchanged.
- **(c)** A unit test pins any app-side cause (`pnpm -C web exec vitest run src/game/song-finder src/game/records
  src/game/duo-select`).
- **CI:** both checks run in the full browser run; the done note names the first green run, or says "not verified
  on a full run yet".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/select-reload-*.md`.
- No new dependency, no new token, no change to `web/src/contracts/`.
