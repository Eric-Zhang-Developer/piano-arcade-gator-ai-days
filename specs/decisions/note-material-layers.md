# note-material: the layers' values

**Context.** The spec asks for a log of every choice it leaves open: the falloff, the texture's amplitude and scale,
the burn line, the black-key depth, the sprite buckets, the LOD threshold, and how the emission ramp meets `glowMs`.
All of them live in `materialSettings` (`web/src/game/note-material/material.ts`).

**Choices** (each the smaller, reversible option, to be tuned in the look rounds):
- **The emissive core:** the center 38% of the pill's width mixes in up to 30% white, and the edges keep the pure
  hand color. It reads as a lit rod rather than a flat bar, and it reads the hand color at draw time, so hand-palette's
  pick carries through.
- **Emission and glowMs:** two separate stages. The bloom sprite starts at key-polish's `glowMs` (400 ms) as the old
  `shadowBlur` glow did. The emission is white heat over the whole rod, 0 → 42% over the last 300 ms. So a note first
  glows, then ignites.
- **Falloff:** the trailing end darkens from 32% black to none over 36 px, or over half the note if it's shorter.
- **Texture:** 2.5% white bands, four per beat, each half a spacing tall. The phase is the chart clock inside its beat,
  so a band moves one spacing per beat. It's drawn on notes of 1 beat or longer, and never if a spacing is under 4 px.
- **Burn line:** 3 px at the hit line, the hand color mixed 70% toward white, under key-polish's key light (heldGlow
  0.35 of the bloom keeps feeding the key).
- **Black keys:** the body mixes 16% black. The rim and edge are the same as a white key's.
- **The specular edge:** 30% white, `1 / pixelRatio` CSS px, where the ratio is the canvas's (capped at 1.5 by
  `settings.pixelRatioCap`).
- **Chord hairline:** one device pixel across the leading ends of notes that start within 1 ms of each other. Its
  luminance over the field is 60% of the way from the field to the dimmest note in the chord.
- **Sprites:** width rounded up to 4 px, and height to 16, 32 or 64 (only the leading end blooms). There's one sprite
  per hand color and bucket, blurred once at build time, with 14 px of blur room.
- **LOD:** past 48 notes on screen the texture goes; past 96 the bloom goes too. These are starting values; the
  maple-leaf-rag perf runs set them.

**How to undo.** Change `materialSettings`. Every layer is a value there.
