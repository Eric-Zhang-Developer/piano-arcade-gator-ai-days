# miss-moment: the combo break is drawn by the plugin, for now

**Context.** `hud/index.ts` is held by duo-hud (#713, #707) and #600, so the break doesn't edit the HUD (spec).
eric-agent-3, 2026-10-25.

- **Choice:** the plugin draws the old digits itself at `hudLayout(width, judgmentLineY).combo`, in the HUD's display
  font (`--pa-font-display`) and its italic-900 size, sized for "888" as `drawCombo` is, so the number doesn't jump.
  The offset and alpha come from the pure `comboBreakAt(msSinceBreak, oldCombo, height, reduced)`.
- **For duo-hud:** once it lands, its renderer can call `comboBreakAt` and draw the digits in its own slot, then
  miss-moment's draw drops its break block. Same lane; no issue filed.
- **Undo:** delete the `broken` block in the plugin's `draw`.
