# hit-line: white line, sine waves, a shadow on the keys, a gradient blob at each pressed key

**Context:** the spec asks for an "electric" stroke, a white core with a soft glow, brighter over a pressed key, and
at most 6 px around the line. It doesn't say the base color, how the motion is made, or how the glow is drawn.

**Options and choices:**
- Base color: today's mint, or white. **White** (`--pa-flare`, "the moment to press"); mint is the right hand's
  color and visual-direction keeps hand colors off chrome.
- Motion: seeded noise, or three fixed sine waves. **Sines**: the same time gives the same path with no state, and
  the bound (amplitudes summing to 2 px) is plain arithmetic.
- Reading on white keys: half the stroke sits on the keyboard, and white on white vanished in round 1, so **a soft
  shadow on the key tops** (8 px, black 0.6 → 0) goes under it.
- Pressed keys: a clipped shadow stroke (hard vertical edges), or **a radial gradient** from white to the key's
  light color. The blob reaches 10 px above the line, past the 6 px bound, but only over a key that was just pressed,
  where its note has already landed.

**How to undo:** in core's `drawHighway`, the hit-line block; `hitLineSettings.waves` for the motion.
