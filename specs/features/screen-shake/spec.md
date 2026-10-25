---
name: "Screen shake: a small shake on each combo milestone, as a Lab experiment"
depends_on: ["experiments", "core-loop"]
owns: ["specs/features/screen-shake/", "changes/screen-shake.md", "specs/decisions/screen-shake-"]
assignee: "eric"
---

# Screen shake

Issue #990. The game-lane catalog, row G13 (source: v4 Juice): "A small shake on combo milestones". Its acceptance
line: "Each `comboMilestone` event shakes the screen briefly; judgments stay readable". The catalog files it as
Maybe, so it lands as an experiment (#878): off by default, and Eric keeps or prunes it from the Lab gallery.

**Today:** core-loop's judge sends `comboMilestone { count }` at 25, 50 and then every 100 (`core-loop` spec). On a
milestone the combo number swells (`changes/combo-hud.md`) and a stinger plays (`changes/juice-sound.md`). Nothing
moves the screen.

**End state:** with `?x=screen-shake`, each `comboMilestone` gives the play screen a short, small shake that settles
back to exactly 0. Without the flag, `/play` is unchanged.

## How it mounts (the experiment contract, #878)
- **Its folder:** `web/src/game/x/screen-shake/`, plus its one registry line in `web/src/game/x/index.ts`. Both sit
  in experiments' `owns` (`web/src/game/x/`). The spec lint rejects an overlapping `owns`, so this spec doesn't list
  them. The `feat(screen-shake)` PR reaches them through the lane rule: experiments is done and in the same lane.
  Check open PRs on `web/src/game/x/index.ts` first (`gh pr list`, then their files). #967 (highlight-reel) adds its
  own registry line, so whichever lands second rebases. That's a one-line conflict.
- **Registry entry:** group "Juice", a line such as "A small shake on each combo milestone (#990)", and a URL that
  reaches a milestone quickly: `/play?song=minuet-g&bot=fever&x=screen-shake`. The worker confirms that this bot
  reaches combo 25 on that song, and picks another song or bot if it doesn't. Log the choice.
- **No edit to `web/src/app/play/` or `layers.ts`.** `/play` puts the stage `div`, the highway canvas and the overlay
  canvas in one `<main>` (`web/src/app/play/page.tsx`), and the experiment draws on the overlay. The shake moves
  the layers it can reach from `ctx.canvas` with a CSS `transform`. The worker picks which ones and logs it in
  `specs/decisions/screen-shake-target.md`. The highway and the overlay must move together, so the notes and the
  judgment word never drift apart. If the shake can't be done without editing `/play`, that file is core-loop's,
  in this lane, so the lane rule applies after an open-PR check. Keep that diff to a few lines.

## Requirements
- **When:** on each `comboMilestone` event, and on nothing else. `fullCombo`, `feverStart` and hits don't shake.
- **How much (the planner's numbers, not measured):**
  - the peak offset is at most `round(height / 180)` px on each axis (6 px at 1080);
  - it decays to exactly 0 within 250 ms of the event;
  - it never rotates or scales.

  A later milestone may shake harder, up to that cap. Log the curve.
- **Deterministic:** the offset is a pure function of the time since the event, seeded by `atMs`. It uses no
  `Math.random()`, so a test can assert exact values.
- **Always settles:**
  - the transform is cleared at 0 after the decay;
  - it's also cleared at once on `pause`, `quit`, `songEnd` and `songStart`;
  - a throw in the experiment leaves the transform cleared (the frame's guard turns the experiment off, so clear it
    on the way out too).
- **Reduced motion:** no shake at all. Use the `matchMedia("(prefers-reduced-motion: reduce)")` pattern that
  `web/src/game/fever-moment/index.ts` uses.
- **Readable:** the judgment word and the combo number stay legible mid-shake. That's the design pass's call.
- **No new dependency**, and nothing allocated per frame.
- Log any choice this spec doesn't make in `specs/decisions/screen-shake-*.md`.

## Design
A visible change, so AGENTS.md's "Visible changes" pass applies:
- invoke `frontend-design` and `design-taste-frontend` first;
- take shots at 1280×720 and 1920×1080 from your own dev server, in the in-app browser (take a `devserver.N` slot);
- record a short clip of ours across one milestone, at most 3 rounds.

A still can't show motion. So each round also logs the offset curve: one sample per frame for 300 ms from the
event, printed from the test. Reduced motion gets one shot, which shows no offset. Shots and the clip go in
`specs/features/experiments/shots/screen-shake/`, under the size cap the experiments note logs. The PR body gets the
Design section.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/x`:
   - a synthetic `comboMilestone` gives an offset whose peak is ≤ `round(height / 180)` and which is exactly 0 from
     250 ms on;
   - the same `atMs` gives the same curve;
   - `pause`, `quit`, `songEnd` and `songStart` clear it at once;
   - reduced motion gives 0 throughout;
   - no other event shakes;
   - the frame's existing tests (off by default, the gallery's one link per entry) stay green.
2. The experiments perf gate: `node web/src/game/perf-budget/perf.mjs --params x=screen-shake` reaches p95 ≤ 6 ms at
   1920×1080, run locally only under `verify.lock` with a timeout. Otherwise the PR says "not run locally; main's
   scheduled run covers it".
3. In the in-app browser, the registry URL at 1920×1080 → the screen shakes at combo 25 and settles. With no `?x=`,
   the same take doesn't shake. `verify-lab.mjs` and `web/e2e/verify.mjs`: not verified locally; covered by main's
   scheduled full run.
4. The design pass above, with the Design section in the PR.
5. Eric looks at it from the Lab once. The done note says `not seen by Eric` until he does. His verdict goes in
   `specs/decisions/experiments-log.md` (the prune rule), not in this PR.

## Gaps (accepted)
- The cap and the decay are the planner's guesses, made to stay small. Eric's look decides.
- Shots can't show motion. The offset curve and the clip are the evidence.

## Defaults
- The smaller, reversible option. If unsure whether a layer should shake, leave it still and log it.
