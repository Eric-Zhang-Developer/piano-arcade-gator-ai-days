# duo-tokens: how the zero-radius rule skips /learn

**Context.**
- **The rule:** visual-direction.md sets zero corner radius on every interface element, and the duo-tokens spec asks
  for it as one rule in `globals.css`.
- **The exception:** it must not reach `/learn`, Andres's lane (#641). Its CSS-module class names are hashed, so
  they're no stable hook, and its files aren't ours to add one to.
- **Why `!important`:** game components set their own radii, in module CSS and in inline styles. A zero-specificity
  rule would lose to all of them.

**Options.**
- A: `border-radius: 0 !important` on every element, skipped when the page holds `main#learning-content`, which
  `LearningShell` always renders on `/learn`.
- B: list the game's routes instead. Every new page would have to be added.
- C: ask the learning lane for a data attribute. It needs their PR first.

**Choice.** A.
- `html:not(:has(#learning-content))` scopes the rule.
- verify-duo checks that `/` has no element with a non-zero radius, and that `/learn` still has its 4 px.
- Canvas shapes aren't CSS and keep their corners: note pills, keys and the overlay badges are duo-hud's.
- If `/learn` ever drops that id, the rule reaches it. verify-duo's `/learn` check would then fail.

**How to undo.** Delete the rule at the end of `web/src/app/globals.css`.
