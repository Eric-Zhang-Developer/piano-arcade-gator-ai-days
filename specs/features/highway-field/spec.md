---
name: "Highway field: the dark space the notes fall through gets depth, a line hierarchy, a downbeat and light spill"
depends_on: ["core-loop", "bar-lines", "black-key-lanes", "key-polish", "note-pills", "fever-stage", "hand-colors", "perf-budget"]
owns: ["specs/features/highway-field/", "changes/highway-field.md", "specs/decisions/highway-field-", "web/src/game/highway-field/"]
assignee: "eric"
---

# Highway field

Issue #1114. Eric, 2026-10-25, asked for polish pitches with hit-particles' depth on one thing. In #856's terms, this
is a **hero-tier** item. It's a normal game-lane change with the design pass, and it has no flag.

**Today (origin/main, `core/highway.ts:188-208`):**
- a flat `#000` fill (or `rgba(0,0,0,backdropAlpha)` over a background layer);
- `drawBlackKeyLanes`, which draws nothing: `blackKeyLaneSettings.tint` is 0 ("0 turns the shading off", Eric,
  2026-10-25);
- C octave lines at white 0.08, 1 CSS px wide, through the perspective;
- bar lines at 0.12, with their numbers at 0.2 (`barLineSettings`).

It's a void.

**Two corrections to the pitch, from the code:**
- **Black-key lanes are off, not at 0.04.** This pass keeps them off unless the look loop and Eric want them back:
  turning them on is Eric's call, so ask through the morning page and don't decide it here.
- **There's no `maxLaneLuma` 0.35 cap in `black-key-lanes` or anywhere in `web/src/game`.** The 35% is the notes'
  far brightness (`pillSettings.farBrightness`), and the cap that exists is bar-lines' calm rule (below). This spec
  uses that rule for every field pixel, fever included.

