# Judging windows: wider, and a full combo ranks at least B

## Context
Eric's no-miss full combo on Twinkle ranked D: 18 PERFECT, 18 GREAT, 6 GOOD over 42, so
(18 + 0.5 × 18 + 0.25 × 6) / 42 = 67.9%. Eric: "Scoring is majorly fucked up... How is this a D?" The windows
(±25/50/100 ms) and weights (GREAT 0.5, GOOD 0.25) were rhythm-game numbers for a tapped button. On a real piano a
listener hears neither 30 ms nor 60 ms in a simple melody, and every note in that take was the right key, in order,
with nothing dropped.

## Options
- A: keep the windows, only change the weights. Fixes the rank but keeps telling a clean player "GREAT, GREAT".
- B: wider windows (PERFECT ±40, GREAT ±80, GOOD ±120), weights GREAT 0.8 and GOOD 0.5, and a full combo
  never below B.
- C: wider windows alone. Doesn't fix this take's rank: its 6 GOODs and 18 GREATs would mostly move up a tier, but
  an unknown share.

## Choice
B. The windows go in `mission.md` (judging rule); the weights and the floor are code in `judging-tiers`'
`core/settings.ts` and `core/judge.ts`. NEAR_MISS_MS stays 150 ms, still wider than GOOD.

Eric's take with the same judgments under B's weights: (18 + 0.8 × 18 + 0.5 × 6) / 42 = 84.3%, a B (it was a D).
That's a floor: with the wider windows some of its GREATs and GOODs would judge a tier higher, but the take's
offsets weren't available to recompute it, so the after-rank isn't claimed past B.

The timing bias measurement (is Eric consistently late?) is still open; it may move calibration, not these windows.

## How to undo
Revert the `contract:` commit and the `fix(judging-tiers)` commit. Saved takes keep their stored rank either way:
the take store's offset CHECK is a ±1000 ms sanity bound (migration `20261024000003_contract_tolerant.sql`), not
the window.
