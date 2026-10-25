---
name: "Fever arc: fever as one designed state, build-up, drop, sustain and release, each a cue on the beat"
depends_on: ["fever-gauge", "fever-moment", "fever-stage", "juice-visual", "juice-sound", "milestone-sfx", "hit-particles", "miss-moment", "results-landing"]
owns: ["specs/features/fever-arc/", "changes/fever-arc.md", "specs/decisions/fever-arc-", "web/src/game/fever-arc/"]
assignee: "eric"
---

# Fever arc

Issue #1150. Eric, 2026-10-25, asked for polish pitches with hit-particles' depth on one moment. In #856's terms,
this is a **hero-tier** item. It's a normal game-lane change with the design pass, and it has no flag.

**Today (origin/main), fever is five pieces with their own easing:**

| Piece | Where | What it does |
|---|---|---|
| The meter | `fever-gauge/index.ts` | flat amber `#ffb02e`, filling to full; FEVER lit while it lasts |
| The moment | `fever-moment/index.ts` | a 2 s edge flash and FEVER banner (`momentSettings.totalMs`), in the Duo amber since #926 |
| The stars | `stage/index.ts` | a three.js star field that streaks in fever, `feverEaseMs: 400` in and out (#743, #794, #665) |
| The edges | `juice/index.ts:130-157` | a steady edge and top glow, `feverColor: "255, 140, 60"` |
| The LEDs | #720 (`fix(led-strip)`, Sharan's lane, open) | fever lights on the strip, in firmware |

The judge turns fever on with `feverStart` when the gauge fills (`core/judge.ts:74`). On Twinkle that's 12 points
(`feverGaugeSettings.minFill`), so `bot=perfect` reaches it at about combo 12. A MISS or WRONG ends it with
`feverEnd`. juice-sound and milestone-sfx sound it from `sound/index.ts:81`. Nobody designed these as one arc.

**The model is the drop:** build-up, then drop, sustain and release, each a cue on the beat.

## The arc
1. **One fever timeline** (`web/src/game/fever-arc/`):
   - a pure `arcAt(nowMs)` over the take's events gives the phase (`idle`, `build`, `ignite`, `sustain`,
     `release`, `handoff`), the phase's progress, and the beat phase;
   - every piece reads it instead of its own constants: the meter, the moment, the stars, the edges, the sparks, the
     near-line glow and the sound;
   - a small plugin keeps it fed from `onEvent`, mounted in `layers.ts` before its readers (the mount rule: at most
     4 lines). The phases are unit-tested.
2. **Build-up:** in the gauge's last ~20%, the meter shimmers and the stars drift faintly.
   - It's subtle, and it passes highway-field's calm rule if that has landed (#1122 is open).
   - Before fever, the stage isn't drawn on normal play (duo-tokens). The drift appears only where the stage is
     mounted, and that's logged.
3. **Ignition:**
   - **The visuals fire on the next beat** after `feverStart`, on the chart's beat grid (`msPerBeat`, from chart time
     0), at most one beat later.
   - **Judging and scoring stay untouched:** the judge, the gauge and `feverStart`'s `atMs` don't change. Only the
     visuals are quantized.
   - **One frame, one clock:** the flash, the banner, the stars' streak-in and milestone-sfx's fever sound all start
     at the ignition time. The sound is scheduled on the audio clock for that time, from the same timeline.
