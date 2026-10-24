---
name: "Music select layout: the song cards as an arcade music select"
depends_on: ["song-card", "song-jacket"]
owns: ["web/src/game/select-layout/"]
assignee: "eric-agent-1"
---

# Music select layout

`/` becomes an arcade music select: the first shot of the video.

## Plan
1. The layout component in `web/src/game/select-layout/`.
2. A `fix(song-select)` PR: `web/src/app/page.tsx` renders it. Song select's loading and sorting stay its own.

## Requirements
- Left: the focused song's jacket, large, with its title, composer, level and note count. Right: the list of
  `SongCard`s, the focused one framed. A "Piano Arcade" wordmark in the display face at the top.
- ↑/↓ move, Enter plays, click plays; the first song is focused on load. Moving the focus scrolls the list so the
  focused card stays in view.
- Song select's data-testids and the verify path (open `/`, pick Twinkle, reach `/play`) keep working.
- Fits 1280×720 and 1920×1080 without page scroll; 10 songs fit or the list scrolls inside its column.

## Validation
- `verify.py --slug select-layout`: the verify path passes.
- In Chrome: ↑/↓ through every song, then Enter -> `/play` loads the focused song.
- Eric's eye (mark it in the done note): pick a song with the keyboard; does it feel like an arcade. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/select-layout-*.md`.

Frontend lane: #157. Issue: #148.
