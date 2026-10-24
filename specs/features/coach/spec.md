---
name: "PROVISIONAL (learning lane): AI coach reads your takes and gives one drill"
depends_on: ["core-loop"]
owns: ["web/src/learn/coach/", "web/src/app/api/coach/"]
assignee: ""
---

# Coach (provisional)

**Provisional.** The learning lane's person owns this spec and fills it in; until then it's in no milestone and no
agent builds it. This stub only records what the game lane provides and what was discussed.

## What was discussed
- Code does the numbers; the LLM only writes the report. Align the take to the chart (the game's judging already
  does this: reuse `Results` from `web/src/contracts/`), compute per-bar and per-section timing (early or late, by
  how much), velocity against the score's dynamics, and trends across the last few takes. The LLM gets that summary,
  not raw MIDI, and returns two sentences and one drill.
- A check in code confirms every bar and number the report cites exists in the summary; otherwise show the plain
  summary (`mission.md`).
- The drill is a bar range and a tempo, linked as `/play?song=<id>&from=<bar>&to=<bar>&tempo=<percent>`
  (`bar-loop`).
- Expected on Gemini behind one Next.js route (`web/src/app/api/coach/`), for the MLH Gemini prize. Not decided.
- The challenge statement's "technology from the past 12 months" may land here. Open.

## Open
- Owner, model, prompt, the summary's exact shape, the dynamics source (MusicXML markings), and the cost limit.
