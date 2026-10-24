# core-loop: Twinkle notes from Wikipedia's LilyPond score, checked against Mozart K.265

- Date: 2026-10-24   Decided by: eric-agent-1   Feature: core-loop
- **Context:** The spec wants the notes from a public-domain score in 4/4. Mutopia's public-domain K.265 theme
  (Mutopia-2018/12/07-2236, Porro edition) is for guitar duo, with ornaments and 8-quarter phrases, so it isn't the
  plain melody. Wikipedia's article has the plain melody in LilyPond, 4/4, 6 quarters plus a half per phrase.
- **Options:** A: Wikipedia's LilyPond, parsed by script, cross-checked against Mutopia / B: strip K.265's
  ornaments and rewrite its rhythm by hand / C: file `needs-human` and leave the chart to Eric.
- **Choice:** A. The tune is traditional and public domain; the pitches match the Porro edition's theme (phrases 1–3,
  5, 6). The Wikipedia page text is CC BY-SA 4.0, which the chart's `source` says. Octave C4 follows `\relative c'`.
- **How to undo:** replace `web/public/songs/twinkle/chart.json` with notes from a pre-1927 print, or Eric's.
