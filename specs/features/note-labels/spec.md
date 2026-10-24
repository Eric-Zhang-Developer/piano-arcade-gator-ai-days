---
name: "Note labels: letter names on notes and keys, laptop letters in laptop mode"
depends_on: []
owns: ["web/src/game/note-labels/"]
assignee: "eric"
---

# Note labels

Players asked for note names on the falling notes (`specs/context/findings.md`), and judges at the event play on
laptop keys (catalog G12). This feature draws letter names on the falling notes and keys. In laptop mode, each drawn
key shows the laptop letter that plays it instead.

It's one plugin in `layers.ts`, drawn on its own layer, and core doesn't change.

## Requirements
- **Modes:** `notes` (letter names), `keys` (laptop letters) or `off`. Set it with `?labels=` or
  `localStorage["pianoArcade.labels"]`. The URL wins.
- **Default `auto`:** laptop letters until the first MIDI note-on arrives, then letter names. The plugin sees both
  devices through `wrapInput`, and their `kind` tells it which played.
- **Letter names:** C D E F G A B, with sharps written as C♯. Each C key also shows its octave (middle C, MIDI 60,
  is C4). Each falling note shows its letter near its head, and each key shows its letter at the bottom.
- **Laptop letters:** the letter of the key from core's `keyMap(lowest pitch)` in `web/src/game/core/input.ts`
  (import it; don't copy it). Keys with no laptop key stay blank.
- **Placement:** keys use `Frame.keyX`. Notes use the flat highway's scroll, `judgmentLineY / lookaheadMs` px per
  ms. With `?perspective` above 0, note labels hide and key labels stay. A label too wide for its lane hides rather
  than overlapping its neighbor.
- **Readable:** labels contrast with both note colors from `hand-colors`, if that's on `main`, and never cover the
  head of a note.
- **The toggle:** a start-screen `startPanel` that cycles the modes, once play-slots is on `main`. Until then, the
  URL and the storage key work.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: letter names for 60, 61 and 71 are C4, C♯ and B. Laptop letters for Twinkle match `keyMap`.
  `auto` switches from keys to notes on the first MIDI event. A label wider than its lane is hidden.
- `verify.py --slug note-labels` passes.
- In Chrome: `/play` on laptop keys -> each key shows A S D F … and the falling notes show their letters.
  `?labels=notes` -> letter names on the keys. `?labels=off` -> no labels. Keep a screenshot of each in the PR.
- On the piano (Eric; mark it in the done note): play Twinkle with labels on and say whether they help or clutter.

## Defaults
- If labels clutter wide charts, show them only on lanes at least 14 px wide. Don't shrink the font below 10 px.
