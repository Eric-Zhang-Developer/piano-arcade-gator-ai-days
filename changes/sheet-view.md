## What shipped
`/sheet?song=<id>` shows the chart's score (sheet-xml, OSMD 2.2.0) in its own window, under "Generated from the chart". It has zoom (buttons and − / + keys, remembered) and a legend. While /play runs a take, the sheet's cursor follows the chart clock, and each judged note's notehead takes its HUD color. "Sheet music ↗" on /play's start screen opens it as a reusable popup, hidden in capture mode.

## Where it lives
`web/src/app/sheet/page.tsx`, `web/src/game/sheet-view/` (`SheetView.tsx`, `follow.ts`, `plugin.tsx`, `verify-sheet.mjs`), one line at the end of `web/src/game/layers.ts`.

## How to check it
`node web/src/game/sheet-view/verify-sheet.mjs --out <dir>` follows a Perfect take. Every chart's notes all end up gold in the SVG, with the cursor rising:

| Chart | Gold noteheads |
|---|---|
| twinkle | 42 |
| ode-to-joy | 122 |
| minuet-g | 128 |
| fur-elise | 294 |
| chopin-prelude-4 | 305 |
| nocturne-op9-2 | 267 |
| maple-leaf-rag | 552 |

Add `--static` for all ten rendering. `verify.py --slug sheet-view` passes.

## Gaps
- **Wrong key under `?hands=`:** a transformed chart re-estimates its key. Für Elise with `hands=R` shows E minor, though the pitches are right. A follow-up `fix(sheet-xml)` takes the key from the whole song.
- **Not checked yet:**
  - Not tried in real Chrome. The popup and its reuse were checked in headless Chromium; the browser pane only navigates.
  - Reduced-motion scrolling is checked in code only.
  - On the piano (Eric): whether the score is readable from the bench on a second monitor.
- **Reading is rough** on the dense charts (Chopin, Nocturne, Maple Leaf) and wherever there's a pickup (a full rest bar first).
- **Same computer only:** BroadcastChannel stays in one browser.
