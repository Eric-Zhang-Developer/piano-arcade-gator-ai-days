## What shipped
`/real-keys` (spike, experiment): calibrate a camera on the key bed with 4 corners, measure its latency from 8 presses,
then play with the highway's notes falling onto the live picture of the real keys. Clip mode replays a recorded clip
with its MIDI log. `spikes/real-keys/` has the recorder, the synthetic clip maker and the scorer.

## Where it lives
- The page: `web/src/game/x/real-keys/`, `web/src/app/real-keys/page.tsx`, and the Lab entry in `web/src/game/x/index.ts`.
- `nav-bar/slots.ts` hides the nav bar on `/real-keys`.
- The spike: `spikes/real-keys/` (`record.html`, `synth.mjs`, `score.mjs`, `FINDINGS.md`).
- The decisions: `specs/decisions/real-keys-geometry.md` and `real-keys-latency.md`.
- The shots: `specs/features/experiments/shots/real-keys/`.

## How to check it
- `pnpm -C web exec vitest run --passWithNoTests src/game/x/real-keys`: 15 pass.
- `node spikes/real-keys/score.mjs --check`: ok.
- Browser checks: not verified locally; main's scheduled full run covers them.

## Gaps
- **Camera runs pending:** no still, latency clips or play clip from the DGX yet.
  - (a)'s reprojection and the real latency are unmeasured.
  - The threshold (12) and the black keys' length (0.62) are guesses.
- **No skin mask.**
- **Wait and flow modes aren't wired:** Perform only.
- **The perf numbers** are JS frame work from a dev build in a hidden pane, not GPU time. `perf.mjs` wasn't run
  locally; main's scheduled run covers `/play`'s link.
- **(d), the capture-mode WebM,** waits on the camera.
