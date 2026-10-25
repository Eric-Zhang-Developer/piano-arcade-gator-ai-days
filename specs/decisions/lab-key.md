# lab: the key on `/`, and how the work lands

**Context.** The spec asks for one key on `/` that opens `/lab`, chosen by the worker. Taken on `/`: ↑ ↓ ← → Enter,
L (wait mode), W (watch demo), E (easy), F (first run), O (options), H (reserved), ? (help-overlay). Checked against
the handlers on main (2026-10-24): those are the only letters bound.

**Options.** X ("experiments"), B, K, P.

**Choice.** X. It's free, it doesn't collide with a hand (L/R) or a mode letter, and "X for experiments" is easy to
say on a video. It's a constant, `LAB_KEY` in `web/src/game/lab/LabLink.tsx`.

**Order.** The way in needs `app/page.tsx` (song-select's) and `verify-lab.mjs` checks it, so this lands as three PRs:
`feat(lab)` (the page, the entries and their test, `LabLink`), then `fix(song-select)` (mounts `LabLink` in the
footer), then `feat(lab)` (`verify-lab.mjs`, the shots, the done note).

**How to undo.** Change `LAB_KEY` and the `<kbd>` text, or drop `<LabLink />` from `app/page.tsx`.
