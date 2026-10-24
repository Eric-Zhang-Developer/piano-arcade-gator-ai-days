---
name: "PROVISIONAL (learning lane): chart compiler from public-domain scores"
depends_on: []
owns: ["tools/chart-compiler/", "web/public/songs/library/"]
assignee: ""
---

# Chart compiler (provisional)

**Provisional.** Owned by the learning lane's person; not scheduled.

## What was discussed
- v4's pipeline: a public-domain score (MusicXML or LilyPond) goes in, music21 writes a `Chart`
  (`web/src/contracts/`), and a note-count check compares it with the score's own MIDI, note for note. A piece that
  fails is dropped, never shown.
- The target is 5 pieces (decision 001, row 11), so `song-select`'s video shot has rows to scroll.
- A computed difficulty rating (notes per second, hand stretch, hand overlap, tempo) is a later step. It's a formula,
  not ML, unless a model is actually trained (decision 001).
- Keep the score's dynamics markings: the coach needs them for "too loud here".

## Open
- Owner, sources per piece, where compiled charts live relative to `song-select`'s reader, the difficulty formula.
