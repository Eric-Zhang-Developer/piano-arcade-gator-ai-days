---
name: "Notice toast: one styled stack for the game's notices"
depends_on: ["ui-tokens", "midi-watchdog", "scenes"]
owns: ["web/src/game/notice-toast/"]
assignee: "eric"
---

# Notice toast

Notices are drawn three ways today: midi-watchdog's in 16 px system font on the canvas above the keys
(`web/src/game/midi-watchdog/index.ts:63`), scenes' unknown-bot notice as a red-bordered box at the bottom right, and
core's MIDI status only on the start screen. One toast stack gives them one look and one place.

Issue: #269

## Plan
A feat and two few-line fix PRs, about an hour.
1. `web/src/game/notice-toast/`: `toast(text)`, a plain function any plugin can call (no React). It adds a toast to
   one stack on `document.body`. Later notices call it from their own folders.
2. Each move into it is its owner's few-line fix PR:
   - `fix(midi-watchdog)`: a toast on a stall (`RECONNECTING`), a recovery, an unplug (`DISCONNECTED`) and a replug,
     and nothing drawn on the canvas. Its tests check `toast` calls (mocked) instead of `fillText`.
   - `fix(scenes)`: the unknown-bot notice calls `toast`, and scenes' own `notice()` goes.
   Core's MIDI status line isn't a notice and stays as it is (`web/e2e/verify.mjs` reads it on `/sim`'s results).

## Requirements
- **API:** `toast(text: string): void`. It does nothing on the server or before `document.body` exists, and puts the
  text in as `textContent`, never as HTML.
- **Place:** top right, below the HUD's top panel (`hudLayout` caps it at 84 px), newest on top. At most 3 show; a
  fourth makes the oldest leave early. The stack stays in the top half, where a note is still over 700 ms from the
  line (the keyboard takes at most 22% of the height; `lookaheadMs` is 2000), so it never covers a note due within
  500 ms. It has `pointer-events: none`.
- **Look:** `--pa-panel` background, `--pa-ink` text in the body face, a `--pa-cyan` edge. Text is at least 16 px at
  1280×720 and 24 px at 1920×1080 (the video rule).
- **Time:** each toast stays at most 4 s (`toastSettings.ms`, 4000). It slides and fades in over 150–250 ms,
  ease-out. Under reduced motion it doesn't slide: it appears and leaves at once.
- **Accessible:** the stack is `role="status"` with `aria-live="polite"`; each toast has `data-testid="toast"`.
- **Nothing lost:** every notice shown today still shows (wording may be tidied); midi-watchdog's `log` is unchanged.
  A lasting state (unplugged, reconnecting) is on the canvas the whole time today; as toasts it shows at its start
  and end only (Defaults).

## Validation
- `pnpm -C web test`: a fourth toast drops the oldest; a toast is gone at 4 s. With `toast` mocked, midi-watchdog's
  tests see `DISCONNECTED` on an unplug and `RECONNECTING` on a stall. `verify.py --slug notice-toast` passes.
- Headless Chrome (Playwright), at both sizes:
  1. Open `/play?bot=nobody` -> one unknown-bot toast at the top right, gone by 4 s, and no `scenes-notice`.
  2. On `/sim`, Watch the bot (the game is in its iframe), then Unplug -> the disconnected toast. Replug -> a
     connected toast. Nothing is drawn above the keys.
  3. With reduced motion emulated -> the toast's box doesn't move between appearing and leaving.
  4. Screenshots mid-song with a toast up -> it's clear of the HUD and the highway's lower half.
- Eric's eye (mark it in the done note): unplug the DGX mid-song. Is the toast seen without leaving the notes?
  `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before/after screenshots in the PR.

## Defaults
- One style for every toast, no info or warning colors: no token means "warning", and the text says what happened.
- A lasting state (the piano still unplugged) gets one toast when it starts and one when it ends; nothing stays on
  screen. Open question for Eric: a sticky toast for that case.
- No sound, never focus or input. The DOM is built in the module, as juice's full-combo banner is, styled from the
  tokens' CSS variables. Log choices in `specs/decisions/notice-toast-*.md`. Prefer the smaller option.
