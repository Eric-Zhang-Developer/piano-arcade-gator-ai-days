# difficulty: how the WARNING card looks and where it sits

- **Context:** the spec asks for a full-width card reading WARNING with the level during the count-in's first bar,
  keeping to `visual-direction.md`. It doesn't give colors or a position.
- **Options:** A: red hazard stripes (the arcade cliché). B: a `--pa-panel` band with `--pa-magenta` frame lines and
  `--pa-ink` type. C: gold type.
- **Choice:** B. Red is WRONG's only color and gold means PERFECT and the rank; magenta is cabinet chrome, which is
  what the card is. It sits between the fever meter's label and the core count-in digit (top near 0.34 of the
  judgment line), so the two never overlap; the panel is translucent and the digit would show through otherwise.
  It doesn't animate: it's on for the bar and off after, which is also its reduced-motion state. Saira via
  `--pa-font-display`, resolved for canvas once the face is ready.
- **How to undo:** change `warningLayout` and `drawWarning` in `web/src/game/difficulty/index.ts`.
