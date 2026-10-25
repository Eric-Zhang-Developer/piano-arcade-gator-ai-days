## What shipped
`/stage` is the live take on NOSTALGIA's hill, for the people watching on a second display.
- **The lane:** notes rise dim on a back slope, tip over a lit crest and speed down to the bar, over 1033 ms. The
  curve, the timing and the effects are measured from the reference video.
- **Moments:** each hit gets a pillar, a starburst and its judgment; a milestone gets a ghost of the combo; a full
  combo gets a wash and a FULL COMBO banner.
- **Display:** full screen on F or a button. No controls show during a take, and with no take it shows a quiet
  waiting state.
- **Plumbing:** it reads sheet-view's channel, which now also carries the judge's combo, milestones and full combo.
- **The way in:** "Stage view ↗" on `/play`'s start screen. The nav bar doesn't cover `/stage`.

## Where it lives
- The page: `web/src/game/stage-view/` (`lane.ts`, `state.ts`, `draw.ts`, `StageView.tsx`, `plugin.tsx`) and
  `web/src/app/stage/page.tsx`.
- Edits elsewhere: `web/src/game/sheet-view/plugin.tsx`, `web/src/game/nav-bar/slots.ts`, `web/src/game/layers.ts`.
- The measurements: `specs/context/nostalgia-stage-findings.md`.
- The choices: `specs/decisions/stage-view-geometry.md` and `stage-view-look.md`.
- The look loop's shots: `specs/features/stage-view/shots/`.

## How to check it
- `pnpm -C web exec vitest run src/game/stage-view src/game/sheet-view`: 18 tests pass, covering the state, the curve
  against a measured note, and the channel.
- The browser checks are not verified locally; main's scheduled full run covers them.
- To see it: open `/play`, click "Stage view ↗", and play.

## Gaps
- **Perf gate** (`perf.mjs` on `/play`): not run locally under the load rule; main's scheduled run covers it.
  - `/stage`'s own JS frame work was measured in the look loop: p95 0.10 ms, max 3.6 ms over 858 frames at
    3840×2160, dev build.
  - The GPU's share of each frame isn't counted.
- **The /play → /stage path wasn't watched end to end.** The look loop drove `/stage` with a scripted take on the same
  channel. The button's click wasn't seen locally.
- **Not seen by Eric** on a second display.
- **Silent:** `/stage` plays no sound.
- **Lab entry** comes after this note lands, per the spec.
