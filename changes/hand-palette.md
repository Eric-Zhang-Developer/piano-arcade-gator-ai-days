## What shipped
A Lab experiment at `/play?song=fur-elise&bot=perfect&x=hand-palette&p=A|B|C&sim=normal|protan|deutan|tritan`. It shows three hand and judgment palettes:
- A is today's, plus a swallowtail notch on left-hand notes;
- B is blue and orange, with fever in hype magenta;
- C is blue and rose.

`&sim=` adds a colour-blind simulation. The palettes are measured with CIEDE2000 under Machado 2009's model, and B and C meet every target in the spec's table. No token changed: `not picked by Eric`.

## Where it lives
- `web/src/game/x/hand-palette/`: the color math, the candidates, the plugin and its tests.
- `web/src/game/x/index.ts`: its registry line.
- `specs/decisions/hand-palette-candidates.md`: the full table.
- `specs/decisions/hand-palette-override.md`.
- `specs/features/experiments/shots/hand-palette/`.

## How to check it
`pnpm -C web exec vitest run --passWithNoTests src/game/x/hand-palette` passes. It checks CIEDE2000 against Sharma 2005's 34 pairs, the targets per candidate, and today's known failures.

No browser check: not verified locally beyond the look loop's shots.

## Gaps
- **Unreachable readers** keep today's colors: the highway's judgment word, the start screen's song preview, and the DOM's CSS tokens.
- **Shots:**
  - 1920×1080 has normal and deutan only; 1280×720 has all four simulations.
  - Shots are 800×450 captures from a hidden pane.
  - No reduced-motion shot: the experiment adds no motion.
- **Perf gate:** `perf.mjs --params x=hand-palette` not run.
