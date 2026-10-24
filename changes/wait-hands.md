## What shipped
- `?mode=wait&hands=R` (or `L`) teaches one hand while the piano plays the other on the held clock.
- Hand mode no longer queues ahead in wait mode. Each frame sends what the held clock passed, untimestamped, so no note goes out early during a hold and no note-off cuts its note.
- The echo guard is stamped at the real send.
- The fix is #336 (`fix(hand-mode)`). This adds the headless check.

## Where it lives
- `web/src/game/hand-mode/hands.ts` (`waitSends`) and `index.ts`.
- `web/src/game/wait-hands/verify-wait-hands.mjs`.
- `specs/decisions/wait-hands-send-order.md`.

## How to check it
- `node web/src/game/wait-hands/verify-wait-hands.mjs --out <dir>`: steps 1–3 pass.
  - Nothing is sent during 3 s held at beat 3.
  - All 15 left-hand notes in bars 1–8 go on and off within 50 ms after their chart time.
  - The clock holds only at right-hand notes.
  - On origin/main before #336, steps 1 and 2 failed: notes went out about 290 ms early, note-offs about 520 ms early.
- `verify.py --slug wait-hands`: pass at 512cbe9.
- `verify-hands.mjs`: pass, unchanged.

## Gaps
- **Not tried on the piano yet (Eric):** Für Elise with `?hands=R&mode=wait`. Listen for nothing early during a hold, no clipped left-hand notes, and nothing hanging after the song.
- **Sends trail by up to a frame:** 0–17 ms of chart time; a note at a held time sounds one to two frames after the press. If that's audible, the spec's fallback is to queue ahead up to the next hold.
- **Laptop-tone path:** checked in code only; the headless run uses the fake piano.
