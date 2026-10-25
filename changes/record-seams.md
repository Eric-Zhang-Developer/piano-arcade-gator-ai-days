## What shipped
- **The outro (the L-cut).** At a natural songEnd, a local song's recording keeps playing under the results, 6 dB down, then:
  - it fades over two bars to a bar line, with the gain even in dB and 0 exactly on the line; or
  - it plays out when the file ends within 12 s. That's Golden's case: its tail ran 5.7 s live.
- **A lower-third tag** says "♪ Fades at bar N" or "♪ Plays out", with **Stop music**. A faint bar-line pulse runs along the bottom edge while the tail plays.
- **Quit, Retry, leaving /play and Stop music** still silence at once.
- **The intro (the J-cut):** the recording's intro already sounds under the count-in. Its click alignment through `fileOffset()` is now tested.

## Where it lives
- `web/src/game/record-seams/` (the plan, the envelope, the intro check, the fixture, and the tag)
- `web/src/game/audio-track/index.ts` (it schedules the tail, the ducked level, the store and the panel)
- `specs/decisions/record-seams-choices.md`
- Shots: `specs/features/record-seams/shots/`

## How to check it
- `pnpm -C web exec vitest run src/game/record-seams src/game/audio-track src/game/count-in src/game/results-landing`
- `verify-audio`, `verify-count-in` and `verify-landing`: not verified locally; covered by main's scheduled full run.
- Live in the in-app browser on two local test charts cut from Golden: "Fades at bar 12" and "Plays out". Stop music went silent in 0.2 ms.

## Gaps
- **Not heard by Eric.** Validation (c)'s before and after recordings of Golden's last 20 s on the DGX and the laptop voice weren't made. The look loop ran with the recording volume at 0.
- **The song card** doesn't wait for the recording's first sound: `hud/index.ts` is held by #600 and #713. It's about 118 ms early on Golden.
- **An intro longer than the count-in's lead** still joins mid-intro, because #600 holds /play's lead.
- **Bar lines** come from the chart's constant bpm until record-follows' beat map lands. The pulse uses its own bar line, not highway-field's downbeat (#1122 is open; a `ponytail:` line marks the switch).
- **The demo case** (`demo=1`, context suspended until a press) is unchanged: the recording restarts at the clock's time when it wakes.
- **No reduced-motion shot:** the pane can't emulate it in CSS. The stylesheet drops the pulse, the drain and the entrance.
