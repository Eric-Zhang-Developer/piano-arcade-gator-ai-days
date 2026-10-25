---
name: "Hit particles: a contact bloom, dust clouds and rising wisps on every hit, from the PianiCast reference"
depends_on: ["juice-visual", "fever-stage"]
owns: ["specs/features/hit-particles/", "changes/hit-particles.md", "web/src/game/hit-particles/", "specs/decisions/hit-particles-"]
assignee: "eric"
---

# Hit particles

Issue #750. Eric, 2026-10-25, about the reference: "this is huge visual juice that does not exist yet. Pretty and very
detailed", and "I think this is a priority." Wisps come out of the piano when a note is hit, and they go high.

**Reference (local only).** `video-references/플라워 댄스(Flower Dance) - DJ Okawari(캇파캇파 ver.) ｜ 피아노 커버 [rA_2B7Yj4QE].mp4`
in the main checkout: PianiCast's Flower Dance cover, 1920×1080 at 60 fps, 4:46. It's copyrighted and excluded from
git. **Never commit the video or any frame from it**, in the repo, the PR body or an issue. Frames you extract for the
look loop stay in a scratch directory outside the repo.

**Why today's juice can't do it** (`changes/juice-visual.md`): particles are capped at 300, wisps live about 1.5 s
and stay low, effects are clipped out around any note due within 500 ms, and everything is drawn on the 2D canvas.

## Plan
**One PR: `feat(hit-particles)`**, up to about 1000 changed lines, under the lane-ownership rule in the pending
`contract:` PR #738 (one PR per screen, ownership open within a lane). It may change juice-visual's code
(`web/src/game/juice/`) and fever-stage's code (`web/src/game/stage/`) for the hookup, plus the one line in
`web/src/game/layers.ts`. **If #738 hasn't merged when the worker starts,** build the PR anyway and ask the planner to
hold it until it does. Split only at a real seam, and say why.

## Requirements
**Three effects, in the note's hue with a white core:**
1. **Bloom** at the contact point: a white-violet glow wider than the key, held while the note is held.
2. **Dust:** thousands of 1–2 px glitter specks streaming up from each held key, drifting sideways, fading slowly.
   They rise to about **half the screen** and linger **2–3 s**, so neighbouring notes' clouds merge into one haze,
   drawn over the falling notes.
3. **Wisps:** a few large crescent or feather streaks per note (about **40–80 px**), curved and tapered, floating up
   and turning.

**Performance:**
- The CPU writes spawns only: a fixed GPU pool (**~16k**) where a shader computes each particle's position and fade
  from (origin, spawn time, seed). Nothing is allocated mid-song.
- Reuse the existing three.js renderer (fever-stage) instead of adding a second WebGL context. Soft sprites with
  additive blending; no blur or full-screen bloom pass. The particle layer renders at DPR 1.
- Cap spawns per second. A governor halves spawning when frames run slow and recovers slowly; it **never freezes**
  the layer (fever-stage's freeze guard froze the stage in 3 of 12 runs, `changes/perf-budget.md`).
- Gate: `web/src/game/perf-budget/perf.mjs` with particles on, p95 frame work **≤ 6 ms** at 1920×1080 (main today:
  2.2–2.5 ms). Record before and after.
- **Reduced motion** gets a fraction of the particles.
- **Readability:** the dust stays dim near the hit line and brightens as it rises.

**Look:** no synthwave sun or grid (#728). This replaces duo-hud's old step 3 ("short and crisp" sparks), which asked
for the opposite.

**Open in #750, decided by the worker and logged** (`specs/decisions/hit-particles-*.md`), not invented here:
- How the dust is drawn *over* the falling notes while reusing fever-stage's renderer, whose canvas sits *behind* the
  highway and today only draws (and only shows, at opacity = fever heat) during fever.
- What happens with `?stage=off`, `localStorage["pianoArcade.stage"]="off"` or no WebGL.
- What becomes of juice-visual's 300-particle cap, 1.5 s wisps and 500 ms clear zone.
- The spawn cap's number, the governor's slow-frame threshold and recovery rate, and reduced motion's fraction.

## Design pass
Spelled out here so it doesn't wait on the pending `contract:` PR #726.
- **Before building,** invoke both the `frontend-design` and `design-taste-frontend` skills.
- **Look loop between iterations:** shots at 1280×720 and 1920×1080 from your own running dev server in the in-app
  browser, compared side by side with frames of the reference video. Fix the top 3 differences per round; at most
  3 rounds.
- **Dev servers** take a slot first: `mkdir "$(git rev-parse --git-common-dir)/devserver.1"` (or `.2`). At most two
  besides Eric's :3000; no free slot means wait. Stop only your own recorded pid and remove your slot after.
- **The PR body has a Design section** with each round's scores and before/after shots (ours only, never the
  reference's frames). No Design section, no ready PR.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/hit-particles` plus the touched features' own vitest
   (`src/game/juice`, `src/game/stage`): the pool (fixed size, slots reused, nothing allocated after mount), the
   spawn cap (a burst of hits never writes more than the cap per second), and the governor (on a scripted list of
   frame times it halves spawning when frames run slow, recovers slowly, and never reaches zero or freezes).
2. `perf.mjs` before (on origin/main) and after (on the branch), numbers in the PR. Per the interim load rule it runs
   locally only under `verify.lock`, with a timeout on the run. If it isn't run locally, the PR and the done note say
   so: "not run locally; main's scheduled run covers it".
3. The design pass above, with the Design section in the PR.
4. Eric looks at it once. Mark that in the done note (`not seen by Eric` until he does).

## Defaults
- **In `extras`, right after nav-bar** (Eric: a priority).
- Log any choice this spec doesn't make in `specs/decisions/hit-particles-*.md`.
