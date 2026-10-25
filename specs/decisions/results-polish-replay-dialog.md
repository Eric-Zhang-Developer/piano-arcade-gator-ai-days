# results-polish: Watch replay as a native modal dialog

**Context.** The replay overlay was a plain fixed `<div>` (#1245). Focus stayed on Watch replay behind it, and Tab
walked the results under the black screen. The spec allows a native `<dialog>` with `showModal()`, or
`role="dialog"` with `aria-modal` and the page made inert by hand.

**Choice.** A native `<dialog>`, opened with `showModal()` on mount and named by its caption (`aria-labelledby`). The
Controls card already works this way. The browser owns the focus trap, the inert page and the top layer. Its default
box is undone inline (no border, padding or max size, full screen, black).
- **Focus:** Stop takes focus on open. Focus goes back to Watch replay in an effect after the dialog unmounts. While
  it's open the page behind is inert, so focusing the button from the close handler would do nothing.
- **Esc:** still the overlay's own capture handler. It prevents the dialog's `cancel`, so Stop, Esc and the end all
  stop the piano one way.
- **Stop's size:** Stop takes the caption's size, `clamp(16px, 1.25vw, 24px)`. The kit button's fixed 14 px read
  small next to a 24 px caption at 1920 (round 1 of the look loop).

**How to undo.** In `replay-view/overlay.tsx`, the `<dialog>` back to a fixed `<div>`, and the open/close effect and
the focus effect removed.
