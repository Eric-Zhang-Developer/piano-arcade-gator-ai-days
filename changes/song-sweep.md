## What shipped
`node web/src/game/song-sweep/sweep.mjs` builds the app, serves it with `next start`, and has a rank-a bot play every song on `/` at 1920×1080, one at a time. It writes a contact sheet (`index.html`) with six frames per song (start; 25, 50 and 75% judged; first fever; results), each song's rank and its console errors. Flags: `--song <id>` (repeatable), `--base <url>`, `--params <query>`, `--out <dir>`. Exits 0, 1 or 2 as the spec says.
## Where it lives
`web/src/game/song-sweep/sweep.mjs` · the first sheet's screenshot in `specs/features/song-sweep/contact-sheet.png` (frames stay in `.git/agent-evidence/song-sweep/`)
## How to check it
The first sweep on main b1a4121 (the sheet's header says 22ebbb2, the empty claim commit on top of it): 10 songs, all rank A, all reached fever, 0 error lines, exit 0. `--song twinkle` gives one row. `--base http://localhost:1` exits 2 in about 0.5 s. `verify.py --slug song-sweep`: pass at 7092ded.
## Gaps
- **Findings:** #311 (clair-de-lune: the judgment word and combo cover long notes due within 500 ms). By design and not filed: the HUD cuts long titles with an ellipsis (moonlight-3's title, ode-to-joy's subtitle), which is left for Eric's eye.
- **Eric's eye on the sheet is not done.**
- **`capture=1` was on;** capture-mode had shipped by then.
