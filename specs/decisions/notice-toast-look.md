# notice-toast: the look and the API

Context: the taste step-8 Look at 1280×720, 1920×1080 and reduced motion, and choices the spec left open.

- **Legibility over notes.** In the game on /sim, a mint note passing under a toast made its text hard to read: `--pa-panel` is 72% opaque.
  - Choice: `backdrop-filter: blur(8px)` behind the toast. It keeps the panel token, and no new color means "warning".
  - Undo: delete the property in `index.ts`'s CSS.
- **Width.** The cap is on each toast, `min(18em, 40vw)` in its own font. A cap on the stack, in the stack's 16 px `ch`, was narrower than a 24 px toast.
- **Top.** The stack sits at a fixed 96 px: the HUD band's 84 px cap plus a gap. It doesn't follow the band's height at smaller sizes, which only puts it a little lower than it needs to be.
- **Leaving.** A toast fades from 3.8 s and is gone at 4 s. Under reduced motion it stays the full 4 s and goes at once, and a dropped fourth goes at once too.
- **One toast per state change.** midi-watchdog toasts when a stall starts and when it ends, not on each 3 s retry of a still-silent port. RECONNECTED and CONNECTED are new words, so the end of a state is said too.
