---
name: "Song palettes: each song's jacket palette tints the stage's sun and grid"
depends_on: ["fever-stage", "song-jacket"]
owns: ["web/src/game/song-palettes/"]
assignee: "eric"
---

# Song palettes

Every take today has the same stage: a magenta grid and a yellow-to-pink sun (`stageSettings` in
`web/src/game/stage/index.ts`). On video, cuts between songs look like one shot. Each song already has a palette:
song-jacket's `jacketFor(id, …).stops`, picked by the id's hash. Tinting the stage's normal look toward it, at low
strength, gives each song its own stage. The lanes stay calm, and fever still looks the same in every song.

At 2e18582 the ten library charts land on six palettes: orange night (chopin-prelude-4, fur-elise), night to pink
(gymnopedie-1, maple-leaf-rag, moonlight-3), yellow to green (nocturne-op9-2, twinkle), green to cyan
(clair-de-lune), orange to magenta (minuet-g) and violet night (ode-to-joy). Night to pink is close to today's stage.

Issue: #379

## Plan
Three small PRs, the done note last.
1. `feat(song-palettes)`: a pure `stageTint(stops, strength)` in `web/src/game/song-palettes/` returns `{ grid,
   sunTop, sunBottom }`, plus `songStage(chart)`, which is `stageTint(jacketFor(chart.id, chart.title,
   chart.composer).stops, songPaletteSettings.strength)`. Tests.
2. `fix(fever-stage)`: `makeScene(el, opacity, colors = stageSettings)`. The scene takes its normal grid and sun from
   `colors`, and the plugin passes `songStage(chart)`. The hot palette, the sky, the stars and select-stage's call
   don't change. Add `window.__pianoArcadeStage = { grid, sunTop, sunBottom }` (the normal colors in use) as a test
   hook.
3. `feat(song-palettes)`: `verify-palettes.mjs`, the shots and the done note.

## Requirements
- **The tint:** take the palette's most saturated stop (HSL saturation; the first on a tie). The grid, sun top and
  sun bottom each mix toward it by `strength` in RGB (`songPaletteSettings.strength = 0.3`). Sky, stars, the burst
  and every `*Hot` color stay as they are.
- **Fever is fever:** at heat 1 the stage is exactly today's hot palette in every song. The tint only changes where
  the stage starts from and returns to.
- **By id:** the tint comes from the chart id alone, so a bar-loop, `hands` or versus take of a song has its stage.
  A `local/` song gets its hash's palette too.
- **Calm lanes:** fever-stage's cap is unchanged (canvas opacity `maxLaneLuma / (1 - stageBackdropAlpha)`), so no
  palette can push a pixel behind the lanes past `maxLaneLuma`.
- **Chrome only:** every tinted color mixes stage colors and jacket stops (cabinet colors), never a hand color.

## Validation
- `pnpm -C web test` (song-palettes), over every palette `jacketFor` can give (ids `s0`…`s999` give all ten; the
  test asserts it finds ten):
  - each tinted color's relative luminance × the canvas opacity × `(1 - stageBackdropAlpha)` is at most
    `maxLaneLuma`;
  - the hot palette is unchanged;
  - `strength` 0 gives today's colors, and the same id gives the same colors;
  - ΔE76 from `--pa-hand-r` and `--pa-hand-l` is at least 20 for every tinted color.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/song-palettes/verify-palettes.mjs --out <dir>`. It prints `verify-palettes: pass` and exits 0,
  or names each failure and exits 1. `/play?song=<id>&input=test` for twinkle, ode-to-joy and fur-elise (three
  palettes) at 1920×1080, Start:
  - `__pianoArcadeStage` equals `songStage` for each;
  - one screenshot mid count-in: the median color of a fixed box around the sun differs pairwise by ΔE76 ≥ 4;
  - the same box's 95th-percentile luminance is at most `maxLaneLuma`.
  It fails on main today: there's no hook, and all three medians match. Keep the three screenshots side by side.
- `verify.py --slug song-palettes` and `node web/src/game/stage/verify-stage.mjs --out <dir>` pass. Eric (mark it in the done note): three songs on the video's setup. Do they look like different stages, and does
  fever still read as fever on Für Elise's orange night?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
`design-taste-frontend`'s step 8, "Look", at 1280×720 and 1920×1080 plus reduced motion (one still frame), for the
three songs and one take into fever. Before and after screenshots go in the PR.

## Defaults
- Strength 0.3 and the ΔE thresholds are starting values for the Look and Eric, not findings.
- The music select keeps today's stage. Tinting it to the focused card is a later idea, not this spec.
- If orange night's grid reads as fever in the Look, tint it toward the palette's other stop. Log choices in
  `specs/decisions/song-palettes-*.md`.
