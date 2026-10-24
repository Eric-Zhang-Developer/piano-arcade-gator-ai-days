---
name: "Sheet view: the score in its own window, following a live take with judged noteheads"
depends_on: ["sheet-xml", "play-slots"]
owns: ["web/src/game/sheet-view/", "web/src/app/sheet/"]
assignee: "eric"
---

# Sheet view

Eric asked for a sheet music reading mode that "might be on another display but something that's well usable"
(2026-10-24). `/sheet?song=<id>` renders the chart's score (`sheet-xml`) with OpenSheetMusicDisplay (OSMD) in its own
window, for Eric to drag onto a second monitor. While /play runs a take, a cursor follows it and each judged note is
colored on its notehead. Decision 001 row 13 still stands: the score is never on the arcade screen. By Eric's call
(2026-10-24) sheet music is the game lane's, as with wait-mode; `practice-mode` keeps the rest. OSMD 2.2.0 is
already in `web/package.json` (contract #247): don't add or bump it.

Issue: #271

## Plan
Two `feat(sheet-view)` PRs; only the second writes the done note.
1. **The page:** `web/src/app/sheet/page.tsx`, its parts in `web/src/game/sheet-view/`: load the chart, render
   `chartToMusicXml(chart)` with OSMD (imported in the browser only), the header, zoom and the error path.
2. **Following:** the plugin, one line at the end of `layers.ts` so it sees the chart after every `transformChart`: it
   posts the take, and its `startPanel` is the "Sheet music ↗" button. The page listens on a BroadcastChannel, as
   `web/src/app/sim/page.tsx` does with `web/src/game/sim/plugin.ts`. No other feature's files change.

## Requirements
- **The page:** `/sheet?song=<id>` takes the ids /play takes (`local/<id>` too). Title and composer once (OSMD's own
  title and composer off), and under them "Generated from the chart": it's our chart, not the engraved original.
  Then the score, music in `--pa-ink` on `--pa-bg`, with OSMD's `autoBeam` on. A bad id shows the error and a link to
  `/`, as /play does. Zoom with − and + (buttons and keys), remembered in localStorage inside try/catch.
- **The channel** `pianoArcade.sheet`, from /play: `take` on songStart with the chart as played (after hands, loops
  and every other transform); `clock` with `frame.nowMs` each drawn frame; `judgment` (noteId, judgment) on noteHit
  and noteMiss; `end` on songEnd and quit. No ids: the sheet follows whichever /play started a take last.
- **Following:** on `take`, re-render if that chart differs from the one shown, clear the colors, reset the cursor.
  On each `clock`, OSMD's cursor moves to the last note entry at or before that time, and the page scrolls to keep it
  in view, not smoothly under reduced motion (OSMD's `followCursor` always scrolls smoothly, so the page scrolls
  itself). Pause, wait-mode holds and Retry need nothing else.
- **Noteheads:** a judged note's notehead takes its judgment's color from `hudSettings.judgmentColors`
  (`web/src/game/hud/index.ts`), found by staff, onset and pitch from sheet-xml's `placeNotes`, and painted in place
  with OSMD's `GraphicalNote.setColor` (no re-render per judgment). A tied note colors its first notehead. A legend
  names the four colors, so color is never alone.
- **The button:** "Sheet music ↗" on /play's start screen calls `window.open("/sheet?song=<id>", "pianoArcadeSheet",
  "popup")`: a window that drags to another monitor, reused by a second click. It carries `data-capture-hide`
  (capture-mode leaves it out of the video). The plugin draws nothing on /play.
- **Test hook:** `window.__pianoArcadeSheet = { cursorMs, colored: { PERFECT, GREAT, GOOD, MISS } }`, where `colored`
  counts notes painted in the SVG, not judgments received.

## Validation
- `pnpm -C web test`: for a scripted event list, the plugin posts take, clock, judgment and end in order (Node's
  BroadcastChannel). `verify.py --slug sheet-view` passes, /play unchanged.
- PR 1, `node web/src/game/sheet-view/verify-sheet.mjs --out <dir> --static`: every chart under `web/public/songs/`
  but `local/` renders with no error text and at least one notehead; screenshots of twinkle, ode-to-joy, minuet-g.
- PR 2, `verify-sheet.mjs --out <dir>`: one browser context with `/sheet?song=<id>` and `/play?song=<id>&input=test`,
  played Perfect as `web/e2e/verify.mjs` plays it -> `cursorMs` rises during the take, and at the end
  `colored.PERFECT` is the chart's note count and that many noteheads in the SVG carry the PERFECT color: twinkle 42,
  ode-to-joy 122 (two hands), minuet-g 128, then fur-elise 294 (ties, a pickup). chopin-prelude-4, nocturne-op9-2 and
  maple-leaf-rag (dense) render and follow, their counts go in the done note, and reading rough there is a Gap.
- In Chrome: "Sheet music ↗" -> a new window; `/play?song=fur-elise&hands=R` -> the sheet shows the right hand only,
  follows and colors as you play.
- On the piano (Eric; mark it in the done note): ode-to-joy or minuet-g, /sheet on a second monitor. Readable from
  the bench?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with
`design-taste-frontend`'s step 8, "Look", at 1280×720 and 1920×1080 plus reduced motion. Screenshots before and
after in the PR.

## Defaults
- No sound, editing or page turns: it scrolls. No Window Management API: Eric drags the window. Opened mid-take, it
  waits for the next take. The sheet shows the chart as played: a loop's repeats written out, versus' two copies.
- PERFECT's gold (`#ffe27a`) is about 1.15:1 in luminance against `--pa-ink` noteheads, GREAT 1.26:1, MISS 2.5:1. The
  Look review checks a PERFECT notehead reads apart from an unjudged one; if not, color the stems too
  (`colorStemsLikeNoteheads`) and log it. Log other choices in `specs/decisions/sheet-view-*.md`.
- Gap: the same computer only. BroadcastChannel stays inside one browser; an iPad would need a network relay. The
  cabinet's demo also plays /play, so an open sheet follows it too.
