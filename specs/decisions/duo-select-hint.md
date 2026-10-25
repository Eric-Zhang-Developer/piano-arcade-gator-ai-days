# duo-select: the hint, and LEARN

**Context.** The spec asks for the frame's hint, `↑↓ SELECT · ENTER PLAY · P PRACTICE`, and one PLAY plus PRACTICE.
learn-from-select, watch-demo and easy-charts each added their key to the hint (`L learn`, `W watch`, `E easy`), and
learn-from-select added a LEARN link to song-preview's row. Their checks pin both.

**Options.**
- A: the frame's hint, word for word, and no LEARN. L, W and E still work, but nothing on screen says so.
- B: the frame's style with all six keys, `↑↓ SELECT · ENTER PLAY · P PRACTICE · L LEARN · W WATCH · E EASY`, and no
  LEARN link, because L is the way into wait mode.
- C: the frame's hint, plus a third LEARN button in the panel.

**Choice: B.** The hint is in the frame's monospace caps and still tells a player every key. It fits on one line at
1280×720 and 1920×1080. The panel keeps the frame's two buttons. learn-from-select's and song-options' checks were
made to accept either select first (#695, #697), so main stays green across the switch.

**How to undo.** Change the hint's JSX in `web/src/game/select-layout/index.tsx`. For a LEARN button, add a third
kit `Button` to `FocusPanel` (`web/src/game/duo-select/Select.tsx`) that pushes `learnUrl`.
