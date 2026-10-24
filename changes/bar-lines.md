## What shipped
A faint line across the highway at each bar start, with the bar number just above it at the left edge, drawn under the notes (white at 0.12; the number in ink at 0.2, 12 px at 720 tall). Bar n starts at (n − 1) × beatsPerBar beats, computed per bar. Bar 1's line arrives during the count-in, and nothing draws over the keys. In a bar-loop take the numbers are the song's: `from=5&to=6&passes=2` reads 5, 6, an unnumbered line, 5, 6, at any tempo. A test pins the calm rule: the line and the number are each no brighter than the dimmest note.
## Where it lives
`web/src/game/bar-lines/` (`barLines`, `drawBarLines`, `barLineSettings`, tests) · one optional `barLines` field in `HighwayState` and one call in `web/src/game/core/highway.ts` and `web/src/app/play/page.tsx` (#326) · screens in `specs/features/bar-lines/screens/`
## How to check it
`pnpm -C web test` (bar-lines and core/highway tests). `verify.py --slug bar-lines`: pass at 6425e52. Headless 1920×1080: Für Elise's count-in shows bar 1's line coming down, mid-song shows bar 7's line under the pills, and the Twinkle 5–6 loop shows "5".
## Gaps
- **Not tried on the piano.** Eric: play Für Elise and say whether the lines help you keep your place or clutter. Not verified by Eric.
- **The loop's full 5, 6, null, 5, 6 sequence is proven by the unit test,** not one frame: the 2 s lookahead shows one or two bars at a time.
- **No `?bars=off`,** per the spec's Defaults.