## The pass
1. **Atmospheric perspective:**
   - lines fade toward the top;
   - a soft horizon band about 10–12% of the height sits at the far end;
   - both agree with the notes' existing approach brightening, from `farBrightness` (35%) at the top to 100% at the
     line (note-pills' `brightness`).
2. **Line hierarchy:** bar lines, then C octave lines, then the optional E/F and B/C seams (logged on or off).
   - Each is a hairline 1 device pixel wide (`1 / devicePixelRatio` CSS px), with its endpoints snapped to
     device-pixel centers.
   - A slanted line through the perspective still anti-aliases: that's the floor. The bar is that it doesn't read as
     a 2-pixel smear at dpr 2.
3. **The downbeat:** a bar line brightens for about 120 ms as it crosses the hit line, on the chart clock (`nowMs`),
   the same one the notes use. The hit line's own look stays untouched (#747 is restyling it).
4. **Light spill:** a held key's light pools about 40 px up its own lane in the hand's color, fading with distance.
   - It reads as **one light** with key-polish's held-note feed (`notePolish.heldGlow`) and its release fade
     (`notePolish.releaseMs`), from the same pressed set and colors.
   - juice-visual's existing lane light ("a pressed key's lane glows faintly up from the line") would double it. That
     goes once juice frees (#761 holds `juice/index.ts`), as a one-line switch-off. Log which state shipped.
5. **No banding:** a blue-noise dither of about 1–2% on the gradients, baked into the static layer.
6. **Fever:** the horizon takes the fever stage's tint subtly, read from what fever-stage exports, or from its palette's
   constant if it exports no live tint (logged). It's imported and never edited: #1058 holds `stage/index.ts`. The calm rule still holds.
7. **Performance:** the static parts (fill, horizon, lane lines, dither) render to an offscreen canvas once per layout
   (resize, `static-keyboard` range, perspective). Each frame blits it and draws only the dynamic bits: bar lines,
   the downbeat and the spill.
8. **Reduced motion:** no downbeat flash, and the spill appears and goes with no easing.
9. **The calm rule** (bar-lines, `specs/context/visual-direction.md`): no field pixel is brighter than the dimmest
   note. That covers lines, horizon, spill and the fever tint. It's measured as bar-lines measures it: luma on sRGB,
   against `farBrightness × min(luma(hand colors))`.

## How it's built
- **The module:** `web/src/game/highway-field/` has:
  - pure functions for each layer's colors and alphas;
  - `bakeField(L, dpr)` for the offscreen static layer;
  - `drawField(ctx, L, s, cache)` for the per-frame part.
- **No plugin or layer route reaches it.** The field draws on the highway canvas *under* the notes, before them in
  `drawHighway`:
  - a `draw` plugin paints the overlay canvas above the notes, which would break the calm rule's "under the notes";
  - the one background layer slot behind the highway is fever-stage's, and /play takes the first plugin that has one.

  So the field needs a hook in `highway.ts`: lines 188-208 (fill, lanes, octave lines and the `drawBarLines` call)
  become one `drawField(...)` call. That's about 20 lines out and 2 in.
- **Who holds `highway.ts`:** #747 (the hit line and judgment word in the Duo look, waiting on Eric) and #600. The
  planner reads #600 as stale, so it doesn't block. The hook lands after #747 merges, rebased on it. Until then:
  - build and test the module;
  - do the look loop on a local branch stacked on #747's head, and don't push that stack;
  - keep the PR a draft.

  If #747 is still open when the rest is done, tell the planner instead of waiting.
- **Other files:** `bar-lines/` (its `drawBarLines` moves under `drawField`, or is called from it), `black-key-lanes/`
  (kept off), and `key-polish`'s settings (read, not edited). Check open PRs on each file first (`gh pr list`, then
  each PR's files).

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`).
- Score each round against `references/critique.md` and fix the top three problems. A hero item gets up to 5 rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Shots:** before and after at 1280×720 and 1920×1080, in `specs/features/highway-field/shots/`:
- mid-song on `fur-elise` and `maple-leaf-rag` (`bot=perfect`);
- fever on and off (`bot=fever` on maple-leaf-rag);
- a held chord with spill (`mode=wait`, holding a chord);
- the same set under reduced motion.

**(b) Taste v2:** the score for each round in the PR, up to 5.

**(c) Measured:**
- **The calm rule, as a test** (`pnpm -C web exec vitest run --passWithNoTests src/game/highway-field src/game/bar-lines src/game/black-key-lanes`):
  - every layer's peak luma (lines with the downbeat, horizon, spill at its brightest, fever tint) is ≤ the dimmest
    note's, computed from the settings, so a brighter setting fails;
  - the hierarchy: bar > octave > seam in alpha at every height;
  - the downbeat lasts about 120 ms and is absent under reduced motion;
  - the spill fades to 0 by about 40 px;
  - `bakeField` runs once per layout, not per frame (a counter);
  - bar-lines' and black-key-lanes' tests stay green.
- **Banding:** from a 1920×1080 capture on your dev server, take the horizon band's row means (mean luminance per row
  across the band). The largest step between adjacent rows is ≤ 1 8-bit level after the dither. Before and after
  numbers go in the PR. Row means keep the dither's own pixel noise out of the measure.
- **Perf:** maple-leaf-rag at 1920×1080 with `bot=fever`, measured on your dev server through the in-app browser
  with perf-budget's `probe.js` (`__perfProbe.report()`), 3 runs each before (origin/main) and after. Report p95 and
  spread. The bar is no regression past the before runs' spread and p95 ≤ 6 ms. `perf.mjs` itself runs locally only
  under `verify.lock`; otherwise "not run locally; main's scheduled run covers it".

**Eric** (the morning page):
- `localhost:3001/play?song=fur-elise&bot=perfect`;
- `localhost:3001/play?song=maple-leaf-rag&bot=perfect`;
- a held chord in a Learn take, `localhost:3001/play?song=fur-elise&mode=wait`.

Also put the black-key-lanes question to him: back on, or off. The done note says `not seen by Eric` until he does.

## Gaps (accepted)
- Black-key lanes stay off unless Eric says otherwise.
- Slanted hairlines anti-alias through the perspective. Snapping keeps them as crisp as a slanted line can be.
- Until #761 frees juice, its lane light may sit on top of the spill.

## Defaults
- **In `extras`,** after take-graph-pass.
- Log any choice this spec doesn't make in `specs/decisions/highway-field-*.md`: the horizon's height and curve, the
  seams, the spill's falloff, the dither's amplitude and the fever tint's strength.
- The smaller option; no new dependency.