4. **Sustain:** one palette shift:
   - sparks (hit-particles), the near-line note glow (core's `notePolish` glow) and the stars take fever's amber
     accent **through** the hand colors, not over them, so the hands still read. For example, a hue shift or a rim,
     never a fill; logged;
   - the star streak pulses on the beat at a low amplitude.
5. **Release:**
   - **a combo break** (`feverEnd`) powers down over about 400 ms: the stars decelerate and the amber drains from
     the edges inward. It's quiet, per miss-moment's principle (#1058): never louder than a hit;
   - **a natural end** (`songEnd` during fever) hands off to results-landing (#978): the amber drains during its out,
     on its timeline.
6. **Reduced motion:** phases cut on the beat, with no drift, streaks or drain.

## Files, and who holds them
Check again before each edit: `gh pr list`, then each open PR's files. A held file is closed to this PR. Ownership is
open within the eric lane for the fever folders. When this spec was written:

| Step | Files | Held by |
|---|---|---|
| 1, the timeline | `web/src/game/fever-arc/` (new), the mount in `layers.ts` | `layers.ts`: #1013 (count-in). The mount rule lets the line ride along; rebase if it conflicts |
| 2, 3, the meter | `fever-gauge/index.ts` | free |
| 3, the moment | `fever-moment/index.ts` | free |
| 2–5, the stars | `stage/index.ts` | free (miss-moment, #1058, has merged) |
| 3, 5, the edges | `juice/index.ts` | **#761**. The new edges and drain are drawn by fever-moment from the timeline. Juice's steady edge glow switches off with **one line once #761 frees the file**. Until then both draw: log it |
| 4, the sparks | `hit-particles/` (pool and shader tint) | free. The color juice passes stays juice's; the tint is applied inside hit-particles |
| 4, the near-line glow | `core/highway.ts` | **#747** (and #600). A small hook that reads the timeline's tint lands **once #747 frees the file**. Until then the glow stays as it is: log it |
| 3, the sound | `sound/index.ts` | **#600** (abbasi2010), which the planner reads as stale, so it doesn't block. Keep the diff narrow: schedule the fever sound at the ignition time |
| 5, the handoff | `results-landing/` | free |
| 2, the calm rule | `highway-field/` | **#1122** (open): read only. Apply its rule if it has landed |
| The LEDs | `firmware/`, #720 | **Sharan's lane: read only, never edit.** The timeline exports its phases. If #720 lands, the LEDs can read them through a seam Sharan's lane owns: file a `needs-human` issue for `sharan` offering it, and build nothing there |

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`).
- Score each round against `references/critique.md` and fix the top three problems. A hero item gets up to 5 rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) The contact sheet:**
- frames every 100 ms, from gauge 80% → ignition → +2 s → a combo break → +500 ms;
- before and after, at 1280×720 and 1920×1080, plus a reduced-motion strip;
- Twinkle with `bot=perfect` reaches fever at about combo 12;
- **the break** comes from a scripted take: `input=test`, pressing every note through core's test device and skipping
  one after fever starts. No bot reliably misses during fever. Log the URL and the skipped note;
- in `specs/features/fever-arc/shots/`.

**(b) Taste v2:** the score for each round in the PR, up to 5.

**(c) Measured:**
- **Unit tests** (`pnpm -C web exec vitest run --passWithNoTests src/game/fever-arc src/game/fever-gauge src/game/fever-moment src/game/stage src/game/sound src/game/hit-particles`):
  - the phases in order from a scripted event list;
  - ignition on the next beat, at most one beat after `feverStart`, at 60, 100 and 180 BPM, and on the beat when
    `feverStart` lands exactly on one;
  - the judge's `feverStart` time and the results unchanged (a judged take's results are equal with and without the
    timeline);
  - release in about 400 ms, and the handoff on `songEnd`;
  - reduced motion: cuts only;
  - the sound's scheduled time equals the ignition time;
  - each touched feature's existing tests stay green.
- **Live, on your dev server through the in-app browser:**
  - a test hook, `window.__pianoArcadeFever = { frames }`, logs each frame's time, phase and which pieces are lit;
  - **ignition** lands within 1 frame of its beat;
  - **every ignition piece** (flash, banner, stars) lights within 1 frame of the others, and the fever sound's
    scheduled time (mapped to `performance.now()`) is within 1 frame;
  - **frame time during fever at 1920×1080:** Twinkle `bot=perfect` and maple-leaf-rag `bot=fever`, with perf-budget's
    `probe.js`, 3 runs before (origin/main) and after. p95 and spread, with no regression past the before runs'
    spread and p95 ≤ 6 ms. `perf.mjs` itself runs locally only under `verify.lock`; otherwise "not run locally;
    main's scheduled run covers it".

**(d) A WebM of Twinkle's fever with sound,** before and after, for Eric's review page (low rank). Frames are stepped
from the timeline at 60 fps from your dev server, with the fever sound rendered at the same ignition time, encoded
with ffmpeg (installed: `/opt/homebrew/bin/ffmpeg`), and labeled "stepped frames, not a live capture". It goes in
`specs/features/fever-arc/shots/`, a few MB at most.

**Eric** (the morning page): `localhost:3001/play?song=twinkle&bot=perfect`, and `localhost:3001/play?song=fur-elise`
for the sustain. The done note says `not seen by Eric` until he does.

## Gaps (accepted)
- Until #761 and #747 free their files, juice's steady edges stay under the new ones, and the near-line glow keeps
  its color. The done note says which switch-offs shipped.
- The LEDs don't follow the arc until Sharan's lane takes the seam.
- Fever's rules (when it starts and ends) don't change. Only how it looks and sounds does.

## Defaults
- **In `extras`,** after round. round's plan PR (#1126) isn't on main yet, so this PR places it after highway-field.
  Whichever merges second moves its line under the other.
- Log any choice this spec doesn't make in `specs/decisions/fever-arc-*.md`: phase lengths, the shimmer, the tint
  method, the pulse amplitude, and the drain's curve.
- The smaller option; no new dependency; no new sound (milestone-sfx's fever sound is retimed, not replaced).
