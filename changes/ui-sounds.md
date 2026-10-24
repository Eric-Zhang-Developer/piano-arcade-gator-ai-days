## What shipped
Short synthesized menu sounds: a blip when ↑/↓ moves the focus on `/`, two rising notes when a song is chosen, and a rising arpeggio when the stage card shows. `back`, `tick` and `tickAccent` are ready for pause-skin. Every sound peaks at most at song-preview's tone level (~0.05), follows the effects volume and mute, and nothing plays before the page's first key press or click.
## Where it lives
`web/src/game/ui-sounds/` (#349), the callers in `select-layout` (#351) and `stage-card` (#352), `tone`/`noise` exported from juice-sound (#335), `specs/decisions/ui-sounds-warm-context.md`.
## How to check it
`node web/src/game/ui-sounds/verify-ui-sounds.mjs --out <dir>`: pass on main at fe7283f (nothing on load; one move per ↓, none at the end; one confirm and one sting on Enter; none muted; none on a direct /play load). `verify.py --slug ui-sounds` pass at 5faec8c (the combined branch).
## Gaps
Not verified by Eric: whether the sounds sit under song-preview and the DGX, and are still fine after 20 moves. Levels are at the cap, untuned by ear. Look regression: the stage card is pixel-identical before and after; the select differs only in select-stage's random stars. The AudioContext is made in idle time after load, not on the first sound (the spec's default), because its constructor froze the first ↓ for 0.3–1.6 s.
