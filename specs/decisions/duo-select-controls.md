# duo-select: where the level, Hands and Speed controls go, and PLAY as a button

**Context.** The frame shows a panel with no level toggle and no Hands or Speed. The spec lets the worker move Hands
and Speed into the options drawer or keep them as small monospace toggles. The Duo kit's `Button` is a `<button>`,
not a link.

**Choice.**
- easy-charts' NORMAL / EASY toggle and song-options' Hands and Speed stay in the panel, side by side under PLAY and
  PRACTICE. They're small, they already carry their own keys (E, H, ← →), and moving them would hide them from a
  first-time player.
- song-preview's row keeps only what isn't in the panel: Hands, Speed, the source and the preview status. Notes/s,
  BEST, LEARN and PRACTICE 70% move into the panel's cells and buttons.
- PLAY and PRACTICE are kit `Button`s whose click navigates: PLAY through select-to-stage's `goToStage`, PRACTICE with
  a router push. The list rows stay links, so Enter, click, middle-click and the URL are unchanged. The panel's
  buttons are extras a mouse can reach.

**How to undo.** Swap `Button` for a link styled as one, or move the toggles into `OptionsDrawer` from
`select-layout`'s `FocusPanel` children.
