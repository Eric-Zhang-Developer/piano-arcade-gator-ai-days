---
name: "Crash guard: one plugin's error never freezes the game; a render error shows a card with a way back"
depends_on: ["core-loop", "play-slots", "ui-tokens", "notice-toast"]
owns: ["web/src/game/crash-guard/"]
assignee: "eric"
---

# Crash guard

#286 froze /play on any key outside the chart's range: one throw inside the frame loop (`frame()` in
`web/src/app/play/page.tsx`) and `requestAnimationFrame` is never asked again, so the song never ends. Judges play it
live. Plugin panels are already guarded (play-slots' `Boundary` and `Slots`); the frame loop and page renders aren't.

Issue: #365

## Plan
Three small PRs, in this order (the page and layout are core-loop's, a done feature's files):
1. `feat(crash-guard)`, no done note: in `web/src/game/crash-guard/`, a pure `createGuard(onFail)` with its tests,
   `GameBoundary` and the `crashGuard()` test plugin (one line at the end of `layers.ts`, which is open), and
   `verify-crash.mjs`.
2. `fix(core-loop)`: `page.tsx` runs every plugin `draw`, `onEvent` (in `emit`) and `background.frame` (in `frame`
   and `idle`) through the take's guard, and `frame()` requests the next frame in a `finally` unless `done`.
   `layout.tsx` wraps `{children}` in `<GameBoundary>`, and only `{children}`: `<CaptureMode />` and demo-reset's
   `<DemoReset />` stay outside it, so Shift+Esc still works on the card. static-keyboard's `fix(core-loop)` (#384)
   also edits `page.tsx` (the range, not the frame loop): whichever lands second rebases.
3. `feat(crash-guard)`: the done note.

## Requirements
- **Guard, per take:** `createGuard(onFail)` returns `{ run(id, hook, fn), off(id) }`. A throw from `fn` logs one
  `console.error("crash-guard: <id>'s <hook> threw: <message>")`, marks the plugin off and calls `onFail(id)`. An off
  plugin's draw, onEvent and background frame are skipped for the rest of the take; its drawing is gone from the next frame (/play redraws its one shared overlay canvas every frame).
  Every other plugin keeps running. Retry builds a new guard: the plugin is back.
- **Core's own frame work** (`drawHighway`, the judge): a throw is logged once per distinct message, and the next
  frame is still requested. The clock runs on, so the take reaches its results.
- **Notice:** notice-toast's `toast("<id> stopped after an error. The game goes on.")` (done: top right under the
  HUD band, gone by 4 s, `data-testid="toast"`). No notice of its own.
- **Render errors:** `GameBoundary` is `catchError` from `next/error` (Next 16's component boundary; it clears on a
  client navigation). Its card: "Something broke.", the message in `--pa-ink-dim`, and two buttons: "Back to the song
  list" (a full page load of `/`, so no state survives) and "Try again" (`retry()`), the first focused.
- **Test hooks** (as scenes' `?bot=`): `?crash=draw` makes `crashGuard()`'s draw throw on its 30th frame,
  `?crash=event` its onEvent on the first `noteHit`, and `?crash=render` makes a probe inside `GameBoundary` throw while
  rendering, on any page. Without `crash`, the plugin draws nothing and changes nothing.

## Validation
- `pnpm -C web test`: a throwing `fn` logs once and calls `onFail` once over 100 runs; the off plugin's later runs
  don't call `fn`; a second plugin's runs all happen; a new guard runs the plugin again.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/crash-guard/verify-crash.mjs --out <dir>`. It starts its own dev server, prints
  `verify-crash: pass` and exits 0, or names each failed step and exits 1:
  1. `/play?song=twinkle&bot=perfect&crash=draw`, Start -> exactly one `crash-guard: crash-guard's draw threw`
     console line, a `toast` reading "crash-guard stopped after an error. The game goes on." visible, then gone by
     5 s; results show 42 PERFECT.
  2. The same with `crash=event` -> one `onEvent threw` line, results with 42 PERFECT.
  3. `/?crash=render` and `/play?crash=render` -> the card; Enter on the focused button -> `/` with no card.
  4. #286's case: `/play?song=twinkle&input=test`, a press at pitch 30 -> results.
  With Plan PR 1 merged but not PR 2, steps 1 and 2 time out (the throw stops the loop), so the check can fail.
  Screenshots of the toast mid-take and the card at 1280×720 and 1920×1080 go in `<dir>`.
- `verify.py --slug crash-guard` passes (no `crash` param: the game is unchanged).
- Eric (mark it in the done note): nothing to do on the piano; look at the card and the notice once.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look", on the card only (the notice is notice-toast's): 1280×720 and 1920×1080,
plus reduced motion. Before and after screenshots in the PR.

## Defaults
- `transformChart` and `wrapInput` throws stay as they are: the load's `.catch` already shows /play's error phase.
- Log choices the spec doesn't make in `specs/decisions/crash-guard-*.md`.
