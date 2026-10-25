---
name: "Duo HUD: the bracketed combo, a white-hot hit line and motion juice on the playfield"
depends_on: ["duo-tokens", "hud", "core-loop", "juice-visual", "bar-lines"]
owns: ["specs/features/duo-hud/", "changes/duo-hud.md", "web/src/game/duo-hud/", "specs/decisions/duo-hud-"]
assignee: "eric-agent-1"
---

# Duo HUD

Issue #647. The playfield in the Duo look (`specs/context/visual-direction.md`, frame `F-duo-2-playfield.jpg`).
**The cold open is shot on this screen:** a black room, the LED strip, Eric plays, the combo climbs. So it ships
first among the screens.

**Interactive (Eric, 2026-10-25: "agreed do that").** Eric drives eric-agent-1 directly on this gameplay-screen
overhaul. eric-agent-1 commits on its branch and **does not merge on its own**: Eric gives each merge go, which is an
exception to AGENTS.md's loop step 6 for this feature only. Eric's direction in that session overrides this spec's
layout details. The Duo rules in visual-direction.md and the kit still hold. Build on the Duo kit from duo-tokens as
it lands, not alongside it. The black-key lane shading and the non-fever stage are already removed by their own
`fix:` PR.

## What exists (origin/main, 2026-10-25)
- **The HUD band** is `web/src/game/hud/index.ts:119-131` (hud). From left to right: the song card at 0–28%,
  PERFECT/GREAT/GOOD at 28–44%, the combo at 44–56%, MISS/WRONG at 56–66%, and the score and multiplier at 66–100%.
  A 2 px tier rule sits at :170. The combo swell is at :23-28 and :226. Labels use system-ui (:32).
- **The judgment word and its ms readout** are drawn by core (`core/highway.ts:295-315`, placed by `judgmentPlace`
  :27).
- **The hit line** is `core/highway.ts:244-263`: white at 0.6 alpha, 3 px, a white glow (shadowBlur 10). Its path
  comes from hit-line.
- **Note pills:** `core/highway.ts:147-156`, `radius = 6`.
- **Juice** (juice-visual): flares at `juice/index.ts:192`, sparks while a note is held (:156-160).
- **Song progress:** there is none. Bar numbers are only on the highway (bar-lines).
- **Canvas interface badges with rounded corners:** `wait-hud/index.ts:54`, `flow-mode/index.tsx:132`,
  `watch-demo/index.tsx:60`, `laptop-octaves/index.tsx:120`, `first-run/index.tsx:75`.

## Plan
1. **`fix(hud)`:** the band becomes two bracketed clusters:
   - **top left:** the song tag (the title in monospace caps, `BAR n / N`, a thin progress line in `--pa-primary`);
   - **top right:** the combo cluster (a big condensed combo numeral, `COMBO`, then `ACC` and `SCORE` in monospace).
   - Corner brackets come from the Duo kit's `drawBrackets` (duo-tokens). The PERFECT/GREAT/GOOD and
     MISS/WRONG counters move into the combo cluster as one small monospace line, or drop if the cluster gets crowded
     (log it).
2. **`fix(core-loop)`:**
   - **The hit line:** white-hot, 2 px, with a faint purple-to-blue glow (`--pa-secondary` → `--pa-primary`, low
     alpha).
   - **Note pills:** about 2 px radius.
   - **The judgment word:** the condensed display face and the monospace ms readout, near the right end of the hit
     line, as in the frame. If moving it collides with judgmentPlace's fever rule, keep its place and only restyle it.
3. ~~`fix(juice-visual)` sparks~~: dropped for hit-particles (#750, Eric 2026-10-25).
4. **One `fix(<slug>)` per overlay** with rounded canvas badges (wait-hud, flow-mode, watch-demo, laptop-octaves,
   first-run): radius 0, hairline frames.
5. **`feat(duo-hud)`:** `verify-hud.mjs`, the screenshots, the done note.

## Requirements
- **Use the Duo kit** (`web/src/game/duo-tokens/`, from duo-tokens, #645) for every bracket, panel, data cell and
  label, through its canvas twins (`drawBrackets`, `drawPanel`, the font strings). Don't draw your own. If the kit
  lacks something, add it to the kit through a `fix(duo-tokens)`, not locally.
- **The center doesn't move:** lanes and notes stay calm. Effects rise above the hit line and never cover a note due
  within 500 ms (juice-visual's rule).
- **`BAR n / N`:**
  - `N` is the chart's bar count, by the same bar math bar-lines draws with. Reuse it, don't re-derive.
  - `n` is the bar at the hit line now.
  - The progress line is the clock ÷ the chart's end.
- **Judgment colors on the HUD:** gold, red and grey appear only for judgments (PERFECT, WRONG ✕, MISS), never on
  chrome. GREAT's mint (`hud/index.ts:19`) stops matching a hand color: the worker picks GREAT within
  visual-direction.md (white or ink is the frame's choice) and logs it.
- **Readable on video:** the combo numeral is at least 64 px at 1920×1080, and labels at least 16 px.
- **Reduced motion:** the swell is off. Hit effects' reduced motion is hit-particles' (#750).
- **Fever:** the stage's short moment is fever-stage's (duo-tokens). The HUD adds nothing for it.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/duo-hud src/game/hud`: the bar readout's `n / N` on Twinkle
   and Für Elise matches bar-lines' bar starts (first bar, a middle bar, the last bar), and the clusters use the kit's
   `drawBrackets`, with no local bracket code.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug duo-hud --worktree . --cmd "node {worktree}/web/src/game/duo-hud/verify-hud.mjs --out {out}"`.
   It plays `/play?song=fur-elise&bot=perfect` (Start pressed; not `&input=test`, whose test device replaces the
   laptop keys the bot plays) and prints `verify-hud: pass` or names each failed step:
   1. The HUD test hook (`window.__pianoArcadeHud`, add it if missing) reports `bar` rising from 1 to N, and `combo`
      rising.
   2. Screenshots `hud-mid.png`, about 20 s in, at 1280×720 and 1920×1080, plus `hud-reduced.png`.
3. Eric shoots 10 s of the cold open on the DGX with the LED strip. Is it the look in `F-duo-2`? Mark it in the done
   note.

## How it's built and checked
Follow `specs/context/visual-direction.md`, build with the `frontend-design` skill, and review with taste v2's step
8, "Look", at 1280×720 and 1920×1080 plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- **Second in the restyle, after duo-tokens,** because the cold open needs it. Cut by Sunday noon (2026-10-25
  12:00 ET).
- Log any choice this spec doesn't make in `specs/decisions/duo-hud-*.md`.
