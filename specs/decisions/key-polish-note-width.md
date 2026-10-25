# key-polish: falling notes stay Synthesia-wide

**Context.** #848 asks the worker to look at a wide Synthesia-style bar and at PianiCast's slim bar (the Flower Dance
cover in `video-references/`, about a third of a white key wide) and pick one per the visual direction.

**Options.**
- A. Keep today's widths (`pillSettings.whiteFill` 0.84 of a white key, black-key notes 0.56 of that), as Synthesia
  does (`synthesia-brahms` 0m18s).
- B. PianiCast's slim bars, about 0.33 of a white key.

**Choice: A.** The notes carry their names (note-labels, sized to the pill by pill-match), and a slim bar has no room
for "C♯5" at 1280. At 88 keys, a bar that fills its key also keeps the lane-to-key reading that visual-direction.md's
"Synthesia at the center" asks for. The polish goes into the body (gradient, edge light, the glow near the line)
instead of the width.

**How to undo.** Change `pillSettings.whiteFill` in `web/src/game/note-pills/index.ts`; pill-match keeps the labels
and ghosts in step.
