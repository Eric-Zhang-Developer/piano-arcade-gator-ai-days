---
name: "Fever moment: fever's start, loud at the edges for at most 2 s"
depends_on: ["fever-gauge", "fever-stage", "juice-visual", "scenes"]
owns: ["web/src/game/fever-moment/"]
assignee: "eric"
---

# Fever moment

Fever starts with juice-visual's steady edge glow and the meter's lit FEVER label: nothing to cut on. This makes the
start a moment, loud at the edges, then out of the way.

## Which charts reach fever (counted from `web/public/songs/*/chart.json`, 2026-10-24)
The gauge (`fever-gauge/gauge.ts`) fills at `clamp(round(notes / 4), 12, 50)` points: PERFECT 1, GREAT 0.5, GOOD 0.
So an all-PERFECT take reaches fever at a combo equal to the gauge, on all ten charts:
- **Gauge 50, fever on the 50th PERFECT, the same hit as the combo-50 milestone:** maple-leaf-rag (552 notes, 3.5 s
  after the first note), moonlight-3 (206, 7.5 s), fur-elise (294, 10.0 s), nocturne-op9-2 (267, 10.0 s),
  chopin-prelude-4 (305, 10.9 s). All two-handed, so every hero candidate gets fever.
- **Smaller gauges:** twinkle (42 notes → 12, 7.2 s, right hand only), gymnopedie-1 (68 → 17, 7.5 s), clair-de-lune
  (79 → 20, 9.5 s), ode-to-joy (122 → 30, 10.5 s), minuet-g (128 → 32, 12.6 s, right hand only).
- All GREAT needs twice the gauge (the 100th hit on the long five); every chart has enough notes. All GOOD never
  fills it. `?hands=R|L` counts only the played hand's notes, so its gauge is smaller.

## Plan
1. **A `fix(fever-stage)` PR** (`web/src/game/stage/index.ts`): `reduceStage`'s `feverStart` also sets `flashAtMs`,
   reusing the 150 ms count-in grid flash; the opacity cap keeps lane luma under `maxLaneLuma`. black-key-lanes and
   select-stage plan `fix(fever-stage)` PRs too: the later one rebases.
2. **`feat(fever-moment)`:** the plugin in `web/src/game/fever-moment/` (pure `moment(nowMs, startAtMs, endAtMs)`, the
   draw, tests, `verify-moment.mjs`), one line in `layers.ts` between `hud()` and `beatTrack()` (over the HUD band,
   under beat-track's status line), and the done note.

## Requirements
- On `feverStart`, three parts, all done within 2 s:
  - **Edge flash:** the sun gradient (ui-tokens' `sunFrom` → `sunTo`) up the left and right edges, wider and
    brighter than juice's steady glow, peaking in about the first 200 ms and fading into it. Its alpha also falls to 0
    toward its lowest line, so there's no hard cut where juice's full-height glow continues below.
  - **Banner:** "FEVER" in Saira 900 italic, sun gradient, inside the HUD band (`hudLayout(...).panel.h`), where the
    opaque band hides every note. It sweeps in, holds and goes, covering the band's counts, combo and score meanwhile.
  - **Stage:** the grid flash from step 1, on top of fever-stage's own 400 ms ease to its hot palette.
- **Never over a note due within 500 ms:** nothing below `judgmentLineY × (1 − 500 / lookaheadMs)` (0.75 L today).
- `feverEnd` within the 2 s ends it at once; a later `feverStart` plays it again. `songStart` and `quit` clear it;
  `songEnd` clears its canvas, as juice does (`/play` stops drawing at the results, so a frame would stay under them).
  Drawn against `Frame.nowMs`, so Esc freezes it.
- Reduced motion: no edge flash and no sweep; the banner shown at once, still, for 1 s. The stage already holds still.
- `window.__pianoArcadeFeverMoment = { startAtMs, lastDrawnAtMs }` (chart clock) for the headless check.

## Validation
- `pnpm -C web test`: `moment` is 0 before the start, from 2 s on, and after `feverEnd`. The draw, recorded with a
  fake context (`hud.test.ts`'s Proxy, plus gradients) at 1024×768, 1280×720 and 1920×1080, +0/+200/+1000/+1999 ms:
  the banner within `panel.h`, every other fill's bottom ≤ 0.75 L; nothing at +2000 ms or after `feverEnd`.
- `node web/src/game/fever-moment/verify-moment.mjs --out <dir>` (verify-fever.mjs is the model):
  1. `/play?song=minuet-g&bot=fever&beat=off` at 1920×1080 (fever on the 32nd hit, notes still falling): wait for
     `__pianoArcadeFeverGauge.fever`, screenshot at +0, +200 ms and +2 s. Again at 1280×720 and with reduced motion.
  2. `/play?song=maple-leaf-rag&bot=perfect&beat=off` at 1920×1080 (two hands; fever and combo 50 on one hit): +200 ms.
  Each run fails unless `lastDrawnAtMs` ≤ `startAtMs` + 2000 once 2.5 s have passed.
- `verify.py --slug fever-moment` passes.
- Eric's eye (mark it in the done note): does fever's start read as a moment. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with
`design-taste-frontend`'s step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots.

## Defaults
- One loud thing: on the long five the banner and combo-hud's 50 swell start on one hit; the banner draws over it.
  Fever within 2 s of the last note can overlap clear-card's card, which draws on top: left so.
- A long note's body can reach above the 0.75 line, under the flash; clip it with juice's per-note zone only if the
  look review shows it.
- Found, not this feature: juice's steady fever edges draw outside its clip (the fever block runs before `clearZone`)
  over the edge lanes, where `makeLayout` puts the chart's lowest and highest pitches. A separate `fix(juice-visual)`.
- No new dependencies. Log a choice the spec doesn't make in `specs/decisions/fever-moment-*.md`.

Issue: #256.
