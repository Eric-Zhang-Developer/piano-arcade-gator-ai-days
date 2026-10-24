## What shipped
The song preview on `/` shows one quiet line under its row: "Source: Mutopia ↗" (nine songs) or "Source: Wikipedia ↗" (Twinkle, its pinned revision), linking each chart's first non-license score URL in a new tab, with the full citation as its tooltip. It stays visible under `?capture=1`: it's the proof a judge clicks, not setup text. A citation with no http(s) URL shows as plain text; `"Eric"` reads "Arranged by Eric".
## Where it lives
`web/src/game/song-sources/` (`sourceLink`, `SongSource`, tests, `verify-sources.mjs`; #470) · `web/src/game/song-preview/index.tsx` mounts it (#483) · screens in `specs/features/song-sources/screens/`
## How to check it
`node web/src/game/song-sources/verify-sources.mjs --out <dir>` prints `verify-sources: pass`: all ten songs' links match their first non-license URL, and Twinkle's click opens the `oldid=1378689555` page (stubbed). `verify-preview.mjs` passes unchanged. `verify.py --slug song-sources`: see the PR.
## Gaps
- **Not looked at by Eric:** on `/` at the booth screen, the line reads and doesn't crowd LEARN or PRACTICE 70%.
- At 1280×720 the bottom-left corner overlapped until #492 (the select's in-flow footer); the 720p screen here is retaken after it lands.
