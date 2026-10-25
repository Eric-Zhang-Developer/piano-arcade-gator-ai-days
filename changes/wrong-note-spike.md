## What shipped
`/wrong-note`, a listening spike: the DGX plays 8 notes of Twinkle (or Ode to Joy, Minuet in G, Für Elise) with one moved 2 semitones (`?shift=1`: 1), and you press the pad (or 2–8) of the wrong one. 10 rounds a set, seeded (`?seed=`), and the session's sets listed for FINDINGS. Linked from the Lab, under Experiments (#955).
## Where it lives
`web/src/app/wrong-note/page.tsx`, `web/src/game/wrong-note/` (module, CSS, tests, `verify-wrong-note.mjs`), `spikes/wrong-note/FINDINGS.md`, decision `wrong-note-spike-send`, shots in `specs/features/wrong-note-spike/shots/`.
## How to check it
`node web/src/game/wrong-note/verify-wrong-note.mjs --out <dir>`: not verified locally; covered by main's scheduled full run. Vitest `src/game/wrong-note`: 6 pass.
## Gaps
The question is unanswered: the DGX playtest (Validation 3) is Eric's, and FINDINGS says "playtest pending". Answers are clicks or keys, not the piano; right hand only.
