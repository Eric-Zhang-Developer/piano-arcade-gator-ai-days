# Source

Retrieved 2026-10-24.

## The score: TAVERN, `K265.xml` (MusicXML)

- **What:** the complete K. 265 (theme and all 12 variations, 324 bars, both hands), plus the theme's Roman-numeral
  analysis (annotator A), from the TAVERN corpus (Theme And Variation Encodings with Roman Numerals, Devaney et
  al.).
- **URL:** <https://github.com/jcdevaney/TAVERN>, commit `7cc65dc5365603a92376af50ac71491bea7a16ae`,
  `Mozart/K265/Krn/K265.xml` and `Mozart/K265/Joined/M265_00_0{1a,2b,3a}_a.krn`.
- **License:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (the repo's `LICENSE`).
  Attribution: TAVERN corpus, Johanna Devaney and contributors. **Share-alike:** every file in `out/` is built
  from it, so `out/` is CC BY-SA 4.0 as well. The composition itself is public domain.
- **Changes we made:** the files in `out/` add repeats, dynamics, tempo, doubling, transposition, re-voicing and
  the other transforms in `transform.py`. The source's notes are not edited.

The source isn't committed (2 MB). Fetch it into `source/` and check it:
```bash
cd spikes/twinkle-13 && mkdir -p source && T=https://raw.githubusercontent.com/jcdevaney/TAVERN/7cc65dc5365603a92376af50ac71491bea7a16ae/Mozart/K265
curl -sfL -o source/K265.xml $T/Krn/K265.xml
for f in M265_00_01a_a M265_00_02b_a M265_00_03a_a; do curl -sfL -o source/$f.krn $T/Joined/$f.krn; done
shasum -a 256 -c - <<'EOF'
18887d1d9ab0a1443d8afdf751f11092b55ed5bf6a29a70dc5f1ef82e31c7770  source/K265.xml
46126173d2d745ca33a12ed761f0bbd5e61d1b17c2429be9a39590c8c905e103  source/M265_00_01a_a.krn
6febf16a7c7f43cdec9606f4203df3fb2918e658eebd7c46e2c307e5ab50eaad  source/M265_00_02b_a.krn
30ccfa84206a51adb0fcce1b94088f0027b8e87756abe936ae7540f4a2f900ca  source/M265_00_03a_a.krn
EOF
```

## Checked against: a scanned public-domain edition

Edition Peters, plate 6695, pages 24 to 30: the IMSLP scan mirrored on Wikimedia Commons (public domain),
[`12 Variations on 'Ah, vous dirai-je maman', K.265-300e (IA imslp-…).pdf`](https://commons.wikimedia.org/wiki/File:12_Variations_on_%27Ah,_vous_dirai-je_maman%27,_K.265-300e_(IA_imslp-variations-on-ah-vous-dirai-je-maman-k265300e-mozart-wolfgang-amadeus).pdf).
The dynamics in `out/01` and `out/02` and the repeat plan below are read from it.

## Sources we didn't use

- **IMSLP #228379**, the Werner Icking MIDI the spec names: CC BY-NC-SA 3.0, but IMSLP answered with a CAPTCHA
  bot check instead of the file. Bypassing a CAPTCHA is off limits for an agent, so it wasn't used.
- **eric-brechemier/mozart-kv265** (MusicXML, CC0): only the theme and Variations 1 to 3 are filled in; bars 73
  to 134 are empty.
- **Mutopia #2236** (public domain): an arrangement for two guitars, with changes for guitar and a different
  order. Not "as written".
- **Wikimedia Commons, `K265 (Ah vous dirai-je, Maman).mid`** (PD-self, Michael Bednarek, 2009): complete, but
  a performance at one fixed tempo whose notes don't line up with bars. Used only as a cross-check (below).

## Checks and fixes

- **Every bar is full:** `parse_score()` reports any bar whose notes don't add up to its time signature. It
  reports none for either hand in all 324 bars.
- **Note count:** played with Mozart's repeats, TAVERN gives 6,146 notes. The independent Commons performance has
  6,490 note-ons, 5.3% more. TAVERN encodes no ornaments (no trills or turns; 6 grace notes, which we drop), and
  Var 2, 11 and 12 are full of trills in the scan, so the gap is the expected direction and size. Not a sign of
  missing bars.
- **Fix 1, repeat (not a note):** TAVERN has no repeat sign at the end of Variation 2's first half (bar 56). The
  Peters scan has one (page 25, `VAR.II`, bar 8). It only matters for a full-piece playback; no output plays
  Var 2. Logged, not encoded.
- **Var 12's endings:** TAVERN's 36 bars are 8 + 16 + 12. In the scan, bar 312 is the first ending and bar 313
  the second ending, which leads into the coda. `out/02` plays 289-296 twice, 297-312, 297-311, then 313-324.
- **Not encoded in the source, so not played:** trills, turns, grace notes, the Var 1 first/second endings, and
  any tempo marking. The 120 BPM in `out/01` and `out/02` is TAVERN's playback tempo, not Mozart's (the theme has
  no tempo mark; Var 12 says Allegro).
