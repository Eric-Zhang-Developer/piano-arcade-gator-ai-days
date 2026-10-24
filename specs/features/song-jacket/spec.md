---
name: "Song jacket: generated cover art for each song"
depends_on: ["ui-tokens"]
owns: ["web/src/game/song-jacket/"]
assignee: "eric-agent-1"
---

# Song jacket

Cover art for each song, generated from its id: no images, no other artists' covers (`visual-direction.md`).

## Requirements
- `jacketFor(id, title, composer)` in `web/src/game/song-jacket/`, pure and deterministic: an angle and two or three
  gradient stops drawn only from the cabinet colors (`--pa-magenta`, `--pa-cyan`, `--pa-sun`, the sun gradient,
  `--pa-sky`, the tier colors). Never a hand color, never `--pa-wrong`.
- A `SongJacket` component: a square with that gradient and the title's first word (or the composer's surname, if
  the title starts with an article) set large in the display face, italic, cropped by the square's edge.
- The same id always gives the same jacket; different ids should look different.

## Validation
- `pnpm -C web test`: the same id gives the same jacket; every color is in the allowed set; across the library's
  song ids (read `web/public/songs/`), no two share both the angle and the first color.
- Screenshots of every song's jacket side by side in the PR.
- Eric's eye (mark it in the done note): the jackets look designed, not random. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/song-jacket-*.md`.

Frontend lane: #157. Issue: #147.
