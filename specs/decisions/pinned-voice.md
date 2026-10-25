# Pinned: the comb voice's levels and decays

Feature: `pinned` (#1171). The partial ratios are computed, not chosen: β from cos β · cosh β = −1 by bisection, ratios
β², about 1 : 6.27 : 17.55 (the test checks them within 0.5%). The rest are choices, in `voiceSettings`
(`web/src/game/x/pinned/voice.ts`). Undo any one by changing its value.

- **Levels:** 1, 0.18, 0.05 for the three partials. The upper modes of a struck steel tooth are quiet next to the
  fundamental; louder, the 6.27× partial reads as a second note rather than as the tooth's colour.
- **Decays:** time constants 1.4 s, 0.22 s, 0.06 s. Upper modes of a clamped-free bar die fastest, so the attack is
  bright and the tail is the pure fundamental, as a music box's is.
- **Pluck:** 4 ms of noise at 0.25, the pin letting go. A raised-cosine 2 ms attack keeps the onset from clicking.
- **Length and level:** 2.2 s a note, peak 0.18 before the page's gain, which is the effects volume (and mute) from the
  sound prefs.
- **Above Nyquist** a partial is dropped, not folded back.
- **Not checked by ear:** a 30 s listen is on the morning page, ranked low.
