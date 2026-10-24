---
name: "Stage card: ARE YOU READY before the song"
depends_on: ["ui-tokens", "play-slots", "song-jacket"]
owns: ["web/src/game/stage-card/"]
assignee: "eric-agent-1"
---

# Stage card

`/play`'s start screen as an arcade stage card (Chunithm's opening card is the model): the second shot of the
video.

## Requirements
- A plugin in `web/src/game/stage-card/` (one line in `layers.ts`) whose `startPanel` shows: "ARE YOU READY" in the
  display face, the song's jacket, title, composer and level ("—" until `difficulty` gives one), and the Start
  control the start screen already has.
- On Start, the card clears within 250 ms, before the first note reaches the screen. Instant under reduced motion.
- The start screen's existing controls (volume, mute) stay reachable.

## Validation
- `pnpm -C web test`: the panel renders the chart's title and "—" without a level.
- `verify.py --slug stage-card` passes (the verify run presses Start).
- Eric's eye (mark it in the done note): press Start; does it feel like a stage. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/stage-card-*.md`.

Frontend lane: #157. Issue: #149.
