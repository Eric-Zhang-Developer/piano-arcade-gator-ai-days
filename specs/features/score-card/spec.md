---
name: "Score card: Save card on the results downloads a PNG of the take"
depends_on: ["results-layout", "song-jacket", "records"]
owns: ["web/src/game/score-card/"]
assignee: "eric"
---

# Score card

Judges play a take and walk away with nothing, and the video needs an end frame. "Save card" on the results screen
draws the take as one image (song, jacket, rank, score, accuracy, counts and date) on a canvas and downloads it as
a PNG. It's all in the browser: no upload, no server, no new dependency.

Issue: #381

## Plan
Three small PRs, the done note last.
1. `feat(score-card)`: `web/src/game/score-card/` holds a pure `cardModel(chart, results, score, date)` (the
   strings and colors to draw), `drawCard(ctx, model)` on a 2D canvas, the plugin and its line in `layers.ts` (an
   open file), and tests. The plugin rebuilds the score with the HUD's reducer, as records does. Its results panel is
   one "Save card" button: wait for the font, draw, `canvas.toBlob`, then download through an `<a download>`. Its
   `layers.ts` line goes before `barLoop()`, as chunk-practice's does, so `transformChart` sees the song's own title.
   The params give the practice line. No done note.
2. `fix(results-layout)`: `actions` gains `"score-card"`, so Save card joins Retry · Replay on piano · Songs.
3. `feat(score-card)`: `verify-card.mjs`, a card for each of three takes, the done note.

## Requirements
- **The card:** 1920×1080 PNG on `--pa-bg`.
  - The jacket: `jacketFor(id, title, composer)`'s gradient and word, cropped as `SongJacket` draws it.
  - The song's own title and composer: the title from the chart file, not a bar-loop's suffixed one.
  - The rank in gold, large, Saira 900 italic.
  - Score, accuracy (one decimal) and max combo, plus the six counts in results-layout's `countRows` colors and
    labels.
  - The date, as `YYYY-MM-DD` in the player's time zone.
  - "Piano Arcade" small in a corner.
  Text follows the type rules: Saira for numbers and titles, `system-ui` for labels, nothing under 24 px.
- **Same numbers as the screen:** every value on the card is what the results screen shows for that take.
- **Practice:** a bar-loop, wait-mode, `hands` or versus take gets a line naming it (`Bars 5–8 at 70%`,
  `Right hand`). Wait mode isn't scored, so it gets no button.
- **File:** `piano-arcade-<song id with / as ->-<YYYY-MM-DD>-<rank>.png`. One click, one file. The button is
  disabled while drawing.
- **Private:** nothing leaves the browser. There's no network request on click (the verify checks).
- **Font:** ui-tokens' `whenDisplayFontReady()` (it gives up after 1 s). The fallback is `system-ui` 800.

## Validation
- `pnpm -C web test` (score-card): `cardModel` for a fixed results object gives the expected strings (score
  `12,345`, accuracy `97.3%`, the six counts, date `2026-10-24`). A bar-loop chart's title gives the song's title
  and the practice line. The filename for `local/my-song` is `piano-arcade-local-my-song-2026-10-24-S.png`.
  `drawCard` on a recording fake context writes each model string once.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/score-card/verify-card.mjs --out <dir>`. It prints `verify-card: pass` and exits 0, or names
  each failure and exits 1. For `/play?song=twinkle&bot=perfect`, `bot=rank-c` and
  `song=fur-elise&bot=sloppy` at 1920×1080: take it to results, click Save card, then:
  - one download, a PNG of 1920×1080 with that name pattern;
  - no request other than the page's own assets after the click;
  - the PNG passed to a Playwright page as an `<img>`: its pixel at the rank's box is gold within ΔE76 10.
  Keep the three PNGs. It fails on main today: there's no Save card button.
- `verify.py --slug score-card` passes. Results still open with no scroll at 1280×720 (results-layout's check).
- Eric (mark it in the done note): save a card after a piano take, and open it on the phone. Would a judge keep it?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
`design-taste-frontend`'s step 8, "Look", on the PNG itself and on the results screen with the new button at
1280×720 and 1920×1080, plus reduced motion (nothing on the card moves). Before and after screenshots go in the PR.

## Defaults
- 1920×1080 so the card can be the video's end frame as it is. A phone-shaped card is a later idea.
- No QR code, share sheet or upload. Web Share can come later if a judge asks.
- Shown in capture mode: it's part of the results, not a setup control.
- Log choices in `specs/decisions/score-card-*.md`.
