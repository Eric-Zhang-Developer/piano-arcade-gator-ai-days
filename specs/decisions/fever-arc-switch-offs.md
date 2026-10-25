# fever-arc: the pieces that still keep their own clock

**Context.** A lane widening holds only while no open PR is working on a file (AGENTS.md, "Ownership is open within a
lane"). Three files the arc should reach are held. eric-agent-3, 2026-10-25.

| Piece | File | Held by | Today | The change once free |
|---|---|---|---|---|
| The sweep sound | `sound/index.ts` | #600 | starts on `feverStart`, up to a beat before the ignition | `startTime: at(ignitionFor(e.atMs))` (two lines; `ignitionFor` is exported and tested) |
| The steady edges | `juice/index.ts` | #761 | light on `feverStart` (seen in the shots, ~600 ms early on Twinkle), off at once on the break | light from `arcNow(now).phase` ignite or sustain; fever-moment's drain already covers the release |
| The near-line glow | `core/highway.ts` | #747 (and #600) | keeps its color | read `feverHeat()` for an amber accent |

**Choice.** Ship the arc without them rather than wait, as the spec's Gaps allow. **Undo:** none needed; each line
above is its own `fix(fever-arc)` PR once its file is free.
