---
name: "Duo tokens: the new palette, sharp corners and type roles across the game"
depends_on: ["ui-tokens", "hand-colors", "core-loop", "fever-stage"]
owns: ["specs/features/duo-tokens/", "changes/duo-tokens.md", "web/src/game/duo-tokens/", "specs/decisions/duo-tokens-"]
assignee: "eric"
---

# Duo tokens

Issue #645. Eric and Andres chose the Duo look on 2026-10-25. It's in `specs/context/visual-direction.md` (#636), and
the frames are `specs/context/mood-frames/codex-cyberpunk-duo/F-duo-*` (#640). This is the foundation that
duo-hud, duo-select, duo-results and sheet-paper build on. It's a token swap with no layout work, so after it every
screen repaints at once.

## What exists (origin/main, 2026-10-25)
- **CSS tokens:** `web/src/app/globals.css:4-24` (core-loop). Its comment, "Declared only: nothing uses them yet", is
  stale: 48 files read `var(--pa-*)`. `:31-32` hard-codes `background:#000` and `color:#eee`.
- **TypeScript mirror:** `web/src/game/ui-tokens/index.ts:3-23`, with a test that keeps the CSS and TS values equal.
  22 files import it.
- **Hand colors:** `web/src/game/hand-colors/index.ts:7` has `R: "#5ef2c4", L: "#6aa8ff"`, and it drives the notes,
  the keys and the LED strip (`leds/messages.ts` imports `noteColorFor`). Also
  `core/settings.ts:14 noteColor: "#5ef2c4"`. Tests: `leds/leds.test.ts:9,15` and `key-skin.test.ts:45-54`.
- **Fonts:** `app/layout.tsx:11-17` loads Saira at fixed weights 700/800/900, normal and italic, with no width axis.
  There's no monospace token.
- **Stage:** the synthwave stage draws behind every `/play` take, not only fever (`stage/index.ts:166`,
  `app/play/page.tsx:143,152`). `<SelectStage/>` draws it on the select (select-stage).

## Plan
1. **`fix(ui-tokens)` with `fix(core-loop)`, together if the title rules allow, else in this order:**
   - repaint the CSS and TS values (Requirements);
   - add `--pa-primary`, `--pa-secondary`, `--pa-line`, `--pa-paper`, `--pa-paper-ink` and `--pa-font-data`;
   - fix the stale comment and `globals.css:31-32`;
   - load the fonts in `layout.tsx`;
   - update the test.
2. **`fix(hand-colors)`:** R `#2B9BFF`, L `#A07CFF`; `core/settings.ts` `noteColor`; the two tests that pin the old hex.
3. *(Done separately: Eric's removal PR takes the stage off normal play and the black-key lane shading off /play.
   Rebase on it. No stage work is left here, except that `<SelectStage/>` comes off the select in duo-select.)*
4. **`feat(duo-tokens)`, the Duo kit** (Eric, 2026-10-25: "add the shared Duo kit to #645 and have select, HUD and
   results use it"), in `web/src/game/duo-tokens/`. These are the pieces duo-select, duo-hud and duo-results share, so
   there's one bracket style, not three:
   - `Panel`: a hairline frame, 0 radius, `--pa-panel` fill, with a `paper` variant for sheet-paper;
   - `Brackets`: corner brackets around any box, in `--pa-primary` or `--pa-line`;
   - `Button`: `primary` (blue fill, light text) and `secondary` (hairline), with a visible focus ring, 0 radius;
   - `DataCell`: a small monospace caps label over a big condensed numeral, with an optional judgment color for the
     number only;
   - `MonoLabel`: small monospace caps with wide tracking;
   - **canvas twins:** `drawBrackets`, `drawPanel` and the font strings, from the same TS values, for the HUD's
     canvas.
   - A vitest render test renders every piece and state. A kit page is optional: `/lab` belongs to lab, so it'd be
     a `fix(lab)` link to a route this feature owns.
5. **`feat(duo-tokens)`:** `verify-duo.mjs`, the screenshots, the done note.

## Requirements
- **Values, exactly as in visual-direction.md:**
  - `--pa-bg` `#030607`, `--pa-panel` `#0A0D15`, `--pa-ink` `#E2E6F0`, `--pa-ink-dim` `#7D8496`;
  - `--pa-hand-r` = `--pa-primary` = `#2B9BFF`, `--pa-hand-l` = `--pa-secondary` = `#A07CFF`;
  - `--pa-miss` `#8A8F98`;
  - `--pa-line` = ink-dim at about 25% alpha;
  - `--pa-hype` `#ff2fd0` is added, and `--pa-magenta` stays `#ff2fd0` as its alias (hype pink, Eric 2026-10-25:
    moments only, see visual-direction.md). Any `--pa-magenta` reader that isn't one of the hype moments moves to
    `--pa-primary`. `--pa-cyan` aliases `--pa-primary`, so old readers repaint
    instead of breaking;
  - GOOD, gold, WRONG, flare, the sun and sky colors, and the tier colors are **unchanged**.
- **Paper:** `--pa-paper` (warm off-white) and `--pa-paper-ink` (near-black). The worker picks the exact values with
  the sheet-paper worker and logs them in `specs/decisions/duo-tokens-paper.md`.
- **Fonts:**
  - **Saira, upright,** with its width axis (`axes: ["wdth"]` through `next/font`), so numerals can be condensed
    (`font-stretch` about 75%). Italic is no longer loaded.
  - **A monospace for data** (`JetBrains Mono` or `IBM Plex Mono` through `next/font/google`) as `--pa-font-data`.
  - `fontDisplay` in ui-tokens stays, and `fontData` is added.
  - No new npm dependency.
- **Zero radius:** one rule in `globals.css` sets `border-radius: 0` on interface elements in the game's pages. It
  must not reach `/learn` (Andres's lane, #641): scope it so `web/src/learn` CSS keeps its own (log how). Canvas
  shapes are untouched here: note pills and keys are physical, and the canvas overlay badges belong to duo-hud.
- **No other layout changes.** Screens repaint. They don't move.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/ui-tokens src/game/hand-colors src/game/leds src/game/key-skin`:
   the CSS/TS equality test passes with the new values, and the hand-color, LED and key-skin tests pass with the new
   hex.
2. `rg -n -i '#5ef2c4|#6aa8ff' web/src --glob '!**/learn/**'` prints only GREAT's mint (`hud/index.ts:19`,
   `results-layout/index.tsx:44`, `app/progress/panels.tsx:154`). GREAT keeps its color, and duo-hud and
   duo-results decide it.
3. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug duo-tokens --worktree . --cmd "node {worktree}/web/src/game/duo-tokens/verify-duo.mjs --out {out}"`.
   It prints `verify-duo: pass` or names each failed step:
   1. `/` and `/play?song=twinkle&input=test`: `getComputedStyle(document.documentElement)` has the new values, and
      `body`'s background is `rgb(3, 6, 7)`.
   2. `/play`: no stage canvas outside fever, with fever forced through the test hook if one exists.
   3. A button on `/` has a computed `border-radius` of `0px`; `/learn`'s radii are unchanged from main.
   4. Screenshots `duo-select.png` and `duo-play.png` at 1280×720 and 1920×1080.
4. The kit: its render test shows each piece (Panel and its paper variant, Brackets, Button primary,
   secondary and focused, DataCell, MonoLabel) with 0 radius, and `drawBrackets` draws four corners inside its box.
5. Eric looks once, and the LED strip shows blue for the right hand and purple for the left. Mark it in the done
   note.

## Defaults
- **First of the restyle,** right after flow-mode. Cut if it isn't done by Sunday noon (2026-10-25 12:00 ET).
- Log any choice this spec doesn't make in `specs/decisions/duo-tokens-*.md`.
