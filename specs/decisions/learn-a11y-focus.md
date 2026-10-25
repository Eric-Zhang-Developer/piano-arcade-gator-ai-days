# learn-a11y: how focus stays in a take's actions (#1275)

**Context.** After "See an example take", "Stop example", "Hear the opening", Start/Stop and a take's end, the
button holding focus unmounts and focus falls to `<body>`. The spec prefers keeping one button mounted and changing
its label.

**Options.**
- A. Keep-mounted buttons per page. This can't cover play-through's end, where a "Back to map" link replaces a button.
- B. One hook, `useKeepFocus` in `playing/TakeParts.tsx`, on each `.actions` group. When the last focus, press or
  click was in the group and the focused control is gone, focus moves to the group's first enabled control.

**Choice.** B: one mechanism covers every listed click, including the link.
- It treats a disconnected `document.activeElement` as lost. The browser moves focus to `<body>` only at its next
  rendering update, and an effect can run before that.
- It listens in the capture phase, so a click is counted before React's listener re-renders.

**Undo.** Remove the hook and the three `ref={actions}`.
