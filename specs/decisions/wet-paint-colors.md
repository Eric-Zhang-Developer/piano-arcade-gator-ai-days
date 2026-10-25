# Wet Paint: Scriabin's colors

**Context.** The spec asks for a pitch-class → color table taken only from a source that can be cited, never from
memory. A research pass opened three independent tables. I read the primary one myself (the image linked below).

**Sources read.**
- **A. The Parisian score's "Table of Colors" (1913):** "the only table of color-tone correspondences known to come
  directly from the composer." Reproduced in translation in Gawboy & Townsend, "Scriabin and the Possible," *Music
  Theory Online* 18.2 (2012), ¶8 and Example 3: https://mtosmt.org/issues/mto.12.18.2/gawboy_townsend_ex3.png
- **B. Sabaneev, "On Sound-Color Accordance," *Muzyka* 9 (1911), p. 199:** the same Example 3, and Galeyev &
  Vanechkina, "Was Scriabin a Synesthete?", *Leonardo* 34(4), 2001, p. 359.
- **C. Myers, "Two cases of synaesthesia," *British Journal of Psychology* 7(1), 1914, p. 114:** Scriabin's own
  account to Myers, in ranges (C red ... F♯ violet; D♭ A♭ E♭ B♭ F "extra-spectral").

**Disagreements.**
- **E and B:** dark blue (B), dark blue-greenish (A), green to blue (C).
- **F♯:** dark blue, bright (B); deep dark blue with violet (A); violet (C).
- **A♭:** magenta-violet (B); lily-colored, reddish (A).
- **E♭ and B♭:** steely or metallic in A and B; extra-spectral in C.
- **G and D:** C shifts both one step toward red.

**Choice.** A, the Parisian score. It's the composer's own, it names all twelve, and a free peer-reviewed source
reproduces it.

**Two steps are mine, not the sources':**
1. **Keys, not notes.** Every source gives keys (tonalities), not pitch classes. Galeyev (p. 359) warns against
   reading them as notes. Here a note takes its key's color by its tonic, and the caption says "after Scriabin".
2. **The hex values.** No source gives RGB. Each hex below is my rendering of the color words, picked to read on the
   dark canvas. The dark ones (F, B♭) stay dark, as written.

The table below is read by `wet-paint.test.ts`, which checks the code's `SCRIABIN` against it. Change both together.

| Pitch class | Parisian score (1913), as translated by Gawboy & Townsend | Hex (my rendering) |
|---|---|---|
| C | Plain red | #e0201b |
| C♯/D♭ | Pure violet | #8a2be2 |
| D | Sunny yellow | #ffd21f |
| D♯/E♭ | Steely blue, metallic | #6f88a8 |
| E | Dark blue-greenish (light blue) | #2f8fb0 |
| F | Dark red | #8e1a1a |
| F♯/G♭ | Deep dark blue with a shade of violet | #3a2fa8 |
| G | Orange (red-yellow), fiery | #ff7a12 |
| G♯/A♭ | Lily colored (reddish) | #c8577e |
| A | Grass green | #3fa535 |
| B♭ | Metallic leaden grey | #7d8590 |
| B | Dark blue with light blueness (light blue) | #4a7fd6 |

**How to undo.** Change the hex column and `SCRIABIN` in `web/src/game/x/wet-paint/colors.ts` together, or switch
to column B (Sabaneev) in both.
