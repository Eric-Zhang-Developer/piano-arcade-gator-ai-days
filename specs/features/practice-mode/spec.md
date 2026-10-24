---
name: "PROVISIONAL (learning lane): practice mode with sheet music"
depends_on: ["core-loop"]
owns: ["web/src/learn/practice/", "web/src/app/practice/"]
assignee: ""
---

# Practice mode (provisional)

**Provisional.** Owned by the learning lane's person; not scheduled.

## What was discussed
- Sheet music was taken off the arcade screen (decision 001, row 13): reading the score and following falling notes
  compete for attention. Practice mode is where the score lives: the score with a playhead, and judgments colored
  onto the noteheads.
- Candidate renderers from the v4 plan: OpenSheetMusicDisplay or Verovio. Not decided.
- An iPad as a second display was considered and deferred.

## Open
- Owner, renderer, how a chart maps to the score's notes, and the rubato-tolerant tempo curve (v4's scoring model).
