---
name: "Touch visible: MIDI velocity scales each hit's visual energy, from a soft wisp to a ringing bloom"
depends_on: ["core-loop", "scenes", "hit-particles", "juice-visual", "key-polish", "miss-moment", "fever-arc", "demo-performance", "dynamics", "perf-budget"]
owns: ["specs/features/touch-visible/", "changes/touch-visible.md", "specs/decisions/touch-visible-", "web/src/game/touch-visible/"]
assignee: "eric"
---

# Touch visible

Issue #1350. It's a hero-tier polish item (#856): MIDI velocity scales a hit's visual energy. A pp PERFECT is a single
soft wisp, and an ff chord blooms wide with a shockwave ring. The bot's demos swell and fade with their printed dynamics
(demo-performance). It's a normal game-lane change with the design pass, and it has no flag.

## The pitch's claims, checked on origin/main
- **Velocity enters at the device:** `core/input.ts:26` puts the MIDI note-on's velocity on each `InputEvent`
  (`contracts/index.ts:90`). Laptop keys send 80 (`TakeEvent`, `contracts/index.ts:33`).
- **It reaches the take and the results dynamics card, not the judge:**
  - `/play` writes it to `take.events` (`app/play/page.tsx:208`);
  - the dynamics card reads it from there (`dynamics/index.ts:45`, `panel.tsx`);
  - **the judge never reads it:** `core/judge.ts` has no `velocity`, and `noteHit` carries `noteId`, `pitch`,
    `judgment` and `offsetMs` only (`contracts/index.ts`, `GameEvent`).

  So the pitch's "velocity reaches the judge" holds only for the event stream around it.
- **No visual reads it:** `velocity` appears nowhere in `hit-particles/`, `juice/`, `key-skin/` or `core/highway.ts`.
- **Bot and demo playback carry the chart's velocities in the same stream:** scenes builds each press from the chart
  note's `velocity` (`scenes/index.ts:93`) and emits an `InputEvent` with it (`:158`, `KEYS_VELOCITY` when a note has
  none). So a plugin that wraps the input after scenes sees the bot's velocities exactly like a player's.
- **Charts with real dynamics** (counted on main; the number of distinct velocities):
  - chopin-fantaisie-impromptu: 78, from 17 to 112;
  - debussy-arabesque-1: 46, from 33 to 97;
  - chopin-revolutionary: 41;
  - minute-waltz: 28;
  - nocturne-op9-2: 22;
  - chopin-prelude-20: 17, from 33 to 127;
  - mozart-545-1: 17;
  - moonlight-3, the pitch's guess, has only 2 (49 and 65), so it's a poor crescendo strip;
  - ten charts have no velocities (twinkle, ode-to-joy and others), which exercises the 64 ± 20 seed.

## How it reaches the visuals
`noteHit` has no velocity, and `web/src/contracts/` is frozen, so this pass doesn't change the event:
- **a new plugin,** `touchVisible()` in `web/src/game/touch-visible/`, mounted in `layers.ts` right after `scenes()`
  under the mount rule (an import and an entry, at most 4 added lines);
- **its `wrapInput`** taps each note-on's velocity by pitch;
- **its `onEvent`** matches each `noteHit` to the latest unmatched note-on of that pitch (the window logged) and keeps
  the hit's energy;
- **the visuals ask it:** `energyOf(noteId)` or `energyAt(pitch, atMs)`;
- **the other route** is a `contract:` PR adding an optional `velocity?` to `noteHit` (additive, seen by both people).
  It's logged as a choice, not taken.

## The pass
1. **Normalize per take:**
   - a velocity's percentile within the take's running distribution;
   - seeded from the chart's velocities, or 64 ± 20 when the chart has none;
   - laptop keys (a fixed 80) land mid-range.
2. **A compressive curve,** from the normalized value to energy:
   - **the exponent** is a named setting (`touchSettings.exponent`), and its value is a logged design choice. The
     pitch cites Stevens' brightness exponent (about 0.33–0.5). It's kept only if the worker cites a source they
     read; otherwise the spec calls it a design choice;
   - **energy scales:**
     - the contact bloom's radius;
     - the spark count and speed, inside `hit-particles/pool.ts`'s bounds (`capPerSec` 6000, `burstShare` 0.2, the
       governor);
     - the key light's brightness;
   - **the top ~10%** get a thin shockwave ring, drawn by this plugin on the overlay;
   - **the bottom ~10%** get one wisp and no sparks;
   - **the judgment** still owns the kind and the color.
