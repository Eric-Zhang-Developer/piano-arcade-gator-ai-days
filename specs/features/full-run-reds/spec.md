---
name: "Full-run reds: the count-in's beat 1 on its frame, verify-landing's click step, the UI-sound spies, /learn's radii"
depends_on: ["count-in", "results-landing", "beat-track", "ci-browser", "pause-skin", "song-preview", "ui-sound-family", "duo-tokens"]
owns: ["specs/features/full-run-reds/", "changes/full-run-reds.md", "specs/decisions/full-run-reds-"]
assignee: "eric"
---

# Full-run reds

Issues #1177, #1270, #1284 and #1285, children of #754 that fail on main's full browser runs (40199915492 at
89fda5c; #1284 and #1285 on 40206948798, 15:26Z) and have no fix in flight. Both are `fix` work: each reproduces on origin/main first (AGENTS.md, "The loop" step 3), under
`verify.lock`, which is the one local browser check the interim load rule allows. One PR, since all four are full-run
checks with a known failure line, and none changes what another touches.

## The changes
1. **Beat 1 on its frame (#1177).** On both tries of the full run:
   ```
   verify-count-in: FAIL: beat 1: first frame 38.2 ms late (frame step 0.0 ms); beat 1: click within a frame of its frame (43.5 ms)
   verify-count-in: FAIL: beat 1: first frame 34.6 ms late (frame step 0.0 ms); beat 1: click within a frame of its frame (33.1 ms)
   ```
   Beats 2 to 8 pass. "Frame step 0.0 ms" means beat 1's first frame is the first frame count-in logged at all
   (`verify-count-in.mjs:99-102`: no frame before it), so the take's clock reaches beat 1 before the first frame
   count-in draws. Find out which, and say it in the PR with the numbers from `frames.json`:
   - the clock starts (`app/play/page.tsx`'s start) before the first frame is presented, so the first frame always
     lands some ms past beat 1's time; or
   - the first frame is spent elsewhere (a long task on the first frame, the font wait in `transformChart`,
     `count-in/index.ts:181`).
   **Keep the one-frame bar** (`verify-count-in.mjs:107-108`). Don't loosen it. If the runner's first frame is
   genuinely late, measuring from the first presented frame instead of the clock's zero is allowed, with the reason
   in the PR (the issue's own words). Both the numeral and the click have to agree with that frame.
2. **verify-landing's click step (#1270).** Step 3 reads `window.__pianoArcade.results`
   (`results-landing/verify-landing.mjs:145`), which /play sets only for `?input=test` (`app/play/page.tsx:461-465`).
   The check's URL has no `input=test` (`:97`), so the step throws every run, before its assertion. The value isn't
   used by any check after it (`:146-158`). Fix the check's read; the step's bars stay as written (the jump within
   300 ms, Retry not pressed).
3. **The UI-sound spies (#1284).** ui-sound-family (#1169) moved the UI sounds from oscillators to AudioBuffer
   sources, a deliberate change. Two checks still spy the old node, so they hear nothing:
   - `pause-skin/verify-pause.mjs:60-61` patches `OscillatorNode.prototype.start`: `FAIL 2: one accent then three
     ticks ()`, then the beat-apart and first-click lines fail on empty data. The countdown itself shows.
   - `song-preview/verify-preview.mjs:70-71` counts `AudioContext.prototype.createOscillator` for UI tones.
   Move each spy to `AudioBufferSourceNode` (`start` for the ticks and their audio time, creation for the counts),
   like for like, as `ui-sound-family/verify-ui-sounds.mjs` already does. Every assertion stays as strict: one
   accent then three ticks, a beat apart on the audio clock, the first due within a frame. The PR names #1169 as
   the deliberate change behind the edit. If a spy on the new node still hears nothing, that's an app finding:
   report it, don't relax the check.
4. **/learn's radii (#1285). Reproduce first.** `FAIL /learn: keeps its own radii ({}), want some 4px`
   (`duo-tokens/verify-duo.mjs:175-179`). The check records only non-zero radii (`:159-166`), so `{}` means no
   element on /learn computed a non-zero corner. Two causes fit, and the fix depends on which:
   - **A real red:** `globals.css`'s zero-radius reset skips a page only while it holds `#learning-content`
     (`web/src/app/globals.css:47-50`, decision `duo-tokens-radius`). If /learn no longer renders that element, or
     renders it after `networkidle`, or the check now lands on a page that doesn't render (a redirect, an error),
     the reset reaches /learn. Fix that cause (the selector, the page, or the check's wait). learn-kit hasn't
     merged, so it isn't the cause.
   - **A deliberate change:** a merged learning-ui PR (`git log origin/main -- web/src/app/learn web/src/learn`)
     made every /learn element square on purpose. Only then does the 4px assertion change, to what it guards (the
     reset doesn't reach /learn, for example `#learning-content` present and a /learn rule's own radius winning),
     and the PR names that change (AGENTS.md: never weaken a check to get a pass; if one is wrong, fix it and say
     why). If the cause is in a file a seeko-codes open PR holds, comment there instead.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/count-in/index.ts`, `count-in.test.ts`, `verify-count-in.mjs` | count-in | free |
| `web/src/game/beat/index.ts` | beat-track | **#600** (`fix:`, abbasi2010): only if the click's scheduling is the cause; switch once #600 frees it |
| `web/src/app/play/page.tsx` | core-loop | **#600**: same; only if the clock's start is the cause |
| `web/src/game/results-landing/verify-landing.mjs` | results-landing | free |
| `web/src/game/pause-skin/verify-pause.mjs` | pause-skin | free (#600 holds `pause-skin/index.tsx`, not needed here) |
| `web/src/game/song-preview/verify-preview.mjs` | song-preview | free (#600 holds `song-preview/index.tsx` and `opening.ts`, not needed here) |
| `web/src/game/duo-tokens/verify-duo.mjs` | duo-tokens | free |
| `web/src/app/globals.css` | duo-tokens' reset | only if #1285's cause is there; check holders first |
| `web/src/learn/frontend/`, `web/src/app/learn/` | learning-ui (done; no lane) | read only; if the cause is there, file a `gray-area` issue and say so in the PR |

`web/e2e/run-checks.mjs`'s `KNOWN_RED` isn't edited here: verify-landing's entry leaves under
`specs/decisions/ci-browser-known-red.md`'s rule (2 green full runs in a row with the fix), and count-in was never
listed.

## Validation
- **(a) #1177 reproduced:** `node web/src/game/count-in/verify-count-in.mjs --out <dir>` on origin/main, under
  `verify.lock`, prints the beat 1 FAIL line (or, if it passes locally, the PR says so and quotes the full run's
  line). The PR names the cause with `frames.json`'s first rows.
- **(b) #1177 fixed:** the same check passes on the branch with lines 107-108's bars unchanged (a diff of those two
  lines is empty, or the PR says why the measurement point moved). A unit test in `count-in.test.ts` pins the cause
  if it's pure logic.
- **(c) #1270:** `node web/src/game/results-landing/verify-landing.mjs --out <dir>` throws on origin/main at
  `:141`, and on the branch reaches its step 3 line, pass or fail. If step 3 then fails on its own bar, that's a new
  finding: report it in the PR and on #1270, don't loosen it.
- **(d) #1284:** `verify-pause.mjs` and `verify-preview.mjs` under `verify.lock` print their FAIL lines on
  origin/main and pass on the branch. A diff of their `check(` lines shows no changed bar; only the spy moved.
- **(e) #1285 reproduced:** `node web/src/game/duo-tokens/verify-duo.mjs --out <dir>` under `verify.lock` prints the
  `{}` line on origin/main, and the PR names the cause (which of the two above, with the commit). On the branch it
  passes; if its assertion changed, the PR quotes the old and new lines and the merged change behind it.
- **Unit tests:** `pnpm -C web exec vitest run src/game/count-in`.
- **CI:** all five checks run in the full browser run; the done note says which run first showed them green, or "not
  verified on a full run yet".
- **Design pass:** none. No pixel, layout or motion changes, only when beat 1's frame lands. The PR's Design
  section says so.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/full-run-reds-*.md`.
- No new dependency. No change to `web/src/contracts/`.
