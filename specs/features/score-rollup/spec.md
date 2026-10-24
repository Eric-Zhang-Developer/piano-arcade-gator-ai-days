---
name: "Score roll-up: the HUD score rolls to each new value, the multiplier flashes on tier-up"
depends_on: ["combo-hud"]
owns: ["web/src/game/score-rollup/"]
assignee: "eric"
---

# Score roll-up

The HUD score jumps to each new value, and the multiplier badge changes color with no beat. Arcade numbers roll.

## Plan
1. **A `fix(hud)` PR** (`web/src/game/hud/index.ts`, `hud.test.ts`): the pure `rollup(from, to, elapsedMs)` and
   `tierFlash(elapsedMs)` beside the swell, their lengths in `hudSettings`, and `drawHud` drawing the shown score and
   the badge's flash from them. The roll's state (from, target, start time, last tier-up) lives in the plugin's
   closure, not in `HudState`, so `reduceHud` and its tests don't change.
2. **`feat(score-rollup)`:** the done note and screenshots (hud-skin's pattern, #200 after #206). The math stays in
   hud: a module in `web/src/game/score-rollup/` would need a third PR merged before the `fix(hud)` that imports it.
- **drawHud order:** combo-hud first (depends_on), so this starts from its slots and changes only the score's text
  and the badge in `drawHud`, not the layout. wait-hud's `fix(hud)`, if still open, and this one: the later rebases.

## Requirements
- **Score:** when the score changes, the shown score rolls from what's on screen to the new value in 200 ms
  (150–250 ms), ease-out cubic, whole numbers only. It reaches the target exactly, never passes it and never goes
  down. A hit mid-roll starts a new roll from the shown value. On the densest chart (maple-leaf-rag, 552 notes in
  38 s) rolls restart before they end; the shown score still never goes down and settles within 200 ms of the last hit.
- **Multiplier:** when the tier goes up (x1 → x2 at a combo of 10, x2 → x3 at 20, x3 → x4 at 30), the badge flashes
  its new tier color for about 250 ms: a glow and a slight scale that settles at 1, inside the HUD band. A tier drop
  (a break) doesn't flash; climbing again after it does.
- Reduced motion: the score jumps and the badge doesn't flash.
- Times come from `Frame.nowMs` and the events' `atMs`, so Esc freezes a roll mid-way. `songStart` resets both.
- `HudState.score` stays exact at every event: `window.__pianoArcadeHud`, the results screen and `verify-hud.mjs`
  agree as before. Under fever-moment's banner the roll goes on unseen.

## Validation
- `pnpm -C web test`:
  - `rollup` equals `from` at 0 and exactly `to` at 200 ms and after; it's whole, never decreases and never passes
    `to`; restarted mid-roll it continues from the shown value. `tierFlash` is 0 from 250 ms on.
  - The draw, recorded with a fake context (`hud.test.ts`'s Proxy, recording `fillText` too): 100 ms after a hit
    the score text is strictly between the old and new values; at 200 ms it's exactly the new value. The badge glows
    within 250 ms of x1 → x2 and not after a drop. Under reduced motion: the target at 0 ms and no glow.
- hud's tests and `node web/src/game/hud/verify-hud.mjs --out <dir>` pass unchanged.
- Headless screenshots for the PR, `/play?bot=perfect&beat=off` (Twinkle) at 1280×720 and 1920×1080: mid-roll and
  at the x2 tier-up; the same pair with `reducedMotion: "reduce"`. The fake-context test is the gate; frame timing
  in a headless browser isn't.
- `verify.py --slug score-rollup` passes.
- Eric's eye (mark it in the done note): does the score feel alive without pulling your eye off the notes.
  `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with
`design-taste-frontend`'s step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots.

## Defaults
- 200 ms and 250 ms are `hudSettings` entries. The score stays right-aligned in combo-hud's slot.
- No new dependencies. Log a choice the spec doesn't make in `specs/decisions/score-rollup-*.md`.

Issue: #258.
