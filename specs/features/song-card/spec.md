---
name: "Song card: one card per song for the music select"
depends_on: ["ui-tokens"]
owns: ["web/src/game/song-card/"]
assignee: "eric-agent-1"
---

# Song card

One component, `SongCard`, in `web/src/game/song-card/`: a song as a card for the music select. Only the card;
`select-layout` places the cards.

## Requirements
- Props: the chart's `title`, `composer`, `catalog?`, note count, `level?` (from `difficulty` once it lands) and
  `focused`.
- Title in the display face, italic, 800; composer and catalog in the body face, dimmed; the note count; a level
  badge that shows "—" when `level` is absent. Never a made-up level.
- Focused: a `--pa-magenta` frame and a slightly larger scale (at most 1.06), 150–250 ms ease-out. Static under
  reduced motion (frame only).
- Room on the left for a jacket (`song-jacket`): a square slot the size of the card's height.
- Long titles truncate with an ellipsis on one line; the full title is in `title=`.

## Validation
- `pnpm -C web test` with `react-dom/server`'s `renderToStaticMarkup`: the title, composer, count and "—" render;
  a given level renders; no level never renders a number.
- A screenshot of three cards (short title, long title, focused) at both sizes in the PR, from a throwaway harness
  page you don't commit.
- Eric's eye (mark it in the done note): the card reads well on a laptop. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/song-card-*.md`.

Frontend lane: #157. Issue: #146.
