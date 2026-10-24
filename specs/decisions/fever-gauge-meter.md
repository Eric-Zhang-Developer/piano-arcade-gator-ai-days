# fever-gauge: where and how the meter draws

- **Context:** the spec says "beside the HUD, never over the lowest 40%", shows the fill and a lit state in fever,
  and keeps to `visual-direction.md`. It doesn't say where exactly, or how thick.
- **Options:** A: a thin full-width bar right under the HUD's top panel. B: a vertical bar at a screen edge. C: inside
  the HUD panel.
- **Choice:** A. It reads as part of the HUD, stays at the top edge (visual direction's "loud edges"), never crosses
  the lanes near the hit line, and needs no change to the HUD (C would be the HUD's code). It fills in `--pa-sun`,
  burns in the sun gradient during fever, and carries the word FEVER (dim, then lit), so the state isn't color alone.
  The font stays the HUD's `system-ui` until `ui-tokens` lands Saira.
- **How to undo:** change `meterLayout` and `drawMeter` in `web/src/game/fever-gauge/index.ts`.
