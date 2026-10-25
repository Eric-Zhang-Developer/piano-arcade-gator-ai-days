# milestone-sfx: the mix choices the spec leaves open

**Context.** The spec names the moments and asks for layered voices that line up with the visuals. These are the calls
it doesn't make.

- **A combo step on the last note gives way to the clear card.** The judge sends the last note's `noteHit` and its
  `comboMilestone` at the same time, so both would sound at once. The card's voice plays alone.
- **The clear card has three voices:** CLEAR a plain IV–I cadence; FULL COMBO an arpeggio up into the octave chord;
  ALL PERFECT that plus four bells on top. The full-combo fanfare after the rank hit stays, as juice-sound had it.
- **Combo steps climb:** 25 at the root, 50 two semitones up, then one more per hundred, up to a fifth (`comboLift`).
- **Fever's riser peaks at 200 ms,** with fever-moment's edge flash (`peakMs`), and its chord lands there.
- **NEW RECORD sounds at its own stamp's impact:** record-moment's start plus rank-stamp's impact point on its curve.
  It reads rank-stamp's and record-moment's timing functions, so results-landing's retiming (#978) carries it.
- **Levels** sit under juice-sound's old single-oscillator peaks (0.16–0.35 against 0.2–0.4), since layers add up.
  Not heard on the piano yet.
- **No Lab variants.** The spec allows them; the default set ships first.

**How to undo.** `web/src/game/milestone-sfx/voices.ts` (`voiceSettings`, `comboLift`, `playVoice`) and `scheduler`
in `web/src/game/sound/index.ts`.
