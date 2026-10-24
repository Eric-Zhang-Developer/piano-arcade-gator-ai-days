---
name: Song select: pick a piece from the library
depends_on: ["core-loop"]
owns: ["web/src/app/page.tsx", "web/src/game/song-select/"]
assignee: "eric"
---

# Song select

The front door, and a 3-second shot in the video. It reads like a concert program: piece, composer, catalog number.

## Plan
1. If `/play` still ignores `?song` (it was hardcoded to Twinkle, #75), first make the `fix(core-loop)` PR that
   core-loop's spec now requires. `/play` is core-loop's, so song select's own PR can't change it.
2. Then build the list.

## Requirements
- `/` lists every chart under `web/public/songs/` (any `chart.json`, at any depth, including the chart compiler's
  `library/` folder), read at build time, so there's no index file to keep in sync.
- Each row: title, composer, catalog (if any), the note count, and a difficulty placeholder ("—") until a difficulty
  rating exists. Never show a made-up difficulty.
- Choosing a row opens `/play?song=<id>`. Arrow keys and Enter work, as well as clicks.
- With one chart, the list still works and shows one row.

## Validation
- Vitest: the chart loader returns every valid chart and skips (and reports) an invalid one.
- In Chrome: open `/`, pick each row in turn -> `/play` loads that song, not Twinkle every time.
- `verify.py`: the verify run opens `/`, selects Twinkle and reaches `/play`.

## Defaults
- Sort by title until a difficulty rating exists.
