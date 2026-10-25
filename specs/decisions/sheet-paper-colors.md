# sheet-paper: the judgment colors on paper

**Context.** On the paper panel (`--pa-paper` #f2ede3) the HUD's judgment hues wash out: PERFECT gold #ffe27a
measures 1.10:1, GREAT #5ef2c4 1.20:1, GOOD #7cb7ff 1.79:1 and MISS grey #8a8f98 2.78:1 (WCAG contrast, computed;
verify-paper read the same on origin/main). The spec asks for darker variants of the same hues with at least 3:1.

**Options.**
- A: darken each hue in HSL lightness only, keeping hue and saturation, until it reaches 3.5:1 (the 3:1 floor plus
  margin).
- B: the same to 4.5:1 (the text minimum). Gold turns brown and all four close in on the ink (15.9:1), so the hues get
  harder to tell apart on small noteheads.
- C: new hues picked by eye. They'd no longer match what the HUD's counters mean.

**Choice.** A. PERFECT #9b7900 (3.51:1), GREAT #0c8f66, GOOD #0978ff, MISS #787e88 (3.50:1 each), in
`web/src/game/sheet-view/paper-colors.ts`, with a test that pins the 3:1 floor. The four colors share a luminance,
so on paper they differ by hue alone; the legend names each one, so color is never alone (as before). The legend
swatches use the same colors, on the dark header. Hand colors aren't shown on the sheet today, so none are picked.
If they are, darken `handR` and `handL` the same way (#007cea and #8a5dff measure 3.55:1 and 3.54:1).

**How to undo.** Change the values in `paper-colors.ts` (the test keeps any new value at 3:1 or more), or point
`COLORS` in `SheetView.tsx` back to `hudSettings.judgmentColors`.
