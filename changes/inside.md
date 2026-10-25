## What shipped
- /inside ("Inside the Piano" in the Lab) is a grand's double-escapement action, moved live by the DGX's keys and CC64, or by laptop keys at velocity 80.
- The page has two views: one key in section with its parts named, and all 88 as instanced keys, hammers, dampers and strings.
- Play Moonlight drives the piano and the action from one schedule. Each approach lands on its note's send time, and the pedal lifts the dampers as a wave.
- A live note-on is drawn as the strike at once, with no approach.

## Where it lives
- Code: `web/src/game/x/inside/` (`action.ts`, `geometry.ts`, `schedule.ts`, `scene.ts`, `Inside.tsx`) and `web/src/app/inside/page.tsx`.
- Mounts: the registry line in `x/index.ts` and `/inside` in `nav-bar/slots.ts`.
- Decisions: `specs/decisions/inside-{geometry,timing,look}.md`.

## How to check it
`pnpm -C web exec vitest run src/game/x/inside` (12 pass). Browser checks: not verified locally; covered by main's scheduled full run.

In the dev server at 1920×1080 with `?midi=sim`, with 10-note chords and the pedal down, per-frame CPU work time over 3 runs of 5 s:
- **row view:** p95 0.4, 0.4 and 0.3 ms;
- **cutaway:** p95 0.4, 0.4 and 0.5 ms;
- **worst frame:** 9.0 ms, against 16.7 ms.

## Gaps
- **Not seen by Eric.** For the morning page, ranked low: at `localhost:3001/inside`, a minute of keys and pedal on the DGX, then Play Moonlight in All 88. The pedal shot is `specs/features/inside/shots/moonlight-pedal-row-1920.jpg`, flagged on #975.
- **Proportions:** only blow, let-off, backcheck, damper start, key dip and key pitch are sourced. The rest, the string scale and the timings are illustrative choices (decisions above).
- **Perf:** the timing is CPU work around update and render, as perf-budget's probe measures it. GPU time isn't measured, and the pane was hidden (a 16 ms MessageChannel loop stood in for rAF).
- **Untested:** the echo guard, the DGX's real CC64 stream and laptop sound weren't tried; with no piano output, Moonlight plays silent.
