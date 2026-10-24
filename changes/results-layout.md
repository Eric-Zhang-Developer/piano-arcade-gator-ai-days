## What shipped
`/play`'s results screen opens on one window with no scroll: the song's title, a big gold rank, the six counts in their
token colors, score · accuracy · max combo, the timing line, the take graph, then Retry · Replay on piano · Songs.
Every other results panel is a named card in a details grid below ("Details ↓"), and latency and sound controls sit last.
## Where it lives
`web/src/game/results-layout/` (layout, settings: `featured`, `actions`, `names`), `web/src/app/play/page.tsx`;
screenshots in `specs/features/results-layout/`; choices in `specs/decisions/results-layout-panels.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (results-layout, fea2b36); verify-ghost and
verify-records pass too (Retry and Enter on the results screen).
## Gaps
The no-scroll check is a screenshot script (rank top 77–222 px, Retry bottom ≤ 656 px at 1280×720 and 1920×1080), not a
test. NEW RECORD's initials prompt is a details card, below the fold. Eric's eye: not verified by Eric.
