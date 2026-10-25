---
name: "Pinned: your take becomes a brass music-box cylinder, plays on a virtual steel comb, and exports as an STL"
depends_on: ["experiments", "core-loop", "take-midi", "scenes", "duo-tokens"]
owns: ["specs/features/pinned/", "changes/pinned.md", "specs/decisions/pinned-", "web/src/game/x/pinned/", "web/src/app/musicbox/"]
assignee: "eric"
---

# Pinned

Issue #1171, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**The pitch:** your take becomes a brass music-box cylinder, plays on a virtual steel comb, and exports as an STL.

## How it mounts
- **`/musicbox`** (`web/src/app/musicbox/page.tsx`, a client page over `web/src/game/x/pinned/`), on the #914
  pattern.
- **Registry entry** (`web/src/game/x/index.ts`, its one line, under the lane rule): group "Wow", line "Your take as
  a brass music-box cylinder, with an STL (#1171)", href `/musicbox` (the demo take). #1158 (round) also edits
  `x/index.ts` right now; rebase if it conflicts.
- **"Pin it" on results:** through the frame's `resultsPanel`, with `?x=pinned` on, not a line in results-layout.
  The mount rule covers only `layout.tsx`, `page.tsx` and `layers.ts`. `results-layout/index.tsx` is in #600's file
  list, which the planner reads as stale, but the frame needs no edit there. The panel saves the finished take
  (chart as played, take, results) to `sessionStorage` under its own key, `pianoArcade.x.pinned.last`, and links to
  `/musicbox?take=last`.
- **highlight-reel's `saveLast` and `loadLast`** (`x/highlight-reel/take.ts`) are the pattern to copy, not to
  import. Experiments are pruned one folder at a time, so one must not depend on another.
- **Reused, imported and never edited:**
  - three.js 0.186.1, pinned in `web/package.json`, with its own `examples/jsm` modules (`RoomEnvironment` and
    PMREM for the env map, a bokeh pass for depth of field). No HDR file is downloaded;
  - take-midi's take data shape (`Take`, `TakeEvent` from the contracts) and `readTakeMidi` if a `.mid` take is
    loaded;
  - scenes' `botPresses` for the demo take;
  - the Duo kit for the chrome.
- **ui-sound-family** (#1167) hasn't landed, and its celesta isn't a comb anyway, so the voice is a small local
  renderer in the folder.

## What to build
1. **The take:**
   - `?take=last` is the take saved from results;
   - with none saved, or with no `take` parameter, the demo is scenes' `bot=perfect` on Twinkle, and the page says
     "a scripted take";
   - **one revolution is the whole take,** from its first press to its last release.
2. **Mechanics** (`cylinder.ts`, pure):
   - **pin angle** = time ÷ length × 360°;
   - **axial position** = the pin's tooth;
   - **every pin is equal:** music boxes have no dynamics, and the page says "a music box plays every note at one
     strength".
   - **The virtual comb (default):** one tooth per distinct pitch in the take. A cantilever's frequency goes as
     f ∝ 1/L², so a tooth's length is L ∝ 1/√f, scaled so the longest tooth fits the comb.
   - **The optional fit mode:**
     - folds the take onto a real movement's tooth list, but only with a cited tuning source (the movement, its
       maker's or a published tooth list, with the URL), in `specs/decisions/pinned-movement.md`;
     - reports each moved note (by how many semitones) and each dropped note;
     - **never invents a tooth list.** With no cited source, fit mode doesn't ship, and that's logged.
3. **Sound** (laptop audio only; the DGX stays silent):
   - a comb-tooth voice with partials at the Euler–Bernoulli clamped-free cantilever ratios;
   - the β values are the roots of cos β · cosh β = −1 (about 1.875, 4.694, 7.855), and the frequency ratios are
     β², about 1 : 6.27 : 17.55. Compute them in the test, don't type them;
   - plus a short pluck transient, and per-partial decays (logged);
   - played through Web Audio as each pin passes the comb.
4. **Look** (three.js, on the page's own canvas):
   - a brass PBR cylinder (`MeshStandardMaterial`, metalness high, roughness about 0.35) under a `RoomEnvironment`
     env map;
   - steel teeth that deflect as a pin lifts them, then ring (a damped wobble);
   - a crank to start, and drag to orbit;
   - **a "macro" camera:** close to the pluck point, with shallow depth of field;
   - Duo kit chrome around the canvas: title, the take's song and length, Play, Macro, Export;
   - **reduced motion:** a still render, and playback without camera moves or tooth wobble.
5. **Export:** a binary STL of the cylinder with its pins and the comb (`stl.ts`, a small writer in the folder, no
   dependency).
   - Each part is a closed shell; pins are separate closed shells touching the drum.
   - The download is named `<song id>-pinned.stl`.
   - The page labels it "a model, not fitted to a commercial movement", unless fit mode used a cited movement.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Unit tests** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/pinned`):
- pin angles within 0.1° of time ÷ length × 360° on a scripted take, with the first press at 0°;
- tooth lengths: L ∝ 1/√f across the comb (L₁/L₂ = √(f₂/f₁) within 0.1%), and one tooth per distinct pitch;
- **the STL is watertight:** in each shell, every edge is shared by exactly 2 triangles. The triangle count is sane:
  under a cap the worker logs, and the binary header's count matches the body;
- the STL parses back (80-byte header, count, 50 bytes a triangle);
- the voice's partial ratios: β solved from cos β · cosh β = −1, with ratios β² within 0.5%;
- fit mode refuses to run without a cited tooth list.

**(b) 60 fps at 1920×1080 while turning:** on your own dev server through the in-app browser (the load rule), with
perf-budget's `probe.js` pasted in (`__perfProbe.report()`), wide and macro. 3 runs; p95 frame work ≤ 6 ms, and the
rAF interval's spread. GPU time isn't measured (decision `perf-budget-gpu.md`): say so.

**(c) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- score with taste v2 at 1280×720 and 1920×1080, wide and macro, plus reduced motion, from your own dev server
  (one slot, `devserver.1` to `.4`);
- fix the top three problems a round, at most three rounds;
- scores and our shots go in the PR's Design section, and the shots in `specs/features/experiments/shots/pinned/`.

**The perf gate** (contract item 4): `perf.mjs --params x=pinned` on `/play`, where only the results link is added.
It runs locally only under `verify.lock`; otherwise "not run locally; main's scheduled run covers it".

**(d) Morning page, ranked low:**
- open the STL in Quick Look;
- a 30 s listen;
- flag the macro shot for video-shots (#975).

**Eric's URLs:** `localhost:3001/musicbox?take=last` (after a take with `?x=pinned`), or Lab → Pinned with the demo
take.

## Disk
About 5 GiB is free and falling. Keep test STLs few and local, outside the repo, and the worker deletes nothing
(Eric's no-delete rule). Commit no STL.

## Gaps (accepted)
- Every pin plays at one strength; the take's dynamics are dropped, as on a real music box.
- The virtual comb is tuned to the take, not to any real movement, unless fit mode has a cited one.
- The STL is a model: no draft angles or tolerances for printing.

## Defaults
- **In `extras`,** after ui-sound-family.
- Log any choice this spec doesn't make in `specs/decisions/pinned-*.md`: the drum's size, the pin shape, the
  partial decays and the triangle cap.
- The smaller option; no new dependency.
