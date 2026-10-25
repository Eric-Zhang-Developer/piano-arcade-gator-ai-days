---
name: "Inside the Piano: a live cutaway of a grand's action, hammers and dampers driven by the DGX"
depends_on: ["experiments", "core-loop", "piano-out", "laptop-sound", "golden-demo", "demo-performance", "duo-tokens"]
owns: ["specs/features/inside/", "changes/inside.md", "specs/decisions/inside-", "web/src/game/x/inside/", "web/src/app/inside/"]
assignee: "eric"
---

# Inside the Piano

Issue #1226, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**The pitch:** a live cutaway of a grand piano's action, driven by the DGX.
- The hammer flies, escapes and strikes, and the damper lifts.
- The pedal raises all 88 dampers in a wave.

**The honest framing:** the DGX is a digital piano. The page shows the acoustic mechanism its sound is modeled on, and
says that in one line. It never claims the DGX has hammers.

## How it mounts
- **Its own page:** `/inside` (`web/src/app/inside/page.tsx`, over `web/src/game/x/inside/`), on the pattern of
  conductor, composers-hands and pinned.
- **One registry line** in `web/src/game/x/index.ts`, with `href: "/inside"`, so it shows in the Lab as "Inside the
  Piano". Its `plugin()` is a no-op on `/play`.
- **The page holds its own MIDI access,** as composers-hands does.
  - `core/input.ts`'s `midiDevice` drops every message but notes (`:24`, "pedal and other CCs aren't judged"), so it
    can't feed the pedal. The page reads note-on, note-off and CC64 itself, from the input named `PIANO_NAME`.
  - Laptop keys use `keysDevice` at a fixed velocity (80, as `TakeEvent` documents for laptop keys).
  - With no DGX, the sim (`sim/fake`) stands in, as composers-hands does.
- **three.js 0.186.1** is already pinned in `web/package.json`. `x/pinned/scene.ts` is the nearest pattern
  (RoomEnvironment, OrbitControls). No new dependency, and no downloaded model or texture: only small procedural
  textures made in code.

## The build
1. **Geometry, from a source the worker can actually read:**
   - **Prefer a public, readable source:**
     - a public-domain patent drawing. The pitch's example is Érard's double-escapement patent, unchecked here; use
       it only if it's found and read;
     - a manufacturer's published action diagram;
     - an open technical page.
   - **No book that can't be read here,** such as Reblitz, is cited.
   - **The label:** the page and `specs/decisions/inside-geometry.md` say "proportions after <source>", with the URL
     or citation and the page or figure.
   - **With nothing readable:** "illustrative proportions", and the decision file says so.
   - **String lengths:** from a cited scale, or labeled "illustrative scale".
   - **Let-off distance, key dip and damper-lift point** are from the source where it gives them. Otherwise they're
     logged as choices; none is stated as fact.
