# wet-paint: the pedal curve, and when paint dries

- **Context:** the spec asks for one curve from dry to wet on CC64 (`pedalCurve`, pure, logged), and a dried layer
  that forms on pedal up and never moves again. It doesn't say what happens when a key lifts with the pedal up, or
  what the curve's ends are.
- **The curve:** linear in CC64, `mix(dry, wet, cc / 127)`, exact at both ends.
  - wet (127): density dissipation 0.08 /s, velocity dissipation 1.2 /s, curl 28: blooms swirl, bleed and mix, then
    settle on the canvas.
  - dry (0): density 0.9, velocity 4, curl 4: a short bloom that stops and fades.
  - Picked by eye on the dev server, not measured. Wet velocity damping below about 1 let paint drift off the canvas.
- **Down:** CC64 ≥ 64, the MIDI spec's on/off line. The laptop's Space sends 127 or 0, so no half pedal there.
- **When paint dries:** the live layer fixes into the dried one when the pedal goes from down to up, and, with the
  pedal up, when any key lifts (the dampers are down, so that note's paint stops where it is). With the pedal down,
  nothing dries.
- **"Never moves again":** read as the dried texture changing only inside `fix()`, and only by laying live paint over
  it. A later fix covers dried pixels where new paint lands and keeps the rest exactly. The unit tests check this on a
  CPU model of the two layers.
- **Reduced motion:** velocity dissipation 1000 and curl 0, so splats stay where they land; the pedal still dries them.
- **How to undo:** change `pedalSettings` in `paint.ts`, or drop the key-lift dry in `createPainter.noteOff`.
