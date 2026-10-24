# fever-moment: how loud the edge flash is, and the banner's cover

**Context.** The spec asks for an edge flash "wider and brighter than juice's steady glow" and a banner that covers
the HUD band's counts, combo and score. It sets no numbers. In the Look pass (taste v2 step 8, maple-leaf-rag with
`bot=fever` at 1920×1080), round 1 used a 180 px strip at 0.75 alpha with a linear inward fade. That read as a
slightly warmer version of juice's 90 px, 0.38 glow, not as a moment.

**Choice.**
- The flash is 300 px wide at full strength at its 200 ms peak. Its inward fade is eased (45% erased at 35% of the
  width), so it stays bright at the edge. It fades to nothing toward 0.75 of the line, and to juice's glow by 2 s.
- The banner's cover is `--pa-bg` (opaque black), fading in with the sweep (260 ms) and out with it (the last
  320 ms). FEVER is italic 900 Saira at 0.72 of the band's height, in the sun gradient with a soft sunTo glow.

**How to undo.** `momentSettings` in `web/src/game/fever-moment/index.ts` (`edgePx`, `edgeAlpha`, the timings),
and the `inward` stops in `drawMoment`.
