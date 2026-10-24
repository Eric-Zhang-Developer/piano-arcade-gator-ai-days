## What shipped
Each song plays on one fixed keyboard, C to C, at least four octaves (two at first; see `specs/decisions/static-keyboard-min-4-octaves.md`), from the chart as loaded: Twinkle, the Minuet, Ode to Joy, Chopin and Clair de Lune C2–C6 (29 white keys), Für Elise and Gymnopédie C2–C7 / C1–C6 (36), Moonlight, the Nocturne and Maple Leaf C1–C7 (43). highway-zoom is off unless `?zoom=on`; the laptop map moves only on Z and X, and its hint shows only when the song doesn't fit the map where it starts. Code: #391, #408 (core-loop), #395 (highway-zoom), #411 (laptop-octaves).

## Where it lives
`web/src/game/core/range.ts` (`staticRange`), `web/src/game/core/highway.ts` (`makeLayout`'s `keys`), `web/src/app/play/page.tsx` (`keysRef`), `web/src/game/highway-zoom/index.ts`, `web/src/game/laptop-octaves/index.tsx`; screenshots in `specs/features/static-keyboard/screenshots/`.

## How to check it
`verify.py --slug static-keyboard`: pass at b1764d0, 42/42 PERFECT with test input and through the MIDI path on /sim. Song sweep at cf075b3: all ten songs rank A, no errors, and the white-key count in each song's 25/50/75%/first-fever frames is constant and matches the table above (pixel count of the seams between white keys). Für Elise at 1920×1080, `bot=perfect`: 36 keys at the count-in, 25% and 75%; `?zoom=on` still pans (22 keys in its frame).

## Gaps
- Eric's piano check (Für Elise on the DGX): not verified by Eric.
- The 43-key songs' lanes are about 45 px wide at 1920; not raised here, Eric's call.
- replay-view may show a narrower keyboard for `hands=` or bar-loop takes: #419.
- The sweep's contact sheet stays in `.git/agent-evidence/static-keyboard/sweep/`, not in the repo (60 frames).
