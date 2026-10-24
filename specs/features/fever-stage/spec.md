---
name: "Fever stage: a three.js synthwave stage behind the highway that reacts to your play"
depends_on: ["core-loop", "hud"]
owns: ["web/src/game/stage/"]
assignee: "eric"
---

# Fever stage

A three.js synthwave stage behind the 2D highway. A neon grid floor runs to a horizon with a sun and a star field,
and it moves with the music: the grid scrolls one line per beat, it speeds up as the combo multiplier climbs, it
bursts into color when fever starts, and it dips when you miss. The highway, notes and keys stay 2D and on top;
the stage is mood, never information.

It registers as one `GamePlugin` in `web/src/game/layers.ts` and uses its `background` hook
(`web/src/contracts/index.ts`). It only listens to `GameEvent`s and the `Frame`; it never calls the judge.

## Plan
1. **A `fix(core-loop)` PR first:** `/play` mounts the hook. For the first plugin with a `background`, it puts an
   empty element the size of the window behind the highway canvas, calls `background(el)` once per take, calls
   `frame(f)` in the same animation frame after the plugins' `draw`, and calls `dispose()` when the take ends or the
   page unmounts. While a background layer is mounted, the highway's full-screen backdrop
   (`web/src/game/core/highway.ts`, the first `fillRect`) is drawn at `stageBackdropAlpha` (default 0.55) instead
   of opaque, so the stage shows through and the lanes stay readable. With no background layer, nothing changes:
   `verify.py` still passes. The PR names the check that shows that.
2. Build the stage in `web/src/game/stage/`, one line in `layers.ts`.

## Requirements
**The scene** (three.js, one `WebGLRenderer` on the element it's given):
- A grid floor in perspective, running from under the keyboard to a horizon about a third down the screen.
- A low sun on the horizon, with horizontal bands cut out of it, and a sparse star field above.
- Synthwave colors from `stageSettings` in `web/src/game/stage/`; the palette shifts with the state below.

**The motion** (from the `Frame` and events only):
- **Beat:** the grid scrolls one line per beat at the chart's BPM (read it in `transformChart`, return the chart
  unchanged), locked to `frame.nowMs`, so it never drifts from the beat track. During the count-in it scrolls too.
- **Combo:** scroll speed and glow step up with the multiplier tier. Use `hud`'s `tierFor` (import it; don't copy
  the thresholds), so the stage and the HUD change tier on the same note.
- **Fever** (`feverStart` to `feverEnd`): the palette goes hot, the sun swells, the stars streak. This is the stage's
  loudest state.
- **Miss and WRONG** (`noteMiss`, `wrongNote`): a brief desaturating dip, about 300 ms. A combo break drops the
  speed back to tier 1.
- **Full combo** (`fullCombo`): a single burst from the sun before the results screen.
- **Count-in** (`countInBeat`): the grid's lines flash on each count.
- **Results:** the stage keeps idling behind the results screen until `dispose()`.

**Readability:** the stage's brightness behind the highway's lanes stays under `stageSettings.maxLaneLuma`
(default 0.35, 0-1 luma). It never draws over the highway. Notes, keys and the judgment line are never 3D.

**Cost and off switches:**
- The renderer caps its pixel ratio at 1.5 and turns antialiasing off.
- **Frame budget:** if the mean frame time over a rolling 1 s window goes over 20 ms (under 50 fps), the stage
  freezes on its current frame for the rest of the take and logs one console line saying so.
- **Off:** `?stage=off`, or `localStorage["pianoArcade.stage"] === "off"`, or no WebGL: `background` returns
  `null`, and the game plays exactly as without this feature. A small toggle on the results screen is out of scope;
  the URL and the storage key are enough.
- `prefers-reduced-motion`: one still frame, no scrolling, no bursts.
- `?input=test` (the verify run): the stage runs, so verify measures it.
- `dispose()` frees the renderer, geometries and materials (no leaked WebGL contexts across Retry).

**juice-visual:** its fever's "background warms" is this stage's job while the stage is on (see its spec). Both may
glow in fever: juice-visual at the highway's edges, the stage behind.

## Validation
- `pnpm -C web test`, Vitest, no WebGL:
  - The stage state is a pure reducer over `GameEvent`s, tested on a fixed event list: tier steps with the combo
    (same tier as `tierFor` at 0, 10, 20 and 30), fever on and off, the dip on a miss and a WRONG ending in about
    300 ms, the speed back to tier 1 on a combo break, one burst on `fullCombo`.
  - The grid offset at `nowMs` is a pure function: at whole beats it's a whole number of lines, at any BPM.
  - The frame-budget guard: a scripted list of frame times trips it at a mean over 20 ms across 1 s, not on one
    slow frame.
  - The off switches: `?stage=off` and the storage key both make `background` return `null`.
- `verify.py --slug fever-stage`: the Perfect player is still all PERFECT with the stage on, and with `?stage=off`.
- In Chrome, `action -> what you should see` (screenshots of 1-3 kept in the PR):
  1. `/play`, press Start -> the grid scrolls on the count-in clicks and then on the beat; the lanes stay readable.
  2. Hold a combo past 10 and 20 -> the grid speeds up as the HUD's multiplier changes. Reach fever -> the stage
     goes hot.
  3. Miss a note -> a brief dip and the speed drops.
  4. `/play?stage=off` -> no stage; the highway looks as before this feature.
  5. Retry five times, then check `chrome://gpu` or the console -> no "too many active WebGL contexts" warning.
  6. In DevTools' Performance panel, record 10 s of play on Eric's laptop -> note the mean frame time in the PR.
- On the piano (Eric; mark it in the done note): play Twinkle with the stage on and say whether it helps or
  distracts. `not verified on the piano` until he does.

## Defaults
- Prefer the smaller option: plain three.js meshes and lines, no postprocessing library and no shaders beyond
  three's built-in materials unless one effect can't be done without them (log it in
  `specs/decisions/fever-stage-*.md`).
- No new dependencies beyond `three`.
- If the stage hurts readability on the piano, lower `maxLaneLuma` before cutting features.
