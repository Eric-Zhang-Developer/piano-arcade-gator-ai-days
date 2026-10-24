---
name: "PROVISIONAL (learning lane): practice mode"
depends_on: ["core-loop"]
owns: ["web/src/learn/practice/", "web/src/app/practice/"]
assignee: ""
---

# Practice mode (provisional)

**Provisional.** Owned by the learning lane's person; not scheduled.

**Sheet music moved (2026-10-24):** by Eric's call, the score is the game lane's now, as with wait-mode. `sheet-xml`
writes a chart as MusicXML, and `sheet-view` shows it at `/sheet` in its own window (OpenSheetMusicDisplay), with a
cursor following the live take and judgments colored on the noteheads. Decision 001 row 13 still keeps it off the
arcade screen. The rest of this spec stays the learning lane's.

## What was discussed
- Sheet music was taken off the arcade screen (decision 001, row 13): reading the score and following falling notes
  compete for attention. The score with a playhead and judged noteheads is now `sheet-view`'s (above).
- An iPad as a second display was considered and deferred (still a gap in `sheet-view`).

## Open
- Owner, and the rubato-tolerant tempo curve (v4's scoring model).
