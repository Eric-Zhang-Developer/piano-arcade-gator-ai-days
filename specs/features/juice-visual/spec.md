---
name: Visual juice: wisps, bursts, lane light, fever, full combo and rank reveal
depends_on: ["core-loop"]
owns: ["web/src/game/juice/"]
assignee: "eric"
---

# Visual juice

Make every hit feel good without hiding the next note. Effects rise *above* the judgment line into empty space
(Synthesia's flare and plume; Nostalgia's burst and light pillar). Register as one `GamePlugin` in
`web/src/game/layers.ts`. Frames to study: `specs/context/references/synthesia-brahms/`, `nostalgia-flower/`,
`guitar-hero-3/`.

## Requirements
- **Hit:** on `noteHit`, a short flare where the note meets the line and Synthesia-style wisps (soft particles)
  rising from it, fading within about 1.5 s. PERFECT is brighter than GREAT. The effect is as wide as the key.
- **Held note:** a thin stream of sparks while a hit note's key is held.
- **Lane light:** a pressed key's lane glows faintly up from the line, even when no note is there.
- **Miss:** no burst; a brief desaturated flash on the line at that key.
- **Fever** (`feverStart` to `feverEnd`): the one whole-screen state. The highway edges glow and the background
  warms. Notes keep their color. While `fever-stage` is mounted, the background is the stage's job: draw only the
  edges.
- **Full combo:** on `fullCombo`, a large FULL COMBO banner over a dimmed highway for about 2 s, before the results.
- **Rank reveal:** the results screen's rank letter appears with a short scale-in.
- **Readability rule:** effects never cover a note that is less than 500 ms from the line, and dense passages cap
  the particle count (default 300 particles on screen).

## Validation
- Vitest: the particle system's update step is pure; given a seed and a scripted event list, the particle count
  stays under the cap and every particle dies within its lifetime.
- `verify.py`: screenshots mid-song and in fever, from the verify run.
- Eric judges the feel on the piano (`not verified on the piano` until he does).

## Defaults
- Canvas 2D only; no WebGL or effect libraries without a `contract:` PR. (The 3D stage behind the highway is
  `fever-stage`, not this feature.)
