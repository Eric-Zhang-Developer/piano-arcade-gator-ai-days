## What shipped
Local records.
- **Best grade:** each song's best grade (rank and accuracy) shows on its music-select card.
- **Results panel:** NEW RECORD when a take beats the song's best score; 3-letter arcade initials (A–Z, ↑ ↓, Backspace, Enter); the top 5 with this take marked.
- **Saving:** a take is saved when it ends. Without Enter, its initials stay `---`.
- **Not recorded:** practice takes (`from`, `to`, `tempo`, `mode`, `bot`, `versus`, `hands` other than `both`). The panel says why.
## Where it lives
- `web/src/game/records/`: `store.ts`, `index.ts` plugin, `panel.tsx`, `best.ts`, `records.test.ts`, `verify-records.mjs`.
- One entry in `web/src/game/layers.ts`. The card's `best` prop (`song-card`, `select-layout`, #205).
- Screenshots in `specs/features/records/screens/`.
## How to check it
- `verify.py --slug records` passed at 432ef5d.
- `node web/src/game/records/verify-records.mjs --out <dir>` passed, with real key presses in one fresh profile:
  - a perfect Twinkle shows NEW RECORD and saves ERI;
  - `/` shows "BEST 100.0% S" on Twinkle's card only;
  - a worse take shows no NEW RECORD, lands #2, and keeps `---`;
  - `?bot=perfect` isn't recorded.
## Gaps
- **Not verified on the piano** (Eric): two takes of Twinkle, with initials on the better one.
- The spec's Chrome steps ran headless with the test input, not laptop keys.
- With several results panels, the results screen opens scrolled down, with the rank out of view (`/play`, for results-layout #154).
