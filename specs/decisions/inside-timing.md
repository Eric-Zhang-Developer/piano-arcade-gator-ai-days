# inside: the action's timings

**Context.** The spec asks for phase timings, a velocity curve, a CC64 map and a wave speed, each logged. A research
pass found pp/ff key-travel figures (160 ms, 25 ms) only in a forum summary of a paper that isn't open, so none of
these is stated as fact. All are in `action.ts`'s `actionSettings`.

**Choices:**
- **The approach, from key-down to strike:** 160 ms at velocity 1 to 25 ms at velocity 127, on log time. Goebl &
  Bresin (JASA 2003) is cited second-hand for about 26–37 ms at forte, but wasn't re-read, so it isn't relied on.
- **Free flight after let-off:** 12 ms at velocity 1 to 3 ms at 127, on the same curve. A higher velocity gives a
  shorter flight and a shorter approach; the unit tests check both.
- **Strike contact 4 ms, rebound to the backcheck 60 ms, key rise 90 ms, hammer drop 120 ms.**
- **CC64 to rail:** 0 below 16, linear up to 110, full above. 64 gives 0.51, half pedal. The rail eases to each value
  over 60 ms.
- **The wave:** 2 ms per key, bass to treble, so 174 ms across the 88.
- **The ring:** a decay constant of 2600 ms with the damper up and 90 ms with it down. A string's glint and its
  slowed wave (7 Hz, 0.9 mm) are drawn exaggerated, so they can be seen.
- **Live timing:** a note-on is drawn as the strike at once, and no approach is drawn before it. That's the honest
  framing, since MIDI arrives after the hammer.
- **Playback timing:** Play Moonlight feeds the action 400 ms ahead and the piano 150 ms ahead, so the slowest
  approach starts drawing before its note is queued and lands on the note's send time.

**How to undo:** edit `actionSettings`. The tests check orders and directions, not these values.
