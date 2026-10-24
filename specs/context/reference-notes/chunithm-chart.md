# chunithm-chart: Chunithm MASTER chart preview, "夜に駆ける" (YOASOBI)

Source: `video-references/(9.0) 夜に駆ける [MASTER 11+] (譜面確認) [CHUNITHM チュウニズム] [Z_xy5G1tpc8].mp4`, 172 s, 1920x1080.
A chart preview: nobody plays. Score and MAX COMBO stay 0 for the whole video and every note counts as a MISS.
Studied from 2 fps samples (345 frames as contact sheets), 10 fps bursts at 40–44 s, and full-res stills.

## Kept frames (1280 px)

- `0m01s.jpg`: "ARE YOU READY? / TRACK 3" banner with the clear condition (clear-gauge icon ×3). Full HUD at rest, counters all 0. Shows the whole layout.
- `0m02s.jpg`: "START!!" in plain white text over the empty highway. A short, plain cue before play.
- `0m09s.jpg`: first notes: two holds drawn as orange-yellow columns fading to purple, far end of the highway. Holds read as lit columns, not outlines.
- `0m16s.jpg`: small magenta bar on a green diagonal line, a red tap, a grey "AIR" marker. Note colors change by type.
- `0m19s.jpg`: green up-chevron (air note) at the far end, cyan slide line, a long green line, faint grey "MISS" text in the upper lanes. Judgment text is small and quiet.
- `0m20s.jpg`: a wide magenta note with a grid under it and two green lines running to the judge line.
- `0m41s.jpg`: red taps at three depths plus a cyan/magenta slide entering. Shows how perspective shrinks far notes.
- `0m42s.jpg`: wide cyan/magenta slide ribbon with a bright cyan center line, crossing lanes. Slides are thick and glowing.
- `1m00s.jpg`: blue/cyan slide start bar, a yellow bar, a grey-white blurred chevron, and the miss counter at 397. The 8 lane columns are easy to count here.
- `1m02s.jpg`: green chevron on a vertical green stem (air note with a line), two red taps, grey "AIR MISS" badges.
- `1m12s.jpg`: biggest effect seen: a pink-white box with cyan light rays filling the middle lanes. Unclear whether it is a note or an effect.
- `1m25s.jpg`: two slides curving into an arch at the far end. Slides are free curves, not lane-locked.
- `1m26s.jpg`: two magenta down-chevrons on yellow bars, with green lines. The down version of the air note.
- `1m39s.jpg`: green air stem bending into a cyan/magenta curved slide, red taps near the judge line.
- `1m49s.jpg`: break section: an almost empty highway with one green line. Matches the audio drop at 109 s.
- `2m03s.jpg`: pink fan of beams at the far end, cyan slide lines. A build into the loud final section.
- `2m04s.jpg`: two wide cyan holds and a pink box, with lit teal columns.
- `2m20s.jpg`: full-width blue bar with a cyan checker field and two cyan columns at the judge line. Meaning unclear.
- `2m43s.jpg`: a pair of red taps and grey "AIR MISS" badges. A typical late passage.
- `2m51s.jpg`: end: empty highway, MISS 1434, score 0. The avatar is no longer visible.
- `audio-countin-spectrogram.jpg`: 3.5–7.0 s of audio: four count-in clicks, then the music starts.

## Report

**Layout.** One black highway in strong perspective, drawn as a trapezoid that narrows to about 1/3 width at the top, under the HUD. Dark navy side walls. A glowing white-gold judge line sits about 92% down the screen. Seven thin yellow dividers make 8 columns, plus a center line. HUD across the top: a player card on the left (team, name, rating). In the center, a yellow panel: JUSTICE CRITICAL / JUSTICE / ATTACK / MISS counters, then MAX COMBO and SCORE, a dark bar, and a segmented clear gauge with a CLEAR mark. On the right: speed 9.00, mirror OFF, "TRACK 3 MASTER", level 11+, jacket art, title and artist. A character card sits mid-left and a 3D penguin avatar bottom-left. "CREDIT(S): 0" is bottom-right. The background is a yellow→green→cyan gradient with orbit lines, striped planets and streaks.

**Notes.** Red flat bars are taps. Yellow bars appear too. Notes span about 1 to 3 columns; some cover the full width. Holds are orange-yellow columns fading to purple. Slides are thick cyan/magenta ribbons with a bright cyan center line and blue end bars, and they curve freely across lanes. Air notes are green up-chevrons, often on a green vertical stem. Down-air notes are magenta down-chevrons. Blurred grey-white chevrons follow some air notes. Larger special shapes (1m12s, 2m03s, 2m20s) are not identifiable from frames alone.

**Feedback.** No hits happen, so hit bursts and combo display are not visible. Misses show as small faint grey "MISS" text and boxed "AIR MISS" badges in the upper part of the highway, not at the judge line. The MISS counter climbs: 83 at 0:19, 397 at 1:00, 1141 at 2:20, 1434 at the end. Missed notes pass the judge line with no flash.

**Motion and timing.** Speed setting 9.00. A tap takes roughly 0.7–0.8 s from the far edge to the judge line (counted at 10 fps). Typically 2–6 note objects are on screen at once. Dense passages stay readable because each type has its own color and shape (red bars, cyan ribbons, green chevrons). Notes far up the highway are tiny slivers.

**Palette and mood.** Saturated, bright and loud: a sunny yellow-green-cyan background, a black playfield, neon note colors (red, cyan, magenta, green, yellow). Cheerful arcade energy.

**Sound.** Integrated loudness is −16.5 LUFS, with a loudness range of 4.9 LU (a dense, compressed mix).
- 0–3.7 s: silence.
- About 3.8, 4.2, 4.6 and 5.1 s: four count-in clicks, about 0.44 s apart. They are short broadband ticks with peaks near 1.4 and 4.6 kHz, and they play over the empty highway after "START!!". These are the only sounds clearly separate from the song.
- About 6.5 s: the music enters (momentary about −20 LUFS).
- 20–21 s: a brief dip (−22 to −26).
- 22–58 s: steady around −17.
- 59–85 s: about −15.5.
- 109 s: a sharp drop (−33.5), matching the near-empty break at 1m49s, then quieter (−18 to −21) until 125 s.
- 126–161 s: loudest (about −15.2), right after the dense flourish at 2m03s.
- 170 s: the music ends.

In the 41.5–43 s zoom, where red taps cross the judge line, the transients look like song percussion. No click with the count-in's signature stands out. Most likely no hit sounds play, which fits a run where every note misses. Limits: this comes from spectrogram images and loudness numbers only. I could not cross-correlate the click against the track (numpy is not installed), and I listened to nothing.

**Steal for Piano Arcade.**
1. Give each note type its own color and shape (tap bar, hold column, glowing ribbon), so dense passages read at a glance even in thin lanes.
2. Put the judgment counters, combo and score in one top-center HUD panel, off the playfield. That answers where the arcade mechanics go when 88 lanes leave no room.
3. Make holds lit columns with a gradient, which is readable even one key wide.
4. Use a glowing full-width judge line, and a short count-in (four clicks at tempo) before the first note.
5. Keep the playfield black with a loud background around it, so the busy art never competes with notes.

**Avoid.**
1. Strong perspective: far notes shrink to slivers, and 88 keys can't afford that. Keep Synthesia's flat, key-aligned columns.
2. Free-curving slides and air notes: a piano has fixed keys and no gesture input.
3. Faint, far-away judgment text: a learner needs clear feedback right at the key that was played.
