---
name: "Versus scores: each half gets its own combo, score and multiplier in the HUD, and the higher score wins"
depends_on: ["versus", "hud", "combo-hud"]
owns: ["web/src/game/versus-scores/"]
assignee: "eric"
---

# Versus scores

Versus's gap (`changes/versus.md`): the HUD keeps one shared combo and score, because the judge has one combo. At
the booth, two players can't see who's ahead, and the winner is decided on accuracy, not score. This gives each half
its own combo, score and multiplier in the HUD band, and the banner goes to the higher score.

Issue: #372

## Plan
Three PRs, in this order:
1. **`fix(versus)`** (`web/src/game/versus/split.ts`, `index.tsx`): `Tally` gains `score`. A hit scores
   `hudSettings.points[judgment] × tierFor(that player's combo before the hit).mult`, which is hud's rule, imported
   and not copied. `winner()` compares scores, and it's DRAW only when they're equal. The results panel leads each
   column with the score, with accuracy and counts under it. The on-lane "n combo · x%" line goes, because the HUD
   now shows it. The P1 and P2 labels stay over each half, in `--pa-ink` instead of the mint note color
   (visual-direction: mint is never text).
2. **`fix(hud)`** (`web/src/game/hud/index.ts`): on a versus take (`?versus=1` and the chart's ids carry `p1:`, so a
   refused song stays plain), the band draws its background, the x1 tier line and the song card, and then stops, as
   it does in wait mode. Plain takes draw exactly as today. Detect it inline, without importing versus: versus will
   import hud, and the two must not import each other.
3. **`feat(versus-scores)`:** a `versusScores()` plugin in `web/src/game/versus-scores/`, registered in `layers.ts`
   right after `hud()` (each plugin draws its own canvas in order, so the band must already be there). It reduces the
   events with versus's own `reduceTallies`, so the HUD and the results panel can't disagree. It draws into the band,
   and the done note goes in this PR.

## Requirements
- **The band:** the split is `frame.keyX(60).x`. P2 (the lower keys) sits left of it, from the song card's right
  edge. P1 sits right of it, up to beat-track's gutter. Each half shows its player's label, score (`en-US` grouping),
  multiplier (`x1`–`x4` in its tier color, with hud's `tierProgress` pips) and combo from hud's `comboFrom` (5).
  Numbers are in the display face, labels in the body face. Text shrinks to fit its half, down to 60%, like hud's
  `fitText`, and never crosses the split.
- **Tiers per player:** a P2 miss resets only P2's multiplier. The band's bottom line stays x1, since there's no
  shared tier.
- **Test hook:** `window.__pianoArcadeVersus = { p1: Tally, p2: Tally }` while a versus take runs.
- **Results:** the winner is "P1 WINS", "P2 WINS" or "DRAW" on score, and each column's score equals the band's last.
- Plain mode, wait mode and a refused song ("This song doesn't fit versus") are unchanged.

## Validation
- `pnpm -C web test`. P1 plays 30 PERFECT then 10 MISS; P2 plays 9 PERFECT and a MISS, four times. P1 must score
  6,000 at 75.0% and P2 3,600 at 90.0%, and the banner must read "P1 WINS", where accuracy alone would pick P2. Equal
  scores give DRAW. An extra at pitch 50 still counts against P2. On a versus chart, hud's draw (with a fake context)
  writes no score text, and on a plain chart it draws as before. hud's and versus's existing tests pass.
- Headless, from a clone: `node web/src/game/versus-scores/verify-versus-scores.mjs --out <dir>` starts its own dev
  server and prints `verify-versus-scores: pass` (exit 0), or names each failed step (exit 1). On
  `/play?song=twinkle&input=test&versus=1&beat=off&stage=off`:
  1. Press every P1 note and P2's first 21 on time (`__pianoArcade.press`). Results: P1 10,800, P2 3,300, "P1 WINS".
     These are hud's rule: 10×100 + 10×200 + 10×300 + 12×400, and 1,000 + 2,000 + 300. The hook matches.
  2. Mid-take screenshots at 1280×720 and 1920×1080, plus reduced motion: two score blocks in the band, none over the
     split or the song card.
- `node web/src/game/versus/verify-versus.mjs --out <dir>` (DRAW at 100%) and `node web/src/game/hud/verify-hud.mjs
  --out <dir>` pass unchanged. So does `verify.py --slug versus-scores`.
- On the piano (Eric and a second player; mark it in the done note): play Twinkle head to head. Each player reads
  their own score at a glance, and the banner names the higher score.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2
(`design-taste-frontend`) step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots
go in the PR.

## Defaults
- No per-player colors: visual-direction has no player token. Labels and side tell the players apart. Asking for
  colors is a `contract:` question for Eric.
- No combo swell or milestone ghost per player. hud's shared one goes with the shared combo.
