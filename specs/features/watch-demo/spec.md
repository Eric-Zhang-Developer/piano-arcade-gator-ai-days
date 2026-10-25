---
name: "Watch demo: W on the select plays the focused song with the perfect bot, labeled DEMO, then returns"
depends_on: ["scenes", "select-layout", "song-preview", "records", "hud"]
owns: ["web/src/game/watch-demo/"]
assignee: "eric"
---

# Watch demo

A ready-made demo of any song, for judges ("show me what Für Elise looks like") and for the video's B-roll. scenes
already plays a song perfectly (`?bot=perfect&audible=1`). This puts it one key away on the select, labels it, and
brings the player back.

Issue: #360

## Plan
Small PRs, in this order. The done note merges last.
1. `feat(watch-demo)`: `web/src/game/watch-demo/` holds `watchUrl(id)`, `isWatchKey(e)` and the plugin, with tests,
   plus one line in `layers.ts` after `scenes()`. No done note.
2. `fix(select-layout)`: W in `MusicSelect`'s `onKeyDown` pushes `watchUrl(song.id)`, and the hint gains `W watch`.
3. `fix(song-preview)`: W stops the opening at once, as L does. (A WATCH link beside LEARN shipped in #581 and came
   out in #599: it wrapped the preview's row at 1280×720 and pushed the preview under the footer, #596.)
4. `feat(watch-demo)`: `verify-watch.mjs`, screenshots and the done note.

## Requirements
- **URL:** `watchUrl(id)` is `/play?song=<id>&bot=perfect&audible=1&demo=1`. `isWatchKey` means plain w or W, with
  no Ctrl, Meta or Alt and no repeat (learn-from-select's rule).
- **Starts itself:** with `demo=1`, a start panel clicks Start once it mounts. It's cabinet's `AutoStart`, copied
  (3 lines, not exported there).
- **Sound:** scenes sends the bot's notes to "Portable Grand". With no such output (`pickOutput` in
  `web/src/replay/piano.ts`), the plugin plays each `noteHit` as `toneVoice`, so a laptop demo isn't silent.
- **Nothing else plays:** in a demo, `wrapInput` swaps the MIDI device for one that never emits. A piano echo or a
  bumped key can't spoil the take.
- **DEMO label:** a badge in the HUD band, in wait-hud's LEARN style (cyan frame, display face, italic 900),
  right-aligned in `hudLayout(...).slots.card` so it covers no counter, score or multiplier. It shows from the
  start screen to the results.
- **Back to the select:** at `songEnd`, a results panel reads "DEMO · back to songs in 8 s", with a "Back to songs"
  button that takes focus in an effect after mount (chunk-practice's pattern). After 8 s, or on that button, it calls
  `location.assign("/")`: a full load, so no ghost or MIDI state outlives the demo. Retry (`songStart`), `quit` and
  `pagehide` cancel the timer.
- **No record:** records' `practiceReason` already skips `bot`. Nothing here writes storage.
- Test hook: `window.__pianoArcadeDemo = { on, returnAt }` (`returnAt` is a `performance.now()` time, or null).

## Validation
- `pnpm -C web test`: `watchUrl("fur-elise")` gives the exact URL. `isWatchKey` rejects Meta+W, Ctrl+W and repeats.
  The return is armed at `songEnd` and cancelled by `songStart` and `quit`. Without `demo` the plugin does nothing.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/watch-demo/verify-watch.mjs --out <dir>`. It starts its own dev server and prints
  `verify-watch: pass` (exit 0), or names each failed step (exit 1):
  1. On `/`, focus Twinkle and press W: the URL's params are `song=twinkle&bot=perfect&audible=1&demo=1`. The take
     starts with no click, and `__pianoArcadeDemo.on` is true.
  2. A HUD screenshot mid-take shows DEMO. The results reach 100% accuracy, and `localStorage["pianoArcade.records"]`
     is byte-for-byte what it was before step 1.
  3. "Back to songs" is `document.activeElement`. Within 10 s of the results, the URL is `/`.
  4. Meta+W on `/` doesn't navigate.
  5. Screenshots of the DEMO badge and of the results panel at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug watch-demo` passes, plain `/play` unchanged.
- Eric (mark it in the done note): W on Für Elise with the DGX on USB. Does it play on the piano, in time, with no
  hung notes after the return?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots
go in the PR.

## Defaults
- 8 s on the results is a starting value. The return goes to `/` with the first song focused, as any load does.
  Focusing the demoed song would need select-layout to read a param: later, if wanted.
- The demo plays the Normal chart with both hands. Carrying easy-charts' level or song-options' choices is theirs.
- Laptop tones start at the hit, not ahead of it: a few ms behind the picture is fine for a demo.
- Log choices the spec doesn't make in `specs/decisions/watch-demo-*.md`.
