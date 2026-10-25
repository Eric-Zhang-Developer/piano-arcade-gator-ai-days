# key-polish look brief (research step, #848)

Sources: `synthesia-brahms` 0m17s6-crop, 0m18s, 2m13s-crop; `nostalgia-flower` 0m45s; the PianiCast Flower Dance
cover (`video-references/…[rA_2B7Yj4QE].mp4`, frames at 20, 45, 90 and 120 s, cropped); today's playfield
(`specs/features/hit-particles/shots/final-1920.jpg`, Maple Leaf Rag in fever). Rules from `visual-direction.md`: hue
is the hand (blue R `#2B9BFF`, purple L `#A07CFF`), brightness is time to hit, the flare is white, notes ~2 px corners,
keys keep the real key's shape, no neon soup.

## What the references do that we don't

| | Synthesia (Brahms) | PianiCast | Ours today |
|---|---|---|---|
| Note body | flat fill, brightness by time, white-hot head | slim (≈⅓ key) lavender bars, soft glow, no outline | flat fill, 35→100 % alpha, a hard 1-line white head, a letter label |
| Long notes | tall bar, gradient along its length | slim bar, same as short | flat bar, reads the same as short |
| Contact | note "eaten" at the line, white flare, key lit below | flare blob at the line, glow pours *down* into the key | consumed on hit; the key fills flat; a white blob on the line |
| White keys | real ivory under light: cool white, soft gap shadow | warm ivory, visible gaps, darker near end | flat light grey gradient, hairline gaps, uniform |
| Black keys | glossy, a lit top face and a darker front | glossy with a top sheen | one dark fill with a 1.5 px bevel line at 86 % |
| Pressed key | glows mint from the top, light spills onto fingers | lit from the line down, colour fades toward the near end | solid hand-colour fill with a shadow-blur glow; reads as a paint swatch, not light |
| Keybed | black; the line sits on the keys | a thin pink rail over the keys | an 8 px dark shade under the line |

## Today's three biggest problems (from the 1920 frame)
1. **The pressed key is a flat swatch.** A pressed C5 is a solid lavender rectangle the full key height; it looks
   painted, not lit, and it hides the key's shape. In both references the light comes from the line and falls off down
   the key.
2. **The keyboard is a diagram.** Whites are flat grey with no gaps or depth; blacks have no top face. Next to
   hit-particles' bloom the keyboard is the least finished thing on screen.
3. **Notes are flat stickers.** Uniform fill, a hard white line for the head, no edge light, no sense of glow near
   the line; long notes and short notes have the same treatment.

## Direction (to try in the look loop, cheapest first)
**Keyboard**
- Ivory whites: a vertical gradient (cool white at the top to a slightly warmer grey at the near end), a 1 px dark gap
  between keys, a soft shadow cast by each black key onto the whites, and a darker near-end lip (the key's front edge).
- Black keys with a lit top face: a lighter top face, a thin gloss highlight down one side, a darker front (the
  bevel already there, widened into a front face).
- A felt strip and keybed shadow: a 2–3 px deep-purple-to-black strip just under the hit line, so the keys sit
  *under* the line rather than touching it.
- Key travel when pressed: the key's front lip shrinks by 2–3 px and its top darkens slightly; the neighbours' cast
  shadows on it shorten. Cheap, no layout change (keyX stays).

**Pressed light**
- Replace the solid fill with a light that pours down from the line: hand colour at the top (≈85 % over the ivory)
  falling to ≈15 % at the near end, white-hot for the first few px under the line, scaled by velocity where the input
  has it.
- Fade on release over ~120 ms instead of a cut (reduced motion: a cut).
- Keep the glow onto neighbours, but as a gradient at the top only, not a full-height shadow blur (cheaper too).

**Falling notes**
- A body gradient: the hand colour, slightly lighter at the leading (bottom) end; a 1 px inner highlight on the left
  edge; the white head becomes a short soft white gradient (≈6 px) instead of a hard line.
- A glow that grows over the last ~400 ms before the line (a soft shadow in the hand colour, alpha rising), so the
  next note to land is the brightest thing in its lane.
- Long notes read as sustained: a faint inner core line down the middle of the body; while held, the note is consumed
  at the line (its bottom pinned to the line, shrinking) while its key glows. Needs the held state from core; check
  what `noteState` already says before adding anything.
- Width: stay Synthesia-wide. PianiCast's slim bars are elegant but carry no label and lose the key-to-lane read at
  88 keys; we draw note names (note-labels). Logged as a decision if kept.
- Chords: no extra shape; same-beat notes already align. Revisit only if a round shows them reading as noise.

## Guard rails
- hit-particles' bloom stays the brightest thing at the line; the key light must not add a second bloom there (cap
  the white-hot part at a few px, no additive blend).
- #747's hit line: 2 px white-hot with the purple-to-blue glow. The felt strip sits under it, not over it.
- Upcoming notes always legible: no glow on notes more than ~400 ms out; the far-dim rule stays.
- Perf: gradients cached per key width/colour (no new gradient per key per frame where a cached one will do);
  `perf.mjs` p95 ≤ 6 ms at 1920 on maple-leaf-rag in fever, before and after.
- Reduced motion: no release fade, no growing glow animation (static brightness only), no travel.

## Shots per round
Maple Leaf Rag (dense, fever) and Clair de Lune (slow, long notes) at 1280×720 and 1920×1080, plus reduced motion;
keyboard crops at 1920 for the key detail.
