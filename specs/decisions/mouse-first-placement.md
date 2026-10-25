# mouse-first: where the new controls sit, and how the help card checks them

**Context.** The spec names the controls (LEARN and WATCH beside PRACTICE, Easy/Normal chips, a pause button and
◀ ▶ on `/play`, a quiet "? controls" link) and a test, but not their places or the test's method.

**Choices** (each reversible in its own file):
- **The 2×2 at 1280×720.** A second row of buttons pushed the panel 27 px into the footer. The roll went from 20vh to
  17vh, the buttons' padding from 1.5vh to 1.2vh and the row gap to 0.9vh, at every size, so 720 and 1080 keep the
  same proportions. With a "Next for you" strip the roll drops to 10vh (`.panel:has(.next)`): that case was already
  about 29 px over on main, and 43 px with the second row.
- **Easy/Normal** are two buttons in a `Level` group: click the level you want. E still switches.
- **The play corner** sits in the HUD's 120 px status gutter, top right, under beat-track's status line and inside
  the band: 28 px squares, so it covers neither the HUD nor the lanes. Hidden under `?capture=1`, while paused, and
  for ◀ ▶ outside learn mode; `?input=test` never pauses, so no Pause there. A click keeps focus where it was.
- **"? Controls"** is a button in the help overlay that sends a window event: the card lives in the root layout and
  the link on a page. On `/` it takes the old hint line's place in the header; on `/simon` it leads the footer row.
- **The test reads sources, not renders.** Each help line names its control's accessible name (or why it's
  key-only), and the test finds it in the screen's files as an exact string literal or an element's whole JSX text,
  the drift test's method beside it. Rendering every screen in vitest would need `/play`'s canvas stack.

**How to undo.** Revert the CSS values in `duo-select/select.module.css` and `Select.tsx`, move `corner` in
`app/play/page.tsx`, or drop `control`/`keyOnly` and the test from `help-overlay`.
