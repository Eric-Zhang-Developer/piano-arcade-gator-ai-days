---
name: "Learn from the music select: L opens the focused song in wait mode"
depends_on: ["wait-mode", "select-layout", "song-preview"]
owns: ["web/src/game/learn-from-select/"]
assignee: "eric"
---

# Learn from the music select

Eric asked for "learning mode at least a short quick practice version" (2026-10-24). Wait mode has shipped, but the
only way in is "Learn it first" on `/play`'s start screen. From `/`, Enter always starts a judged take.

Issue: #250

## Plan
Two PRs.
1. **One `fix:` PR with no scope**, as #205 did: it touches two done features' files and no in-flight feature owns
   either. `web/src/game/select-layout/index.tsx`: the list's `onKeyDown`, which already handles ↑/↓, also handles
   L, and the hint changes. `web/src/game/song-preview/index.tsx`: a LEARN link in the preview's row, and its Enter
   stop also fires on L; `song-preview.test.tsx` and `verify-preview.mjs` gain those checks. Both build the URL with
   wait-mode's `modeUrl(new URLSearchParams({ song: id }), true)` (`web/src/game/wait-mode/plugin.tsx`), so `/`
   and `/play` agree on what wait mode's URL is.
2. `feat(learn-from-select)`: the headless check `web/src/game/learn-from-select/verify-learn.mjs`, then the done
   note.

## Requirements
- **L:** with a song card focused on `/`, pressing L (`l` or `L`, no Ctrl, Meta or Alt, not a key repeat) opens
  `/play?song=<focused id>&mode=wait` once. Cmd+L and Ctrl+L keep doing what the browser does with them.
- **LEARN:** the focused song's preview row shows a LEARN link (`data-testid="preview-learn"`) to the same URL. It
  shows as soon as the row does, because it doesn't need the chart, unlike PRACTICE 70%.
  duo-select (#646) replaces that row with the select's panel, which has PLAY and PRACTICE only. From then on L is
  the way into wait mode, and the check clicks LEARN only where the link exists.
- **Enter and click are unchanged:** both still open `/play?song=<id>`, judged.
- **The hint** names `L learn`, beside `W watch` (watch-demo) and `E easy` (easy-charts). Until duo-select (#646) it
  read exactly `↑ ↓ choose · Enter play · L learn · W watch · E easy`. duo-select restyles it in the frame's
  monospace caps, so the check reads the three keys, not one string.
- **The preview stops:** leaving with L stops the opening at once (the queue cleared, All Notes Off on the
  piano), as Enter does, under the same rule as L above.

## Validation
- `pnpm -C web test`: song-preview's test renders `preview-learn` with `href` `/play?song=<id>&mode=wait` before
  the chart has loaded.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/learn-from-select/verify-learn.mjs --out <dir>`. It starts its own dev server, prints
  `verify-learn: pass` and exits 0, or names each failed step and exits 1. Steps:
  1. Load `/`, press ↓ once, then L -> the URL is `/play?song=<second song's id>&mode=wait`, and wait-mode's start
     line ("Wait mode: the song waits for each note") shows.
  2. Back on `/`, click LEARN on the focused song -> the same kind of URL, for that song.
  3. Press Enter on the first song -> `/play?song=<first id>` with no `mode`.
  4. Press Ctrl+L (Meta+L on macOS) with a card focused -> the URL is still `/`. This fails if L ignores modifiers.
  5. Screenshots of `/` at 1280×720 and 1920×1080 with the new hint and LEARN, kept in `<dir>`.
- `verify-preview.mjs` passes, including its new check: L clears the queue and sends All Notes Off to the stand-in
  DGX.
- `verify.py --slug learn-from-select` passes (its first step opens Twinkle from `/` with Enter).
- On the piano (Eric; mark it in the done note): on `/`, highlight Für Elise, press L, and learn its first bar.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's step 8,
"Look" (`design-taste-frontend`): 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots go in
the fix PR.

## Defaults
- L works only while the song list has focus, as ↑/↓ do. There's no page-wide key handler.
- L navigates with Next's router, as the cards' links do, not with a full page load.
- L opens the whole song in wait mode, not chunk-practice's first chunk: this feature doesn't wait on that one.
- L goes straight to `/play`, not through select-to-stage's transition. select-to-stage, select-stage and ui-sounds
  also edit `select-layout/index.tsx`: the later PR rebases. If ui-sounds' `confirm` has landed, L plays it as
  Enter does.
- LEARN looks like PRACTICE 70% (the same outline and type). No new tokens and no new dependencies.
- Log any choice the spec doesn't make in `specs/decisions/learn-from-select-*.md`.
