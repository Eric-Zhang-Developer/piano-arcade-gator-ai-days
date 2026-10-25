# wet-paint: splats, sizes, ranges and the sim resolution

- **Context:** the spec says each note is a splat from the bottom edge, velocity sets size and force, and a held note
  keeps feeding ink until its release. It leaves the numbers open.
- **A held note is a brush that climbs** (`jet()` in `paint.ts`): the ink source starts just above the key (y 0.06)
  and climbs while the key is held, 0.12 to 0.42 canvas heights a second from pp to ff, up to y 0.94, where it stops
  inking (ink left at the resting point pooled into a blot). The push is only a burst at the strike (60 to 220 of the
  solver's force units, decaying over 0.2 s); after it the ink trickles at 45 % and the force is 0. Why: in this
  solver a narrow push every frame of a hold builds momentum and carries the paint off the canvas, and one kick alone
  sits as a dome by the key (FINDINGS.md).
- **Sizes:** radius 0.014 to 0.05 of the solver's `SPLAT_RADIUS` units (its pointer default, 0.25, is a whole hand);
  ink strength 0.05 to 0.12 a frame at the strike. Picked by eye.
- **Ranges:** a MIDI piano draws 21-108 (A0-C8); laptop keys alone draw 48-84 (C3-C6), so Z and X have an octave each
  way from C4. The first MIDI input switches the strip to the piano range. White keys share the width; a black key is
  0.6 of a white, centered on the line between its whites; a note's x is its key's center.
- **Sim resolution:** a quarter of the canvas's backing height (`simShare` 0.25; `?sim=<px>` overrides), dye at half.
  At 1920×1080 with devicePixelRatio 2 that's a 961×465 grid under a 3840×1858 canvas.
- **The registry href is `/paint?x=wet-paint`,** not `/paint`: experiments' frame test requires every entry's href to
  carry its own `?x=`. `/paint` ignores the parameter.
- **How to undo:** the numbers are `splatSettings` in `paint.ts` and `paintSettings` in `WetPaint.tsx`.
