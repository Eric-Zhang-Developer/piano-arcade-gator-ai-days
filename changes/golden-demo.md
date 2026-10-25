## What shipped
Golden's DGX autoplay plays with pedal, dynamics, written note lengths and the recording on one clock (#807).
- **Legato:** the bot holds each key for its written length (#809).
- **Pedal:** from a local `pedal.json`, sent as CC64 on the bot's queue (#836). It lifts on pause, quit and song end.
- **Dynamics:** chart velocities (#836).
- **The recording:** starts on the first press (#824), with no beat under it (#828).
- **One clock** for the piano's MIDI and the recording; calibration moves only the judge (#840).
- **A "Recording offset" row** in Options (#842).
- Golden's sheet has no dynamics or Ped. marks, so its velocities come from the recording's per-bar loudness and its
  pedal from the per-harmony rule (#838). Its charts and `pedal.json` stay local.

## Where it lives
`web/src/game/pedal/` · `web/src/game/scenes/` · `web/src/game/audio-track/` · `web/src/game/beat/` · the row in
`web/src/game/options-panel/` · `specs/decisions/golden-demo-dynamics.md` · `specs/context/findings.md` (2026-10-25)

## How to check it
Not verified: Eric's DGX listen at `/play?song=local/golden-hard&bot=perfect&audible=1&demo=1&beat=off`, from a checkout
at or after this note. The browser checks are not verified locally; they're covered by main's scheduled full run.

## Gaps
- **Whether it sounds like a performance** is Eric's call. Loudness-shaped dynamics are a default; an arrangement of
  our own is the alternative.
- **Golden's `offsetMs`** may want to go back toward 3934 now that the piano is on the recording's clock. Set it by
  ear with the Recording offset row.
