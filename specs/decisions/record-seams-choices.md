# record-seams: the choices the spec left open

**Context.** The spec (record-seams) asks to log the fade curve, the duck span, the play-out threshold, the pulse's
strength and the tag's copy, plus anything else it doesn't settle.

- **The fade curve:** even in dB from the ducked level down to -60 dB, over two bars, then 0 on the bar line.
  - Rejected: a linear-gain fade (the obvious `linearRampToValueAtTime(0)`). It drops more than 20 dB in its last
    50 ms, which is the chop Validation (a) forbids. `record-seams.test.ts` measures both on the fixture.
- **The duck:** -6 dB, reached 200 ms after songEnd, held over the whole tail.
  - Rejected: ducking only through results-landing's stingers. That needs `planLanding` times from a page that
    starts the landing on its own clock, and the spec allows the whole-tail duck as simpler.
  - `recordingLevelAt` reports the ducked level, so milestone-sfx's loudness rule still sees the tail.
- **Where the fade starts:** the first bar line at or after songEnd. The bar lines come from the chart's constant
  bpm, since record-follows' beat map hasn't landed.
- **The play-out threshold:** 12 s, the spec's figure. A recording that would end inside the fade also plays out.
  Golden ends about 5.5 s after its songEnd, so it plays out (pinned by a test with the spec's measured numbers).
- **No tail** for a bar loop (its passes stop on their own) or when the file has already ended. Those keep today's
  0.25 s fade.
- **The tag's copy:** "♪ Fades at bar N" (N is the bar the fade's final line starts) or "♪ Plays out", then
  **Stop music**.
- **Where the tag sits:**
  - *The problem:* audio-track's `resultsPanel` would land as a card at the end of the details, below the fold.
    Joining Retry and Songs needs `resultsLayoutSettings.actions` in results-layout, and #600 holds that file.
  - *The choice:* the panel portals a fixed lower third into the first view. It sits in the strip under the results
    card, flush with the card's right edge (measured on mount and on resize), clear of Details ↓.
  - *Round 1 had it bottom-left,* where it covered the tutor band.
  - *Undo:* when #600 is done, add `audio-track` to `actions` and drop the portal.
- **The pulse:**
  - *The look:* a 2 px primary hairline on the bottom edge with a 7vh glow above it. It peaks at 0.9 opacity on each
    bar line and is gone by 45% of the bar, blended with `screen`.
  - *Why the bottom edge:* /play draws no plugin canvases after songEnd, so the pulse is DOM. That strip is where the
    field shows under the card.
  - *Rejected:* a 22vh glow at 0.55. It was invisible in the shots (about 12% blue spread thin).
  - Under reduced motion, there's no pulse and no drain line.
- **The song card over the intro (J-cut):** unchanged.
  - The HUD's song card is drawn by `hud/index.ts`, which #600 and #713 hold, so it can't wait for the recording's
    first sound.
  - On Golden the recording starts about 118 ms into the count-in, so the card is that much early.
  - Logged as a Gap.

**Undo:** revert the PR. audio-track's songEnd goes back to the 0.25 s fade.
