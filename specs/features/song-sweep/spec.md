---
name: "Song sweep: a bot plays every song and leaves a contact sheet of screenshots"
depends_on: ["scenes", "hud", "fever-gauge"]
owns: ["web/src/game/song-sweep/"]
assignee: "eric"
---

# Song sweep

No one has seen every song with every plugin on. A problem on one chart (a label, the zoom, a panel) shows only when
someone happens to play that song, and the video can't afford to find it on camera. One command has a `rank-a` bot
play each song at 1920×1080 and puts six frames per song on one HTML page, with each song's console errors. Its
first run is on today's main, and each finding becomes a bug issue. This feature fixes nothing.

Issue: #264

## Plan
1. `feat(song-sweep)`: `sweep.mjs` in `web/src/game/song-sweep/`. One PR.
2. **The first sweep** runs on that branch, which is `origin/main` plus the script, so it shows main as it is; name
   the commit. The PR gets the summary line and one screenshot of the sheet (the only image committed, in this spec
   folder). The sheet and its frames stay in the output folder.
3. **Findings:** look at every shot against the list in Requirements. Each finding becomes a `bug` issue, following
   AGENTS.md's "Bug reports" (search first; the second repro is `--song <id>`): title `<song>: <what's wrong>`, and a
   body with the commit, the shot's path, the repro command, and expected against observed. Nothing is fixed here.
   The done note lists the issues.

## Requirements
- **One command:** `node web/src/game/song-sweep/sweep.mjs`, after `pnpm -C web install` and
  `pnpm -C web exec playwright install chromium`. It runs `next build`, serves it with `next start` on a free port,
  and stops the server at exit. `--base <url>` skips both and uses a running server. `--out <dir>` defaults to
  `<git common dir>/agent-evidence/song-sweep/<UTC stamp>/` (as verify.py: never committed). Its last line printed
  is the sheet's path. Headless Chromium through Playwright, as `web/e2e/verify.mjs` does, at a 1920×1080 viewport.
- **Songs:** every song link on `/` (`a[data-testid^="song-"]`; `song-preview` is a panel, not a link), in list
  order: ten on a clean checkout, plus any under `songs/local/`. `--song <id>` (repeatable) sweeps only those. Each
  plays in a fresh page, one at a time, at `/play?song=<id>&bot=rank-a&labels=notes&capture=1`: note names as on
  MIDI, and capture-mode's clean frame (ignored until it ships). `--params <query>` sets keys over those. Start is
  clicked the way `take-graph/verify-take-graph.mjs` clicks it.
- **Shots,** PNG at `<out>/<id>/<shot>.png`:
  1. `start`: the start screen, stage card included, before Start.
  2. `25`, `50`, `75`: when that share of the chart's notes has been judged. That's PERFECT + GREAT + GOOD + MISS
     from `window.__pianoArcadeHud`, over the note count in `<base>/songs/<id>/chart.json`.
  3. `fever`: the first moment `window.__pianoArcadeFeverGauge.fever` is true. If fever never comes, "no fever".
  4. `results`: the whole page once `[data-testid="results"]` shows.
- **Errors:** every `console.error` and `pageerror` line, per song.
- **Contact sheet** at `<out>/index.html`, with relative links so the folder opens anywhere. A header with the commit,
  base URL, URL params and Chromium version. One row per song: its six shots as thumbnails linking to the full PNGs,
  each with the judged count when it was taken, its rank (`[data-testid="rank"]`, or "no results"), and its errors.
- **Time limit:** a song that hasn't reached its results 60 s after its chart's length is marked "timed out", and
  the sweep goes on.
- **Exit:** 0 when every song reached its results with no `pageerror`; 1 otherwise, naming the songs; 2 when the
  build fails, the browser is missing or the server can't be reached. `console.error` lines are listed but don't fail.
- **A finding is:** a song that timed out, didn't reach its results or logged an error; text clipped, cut off or on
  top of other text; a label, panel or effect over a falling note due within 500 ms (visual-direction's rule); a blank
  frame or the wrong song. Anything else that looks off goes in the PR for Eric's eye, not in an issue.

## Validation
- From a clean shell: `node web/src/game/song-sweep/sweep.mjs` -> `index.html` with one row per song on `/` and six
  cells per row ("no fever" counts as one), the 25, 50 and 75 counts rising and each at or over its share, and an exit
  code that matches the sheet: 0 only if no row shows a timeout, "no results" or a `pageerror`. A nonzero exit whose
  songs all have bug issues is a pass for this feature: finding them is its job.
- `--song twinkle` -> one row. `--base http://localhost:1` -> exit 2 within a few seconds, saying the server isn't
  reachable.
- `verify.py --slug song-sweep` passes (`/play` doesn't change).
- Eric's eye (mark it in the done note): open the sheet and say what looks wrong. Each problem becomes an issue.

## Defaults
- One song at a time. Pages in parallel would load the CPU and shift the bot's timing.
- Everything the URL doesn't set (stage, zoom, beat) stays at its default, as the video plays.
- Full-size PNG: a faint line (bar-lines) has to survive the shot.
- A finding already in an open issue gets a comment with the new shot, not a second issue.
