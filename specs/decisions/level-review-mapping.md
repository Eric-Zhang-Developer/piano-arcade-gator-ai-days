# level-review: grade to level

**Context.** The formula reads speed and reach from a chart; it can't see voicing or reading difficulty. Each select
song now gets a published grade (Henle, then RCM, then ABRSM) and a level from it (`web/src/game/difficulty/reviewed.ts`).

**Mapping (the planner's, from the spec; a judgment, not a published equivalence).**
- Henle h (1-9): level = min(15, 2h).
- RCM g (Preparatory 0, Grades 1-10, ARCT 11): level = 1 + g.
- ABRSM g (Initial 0, Grades 1-8): level = 1 + g. A diploma-only listing (ARSM) counts as none.
- No grade: the formula's level stays, and the row's note says where we looked.

**Choices made under it.**
- A grade for a whole sonata is not a movement's grade. A movement chart uses a movement-level grade (Henle's "At the
  Piano" albums, an RCM or ABRSM listing of that movement), or none.
- Excerpt step (-2) only where the chart skips the piece's hardest part: clair-de-lune (opening), traumerei (bars 1-8),
  raindrop-prelude (D-flat opening without the C-sharp minor middle), pathetique-2 (the theme).
- Henle and RCM disagree: Henle wins, and the note gives RCM.

**How to undo.** Delete a row's `level` change (set it to `old`), or delete `reviewed.ts`'s import from `difficulty.ts`.
