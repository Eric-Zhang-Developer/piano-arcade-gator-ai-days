## What shipped
The top-right of `/` shows the commit it serves and its age (`a1b2c3d · 9 h old`) in ink-dim; past 2 h it turns
amber and adds `· behind main?`. Git is read at render, so `next dev` names the commit it serves after a pull, and a
build names its own commit; the age is computed in the browser. Hidden under `?capture=1`.
## Where it lives
`web/src/game/build-stamp/` (#445), mounted in `web/src/app/page.tsx` (#453); frames in `specs/features/build-stamp/`;
the corner in `specs/decisions/build-stamp-corner.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (build-stamp, 7bb5a02); `verify-stamp.mjs`
passes at 1280 and 1920 (clear of the songs, `?capture=1` hides it). By hand: a 3 h old commit (f30a259) showed amber
`behind main?`; an empty commit (92df5a8) showed after a reload with no dev restart.
`pnpm build && next start`: the prerendered `/` carries the built commit (7bb5a02).
## Gaps
Top-right, not bottom-right (the list's last card sits there). Not on /play. The deployed `/` is unchecked: no production
URL is configured in `.agents/config.toml`. Eric's eye: not verified by Eric.