2. **A state machine per key, for double escapement** (pure, in `x/inside/action.ts`, stepped by time):
   - **the stroke:**
     - key down;
     - the jack lifts the hammer;
     - let-off, a few mm before the string (the value from step 1);
     - free flight, then the strike, then the rebound;
     - the backcheck catches the hammer;
     - key up, and the damper returns;
   - **the damper** lifts at about half key depth (the planner's default, unless the source says otherwise);
   - **repetition:** a re-press before full release re-strikes from the repetition lever's held position, without
     the key returning to rest;
   - **the pedal:**
     - CC64's value (0–127) maps to the damper rail's height, half-pedal included. The map is logged;
     - while it's down, released keys' dampers stay up;
     - the rise and the fall run as a wave across the 88 (its speed logged).
3. **Honest timing:**
   - **Live (DGX or laptop keys):**
     - a note-on means the strike has already happened, so it's drawn at once: the hammer at the string, then the
       rebound, the backcheck and the damper;
     - no approach is ever animated before a note-on;
     - a note-off releases the key.
   - **Bot and demo playback** know their future notes. The approach is animated ahead of the strike on the output's
     clock: the same `performance.now()` timestamps the page passes to `MIDIOutput.send`, so the strike lands on the
     note's send time.
   - **Hammer speed** scales with velocity. The curve is logged.
4. **The look:**
   - **Two views:**
     - a large side cutaway of the latest key's action: key, wippen, jack, repetition lever, hammer, backcheck,
       damper and string;
     - an 88-key row view, with hammers and dampers as `InstancedMesh`es.
   - **Materials:** PBR felt, maple and steel, from small procedural textures.
   - **The strings** shimmer while they sound, decaying fast when damped and slowly when the damper is up.
   - **The camera:** a slow drag orbit.
   - **The chrome:** the Duo kit (`duo-tokens`): the view switch, the input state, Play Moonlight, and the framing
     line.
   - **Reduced motion:** no orbit and no shimmer, and parts snap between states.
5. **The inputs:**
   - DGX MIDI, or laptop keys at a fixed velocity;
   - **Play Moonlight** runs moonlight-1's chart with its `velocity`s and `loadPedal("moonlight-1")` (demo-performance's
     pedal and dynamics), scheduled to the DGX through `MIDIOutput.send` as piano-out does. It drives the action from
     the same schedule;
   - **the echo:** notes the page sent and the DGX echoes back aren't counted twice (`hand-mode/hands` `echoGuard`, as
     composers-hands uses);
   - **stopping:** Stop, leaving the page and `pagehide` all send `allNotesOff` (piano-out).
6. **The capture:**
   - a clean beauty shot of the dampers rising on Moonlight's first pedal, in the row view, at 1920×1080, in
     `specs/features/inside/shots/`;
   - it's flagged for the video in a comment on #975 (video-shots, closed), with the URL and the moment;
     `video-shots/shot-list.md` isn't edited;
   - it's on the morning page too.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, and fix the top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Unit tests** (`pnpm -C web exec vitest run src/game/x/inside`):
- one key's stroke runs the sequence above in order, with each phase's time inside its logged range;
- the damper lifts at the half-depth point;
- a re-press before full release re-strikes without passing through rest;
- with the pedal down, a released key's damper stays up;
- the CC64 map is monotonic and gives a half-pedal rail for a mid value;
- **in live mode, no approach is drawn before a note-on:** the hammer is at rest until the note-on, and at the string
  at the note-on;
- in playback mode, the approach ends exactly at the scheduled send time;
- a higher velocity gives a shorter flight;
- Play Moonlight's schedule matches the chart's notes, velocities and the pedal file.

**(b) Perf:** a steady 60 fps at 1920×1080 with 10-note chords and the pedal down, in the row view and in the cutaway,
on the worker's own dev server in the in-app browser.
- 3 runs, with the per-frame work-time p95 and its spread, against perf-budget's 16.7 ms budget.
- perf-budget's `probe.js` counts only fever frames on `/play`, so the page times its own update and render with `performance.now()` around them, dev-only, the way `probe.js` does. Not rAF-to-rAF intervals: those are vsync-bound and read about p95 17.6 ms even on an empty page (perf-budget's spec).

**(c) The design pass:** taste v2 at 1280×720 and 1920×1080 on both views, plus reduced motion.

**(d) Eric** (the morning page, ranked low): at `localhost:3001/inside`, 1 minute of keys and pedal on the DGX, then
the Moonlight pedal shot, flagged for the video. The done note says `not seen by Eric` until he does.

Browser checks: not verified locally; covered by main's scheduled full run.

## Gaps (accepted)
- The geometry is only as exact as the readable source. Without one it's illustrative and labeled so.
- Live mode can't show the approach, since a MIDI note-on arrives after the strike. That's the honest framing, not a
  bug.
- One action type: the grand's double escapement, not an upright's.

## Defaults
- **In `extras`,** at the end, after select-motion.
- Log any choice this spec doesn't make in `specs/decisions/inside-*.md`: the phase timings, the velocity curve, the
  CC64 map, the wave's speed, the materials and the camera.
- The smaller option; no new dependency, and no downloads.
