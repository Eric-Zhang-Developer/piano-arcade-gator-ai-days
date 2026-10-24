## What shipped
- One toast stack for the game's notices: `toast(text)`, a plain function any plugin can call (#344).
- **Place:** top right under the HUD band, newest on top, at most 3, each gone by 4 s.
- **Look:** panel, ink and a cyan edge, at 16 px at 720 high and 24 px at 1080. No slide under reduced motion.
- **midi-watchdog (#355):** reconnecting, reconnected, disconnected and connected are toasts now, and nothing is drawn above the keys.
- **scenes (#356):** the unknown-bot notice is a toast; the old red box is gone.

## Where it lives
- `web/src/game/notice-toast/` (`index.ts`, `notice-toast.test.ts`, `verify-toast.mjs`).
- The callers in `web/src/game/midi-watchdog/` and `web/src/game/scenes/`.
- The decision in `specs/decisions/notice-toast-look.md`.

## How to check it
- `node web/src/game/notice-toast/verify-toast.mjs --out <dir>`: pass.
  - At both sizes: one unknown-bot toast at the top right (96 px down, 16 px in), gone at about 4 s, no `scenes-notice`.
  - Under reduced motion the box never moves.
  - On /sim, Unplug and Replug give the disconnected and connected toasts.
- `verify.py --slug notice-toast`: pass at 0e3cf2f.
- `pnpm -C web test`.

## Gaps
- **Not verified by Eric:** unplug the DGX mid-song. Is the toast seen without leaving the notes?
- **Open question for Eric:** a sticky toast for a lasting state. Unplugged now shows once at the start and once at the end.
- **Not checked yet:** the real Chrome MIDI unplug path; only the fake piano's statechange was tested.
- **Not a toast:** core's MIDI status line stays as it was, by the spec.
