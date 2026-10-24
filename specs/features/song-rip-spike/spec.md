---
name: "PROVISIONAL (learning lane): spike: turn a recording into a playable level"
depends_on: []
owns: ["spikes/song-rip/"]
assignee: ""
---

# Song-rip spike (provisional)

**Provisional.** Owned by the learning lane's person; not scheduled. Completely untested so far: the riskiest AI
piece in the plan.

## What was discussed
- A recording goes through stems (Demucs), notes (Basic Pitch) and an arranging agent (an LLM) into a playable piano
  part plus band channels, as a `Chart`. It's the "any song becomes a level" story and what makes "Golden" possible.
- Run it like the MIDI spike: one song, a pass/fail test, a decision Saturday night. Pass if someone who hasn't heard
  the plan recognizes it within 5 seconds (v4), and the chart is playable.
- There's no score to check a ripped song against, so the note-count check doesn't apply; it needs its own checks.
- If it fails, the video ends on the Twinkle Var. XII beat instead.

## Open
- Owner, which song, the tools' licenses, and the playability checks.
