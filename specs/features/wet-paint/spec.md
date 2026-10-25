---
name: "Wet Paint spike: free play where every note blooms as paint, wet while the pedal is down, dry when it lifts"
depends_on: ["experiments", "core-loop", "laptop-octaves", "laptop-sound", "duo-tokens", "perf-budget"]
owns: ["specs/features/wet-paint/", "changes/wet-paint.md", "specs/decisions/wet-paint-", "web/src/game/x/wet-paint/", "web/src/app/paint/"]
assignee: "eric"
---

# Wet Paint (spike)

Issue #1106, from Eric's overnight wow feeder (relayed by eric-planning-agent). Eric: "just build a bunch of cool crap
that has a maximum wow factor ... Some of them can be polished. Some of them can be spikes." This is a prototype spike
(decision 004), mounted as an experiment (#878). It stays out of the main game until Eric picks it.

**The pitch:** free play, with no chart needed. Every note blooms as paint. While the sustain pedal is down the paint
stays wet and bleeds; when it lifts, the paint dries in place. One minute becomes a framed painting.

**Why:** half the booth knows no song, and every mode today needs a chart. A grep of `specs/` on origin/main finds no
free play, Scriabin or painting. The only "free play" is the LED strip's tester, which lights keys
(`led-strip/spec.md:26,36`).

## The question
Can a WebGL2 stable-fluids canvas, driven live by MIDI, hold 60 fps at 1920×1080 under 10-note chords with the
pedal down? And does the pedal's wet/dry difference read at a glance in the finished painting?
- **Yes:** (a) holds 60 fps and (c) passes 3 of 3.
- **No:** after the time box, the frame rate misses at any sim resolution, or the pedal doesn't read. FINDINGS.md says
  which, with numbers.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state.

Every bar here is the planner's, not a measured threshold.

## How it mounts
- **`/paint`** (`web/src/app/paint/page.tsx`, a client page over `web/src/game/x/wet-paint/`). Free play has no chart,
  so it can't run on `/play`.
- **Registry entry** (`web/src/game/x/index.ts`, its one line, under the lane rule): group "Wow", line "Free play:
  every note blooms as paint, wet while the pedal is down (#1106)", href `/paint`. Its `plugin()` returns a plugin
  with no hooks, so `?x=wet-paint` on `/play` does nothing.
- **Imported, never edited:**
  - core's `keysDevice` and `midiDevice`;
  - laptop-octaves' `laptopMap` and its Z/X shift;
  - laptop-sound's "Portable Grand", so laptop keys sound when no DGX is plugged in;
  - the Duo kit (`Panel`, `Brackets`, `MonoLabel`, `canvasFonts`);
  - score-card's download path, if it fits (its card itself is a take's score, so it doesn't).
- **Note only, not built:** a possible `/attract` hook. That's the foreman's scope.

## What to build
1. **The fluid:** stable fluids (Stam) in WebGL2, at a quarter of the canvas resolution, upsampled.
   - **The base:** vendored from Pavel Dobryakov's WebGL Fluid Simulation
     (`github.com/PavelDoGreat/WebGL-Fluid-Simulation`, MIT). The planner checked: the license is MIT, and the
     latest commit is `a2d292931f19d9b3b9f564e23e6c32729d2121c3` (2024-11-12). Copy `script.js` at that commit into
     `web/src/game/x/wet-paint/vendor/fluid.js`, keeping its license header. Add a first line naming the repo and
     commit.
   - **Strip what isn't the simulation:** that file has a mobile promo popup, Google Analytics `ga(...)` calls and a
     `dat.gui` panel (lines 27-50 and on). Remove them, so the page makes no analytics requests, and list every
     removal in `specs/decisions/wet-paint-vendor.md`. Keep its shaders and solver; wrap it as a module with explicit
     `splat`, `step` and parameter calls.
   - **Credit:** in `CREDITS.md`, through a separate `docs:` PR (the credit append rule covers only
     `feat(song-pack-<n>)` PRs).
   - **No dependency:** no npm package, since `web/package.json` is frozen.
2. **The pedal** (CC64, read from the MIDI input directly: core's `midiDevice` passes only note on and off):
   - **down:** low dissipation and low viscosity, so colors bleed and mix;
   - **up:** the live layer dissipates, and the screen fixes into a **dried-pigment layer**, a separate texture
     composited under the live one, which never moves again;
   - **half-pedal:** CC64's value 0–127 blends dissipation and viscosity between the two, on one curve
     (`pedalCurve(cc)`, pure, logged);
   - **laptop keys:** Space held is the pedal (down or up only), logged.
3. **Notes:**
   - **pitch sets x,** matching the keyboard drawn below the canvas (21–108, or the laptop map's range);
   - **each note is a splat** from the bottom edge, with velocity setting its size and force;
   - **a held note keeps feeding ink** until its release, and a chord's notes bloom together;
   - **color comes from Scriabin's key-color table:**
     - a pitch class maps to a color;
     - the table comes only from a source the worker can **cite** (for example a published account or scholarly
       table of the *Prometheus* light part, such as Sabaneev's), copied into `specs/decisions/wet-paint-colors.md` with the
       citation and the page or URL;
     - never from memory;
     - if sources disagree, log both and pick one, saying why.
4. **The frame:** after 60 s, or on a "Frame it" button:
   - the canvas freezes inside a hairline mat (the kit's `Panel` and `Brackets`);
   - the caption is "Free play · <time> · <n> notes · after Scriabin" in the Duo type. The time is the session's
     length, and n is the notes counted;
   - **Save PNG** downloads the framed image;
   - **Again** clears both layers.
5. **Inputs:**
   - the DGX through MIDI;
   - or laptop keys through laptop-octaves, at a fixed velocity (core's keys velocity, 80);
   - **the LED strip is optional:** if connected (a "Connect lights" button reusing `leds/serial.ts` and the
     `keyOn`/`rgb7` messages), each key lights in its paint color while held. There's no dependency on #720, and
     without a strip nothing changes.
6. **Reduced motion:** splats fade in place, with no flow and no bleed. The dry layer still forms on pedal up.
7. **Test hook:** `window.__wetPaint = { notes, pedal, dried, simSize, play(events) }`. `play` takes scripted
   note and CC64 events with times, for (a) and (c).

## Validation
The bars are the planner's, not measured thresholds.

**(a) 60 fps:**
- **Where:** 1920×1080, on the worker's dev server, through the in-app browser (the load rule).
- **The load:** scripted 10-note chords every 500 ms for 20 s, with the pedal down, through `__wetPaint.play`.
- **How:** measured the way perf-budget does, with `web/src/game/perf-budget/probe.js` pasted in
  (`__perfProbe.report()`).
- **The bar:** p95 frame work ≤ 6 ms, and the rAF interval's spread (p50, p95, max) showing no dropped frames
  beyond 1 in 100.
- **Logged:** the sim resolution, and both numbers at quarter resolution plus one step down if quarter misses.
- GPU time isn't measured (decision `perf-budget-gpu.md`): say so.

**(b) Unit tests** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/wet-paint`):
- **color:** every pitch class maps to its color in the cited table, the decision file's values and the code's are
  equal (one test reads both), and octaves share a color;
- **the pedal curve:** CC64 0 gives the dry settings, 127 the wet ones, and the curve is monotonic;
- **the dried layer:** after a pedal up, it's immutable: further steps, splats and pedal changes never change its
  texture (checked on a fake GL or a CPU model of the compositing);
- **x from pitch:** it matches the drawn keyboard's key centers.

**(c) The pedal read test:**
- **Three PNGs,** made from scripted sessions through `__wetPaint.play` (the same notes in each, about 20 s):
  1. staccato with no pedal;
  2. legato with the pedal;
  3. held chords with the pedal.
- **The test:** a fresh subagent sees all three, unlabeled and shuffled, and must name the ones played with the
  pedal.
- **Pass:** 3 of 3, meaning both pedal PNGs named and the staccato one not. Never show the subagent the scripts or
  the spec.

**(d) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- shots of the live canvas mid-session and of the framed painting at 1280×720 and 1920×1080, plus reduced motion,
  from your own dev server in the in-app browser (one slot, `devserver.1` to `.4`);
- fix the top three problems a round, at most three rounds;
- scores and our shots go in the PR's Design section, and the shots in
  `specs/features/experiments/shots/wet-paint/`.

**(e) Eric's 1-minute noodle** (low rank): on the DGX at `localhost:3001/paint` (or Lab → Wet Paint). Mark it in the
done note (`not tried by Eric` until he does).

## FINDINGS.md (`web/src/game/x/wet-paint/FINDINGS.md`)
Per decision 004:
- the question;
- the measured answer: (a)'s numbers per sim resolution, and (c)'s answers;
- the color source chosen and any disagreement;
- what worked, what didn't, what to keep;
- **promote**, **iterate** or **kill**.

## Gaps (accepted)
- Free play only: no chart, no score, no take saved.
- The laptop pedal is on or off, with no half-pedal.
- Scriabin's table is one historical reading of his color hearing, not a rule. The caption says "after Scriabin".
- The LED strip needs its own connect on `/paint`, since a serial port doesn't follow a navigation.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/wet-paint-*.md`: the colors (with the
  citation), the pedal curve, splat sizes and the sim resolution.
- No network requests besides the page's own. The vendored file's analytics are removed, not just unused.