3. **Order is kept:**
   - a pp PERFECT is still brighter than any miss (the Miss principle, #1038);
   - fever's palette (fever-arc, #1150) still applies over energy.
4. **Reduced motion:** velocity scales brightness only, with no ring and no spark speed.

## Held files first
Checked when this spec was written; re-check each before any edit.

| File | Owner (done) | Holder | This pass | If held |
|---|---|---|---|---|
| `web/src/game/touch-visible/` (new) | this feature | | tap, normalizer, curve, ring | |
| `web/src/game/layers.ts` | (mount rule) | | the 2-line mount after `scenes()` | |
| `web/src/game/hit-particles/` (`pool.ts`, `gl.ts`) | hit-particles | free | an energy-scaled spawn count and speed, still under the cap | |
| `web/src/game/juice/index.ts` | juice-visual | **#761** (draft, stale since 08:49; Eric's) | the spawn call site: wisp, spark count, speed and bloom radius read energy | a one-call swap after #761 merges or closes |
| `web/src/game/key-skin/index.ts` | key-polish | **#600** (abbasi2010) | the key light's brightness reads energy | **a follow-up after #600**, with the switch line in the PR |
| `web/src/game/core/highway.ts` | core-loop | **#747** (waiting on Eric's go), **#600** | nothing | |
| `web/src/game/hud/` | hud | **#713**, **#600** | nothing | |

- **What ships first:** the tap, the normalizer, the curve, the ring, and the energy-scaled spawns in `hit-particles/`.
- **What waits:** the juice call site (#761) and the key light (#600). Each gets a switch line (`ponytail:`) at the one
  call that changes. Whichever holder frees first, that part lands as a `fix(touch-visible)` follow-up.
- **#761 is stale.** If the planner closes or merges it first, the juice part rides in this PR.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`: at most 3 rounds, per AGENTS.md (the pitch's 5 isn't the rule), fixing the
  top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**Unit tests** (`pnpm -C web exec vitest run src/game/touch-visible src/game/hit-particles src/game/juice`):
- **the normalizer** on a scripted take: percentiles from the chart seed, from the 64 ± 20 seed, and as the take's
  own distribution takes over; a fixed-80 laptop take sits mid-range;
- **the matcher:** a chord of 10 pitches at one onset matches each hit to its own velocity, and a repeated pitch takes
  the latest unmatched note-on;
- **the curve:**
  - energy rises strictly across 8 velocity steps (16, 32, … 127);
  - the ff:pp ratio sits in a designed range, about 3–5× from the pitch, logged as a design choice, not a fact;
- the spawns stay inside `pool.ts`'s cap at ff on a 10-note chord;
- reduced motion gives brightness only.

**Measured energy, with #1038's luminance method:**
- **the method:** miss-moment's `playfieldLuma` (`miss-moment/index.ts`) draws the highway and overlay canvases into a
  64×36 probe and averages Rec. 709 luma weights (0.2126, 0.7152, 0.0722) over the playfield above the keyboard, on the
  encoded pixel values. An event's effect is the mean over the 300 ms after it minus the mean over the 100 ms before
  (`miss-moment/verify-miss.mjs:56`);
- **the bars:**
  - a pp PERFECT's effect is above a MISS's;
  - an ff PERFECT's effect over a pp PERFECT's falls in the designed ratio range.

  Measured in the in-app browser with the probe on, 3 runs each.

**Perf** (perf-budget's own bar):
- maple-leaf-rag with `bot=fever`, on its ff chords, at 1920×1080;
- perf-budget's `probe.js` (`__perfProbe.report()`), which times each rAF callback: per-frame work time, not rAF
  intervals;
- 3 runs before (origin/main) and 3 after;
- p95 ≤ 16.7 ms, and within the before runs' spread;
- `perf.mjs` itself runs locally only under `verify.lock`.

**Shots** at 1280×720 and 1920×1080, in `specs/features/touch-visible/shots/`:
- pp, mf and ff PERFECTs side by side;
- a bot crescendo strip on a stretch of rising chart velocities, chopin-prelude-20 by default (the worker picks the
  bars from the chart and logs them);
- a laptop take at a fixed 80;
- reduced motion.

**Eric** (the morning page, ranked low): play one phrase softly, then loudly, on the DGX. The done note says `not seen by
Eric` until he does.

Browser checks: not verified locally; covered by main's scheduled full run.

**The open line:** `/play?song=chopin-prelude-20&bot=perfect` (the query parameter is `bot`, one of scenes' `BOTS`,
`scenes/index.ts:29`), and `/play?song=chopin-prelude-20` on the DGX.

## Gaps (accepted)
- The key light waits on #600, and the juice call site on #761, unless the planner frees them.
- Velocity is matched to a hit by pitch and time, because `noteHit` carries no velocity.

## Defaults
- **In `extras`,** at the end, after crowd.
- Log any choice this spec doesn't make in `specs/decisions/touch-visible-*.md`: the exponent, the ratio, the ring and
  wisp bands, the match window and the seed's width.
- The smaller option; no new dependency, and no contract change.
