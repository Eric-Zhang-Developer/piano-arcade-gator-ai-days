---
name: "Frozen-clock fades: the miss pulse, the key release and fever's handoff end on time while the chart clock holds"
depends_on: ["miss-moment", "key-polish", "fever-arc", "results-landing", "play-modes"]
owns: ["specs/features/frozen-clock-fades/", "changes/frozen-clock-fades.md", "specs/decisions/frozen-clock-fades-"]
assignee: "eric"
---

# Frozen-clock fades

Issues #1331-#1333, from a post-merge bug review of the features merged on Oct 25. Three short animations are timed
on the chart clock, and in Learn and Flow (and under the pause menu, and during results-landing's out) that clock
stands still, so each one freezes mid-flight. One PR: the playfield while the song waits.

## The changes
1. **#1331 miss-moment:** the combo break is skipped in wait mode, and the wrong-key pulse and the break are timed
   from their first drawn frame on wall time, so each ends in its own duration while the chart clock holds. Pulses
   ahead of the clock are dropped on `resume` (rewind).
2. **#1332 key-polish:** the release fade in `core/highway.ts` is timed on wall time (injectable for tests), not
   `s.nowMs`, so a released key goes dark during a wait or a pause.
3. **#1333 fever-arc:** a song that ends in fever drains heat 1 -> 0 over results-landing's out, on `landingT()`;
   without the landing, the drain runs before the results mount, or the gap is logged in
   `specs/decisions/frozen-clock-fades-fever.md` and `changes/fever-arc.md` is corrected.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/miss-moment/index.ts`, `miss-moment.test.ts`, `verify-miss.mjs` | miss-moment | free; take-seams (#1259, no PR yet) plans a font edit here: check before each edit |
| `web/src/game/core/highway.ts`, `core/key-polish.test.ts` | judging-tiers / core-loop | **#747** and **#600** (drafts): switch once #747 frees it (and #600, unless the planner has closed it) |
| `web/src/game/fever-arc/index.ts`, `fever-arc.test.ts` | fever-arc | free |
| `web/src/game/results-landing/index.ts` (read-only import of `landingT`) | results-landing | **#1300** holds `verify-landing.mjs` only; landing-skip-seams edits `index.ts`: import, don't edit |
| `changes/fever-arc.md` | fever-arc | free (this PR is `feat(frozen-clock-fades)`, so correct the note through a separate `fix(fever-arc)` PR if `check_ownership.py` refuses it) |

If `core/highway.ts` is still held when the rest is done, ship #1331 and #1333 and leave #1332 open with a note on
the PR, rather than waiting.

## Design pass (AGENTS.md, Visible changes)
Invoke `frontend-design`, then `design-taste-frontend` (taste v2). Shots at 1280×720 and 1920×1080, plus reduced
motion, from your own dev server in the in-app browser:
- `/play?song=twinkle&mode=wait` while it waits on note 11 after a wrong key, before and after;
- a key released under the pause menu;
- the last frame of a fever ending under `?x=results-landing`.
Score against `references/critique.md`, fix the top three, at most three rounds.

## Validation
- **(a)** Each issue's Done-when, in unit tests:
  - #1331 `miss-moment.test.ts`: combo 12 then wrongNote at T, drawn at `nowMs = T` with wall time advanced 300 ms
    and wait params: no digit `fillText`, pulse alpha 0.
  - #1332 `core/key-polish.test.ts`: release at `nowMs = 5000`, draw again at `nowMs = 5000` 200 ms of wall time
    later: the key is unlit.
  - #1333 `fever-arc.test.ts` with a landing plan: heat 1 at T0, 0 at outMs.
- **(b)** A `verify-miss.mjs` step on `?mode=wait&input=test` and a fever frame-log check (handoff frames during the
  out). Not run locally (AGENTS.md interim load rule): the done note names them and says "covered by main's scheduled
  full run".
- **(c)** `pnpm -C web exec vitest run src/game/miss-moment src/game/core src/game/fever-arc` passes, plus the Checks
  in `specs/tech-stack.md`.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/frozen-clock-fades-*.md`.
- Reduced motion keeps its current branches; wall-time timing changes when a fade ends, not whether it runs.
- No new dependency, no change to `web/src/contracts/`.
