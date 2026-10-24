# synthesia-brahms

Source: `video-references/Brahms - Hungarian Dance No.5 [HCDygl0pttM].mp4`, 144.3 s, 1920x1080, 29.97 fps, AAC stereo 44.1 kHz.
A Synthesia-style falling-notes overlay on top-down footage of a real 88-key keyboard and real hands. No scene cuts (ffmpeg scene score never passed 0.2).

## Frames

- `0m02s.jpg`: intro. "Performed by" title card over an empty highway; first notes already falling, all red at the top. Faint vertical octave gridlines.
- `0m04s.jpg`: first hits. One key lights mint, a small spark at the hit line. Shows the baseline before effects pile up.
- `0m09s.jpg`: medium density. Green/white smoke plumes rising from recent hits and drifting into the highway.
- `0m17s.jpg`: four-note red chord high up, white notes mid-highway, mint notes about to land. Shows the color-by-height gradient.
- `0m17s6-crop.jpg`: full-res crop of one landing. White-hot flare where the note meets the line, the key below glows mint, sparkle plume rises above it.
- `0m18s.jpg`: best overall frame. Red to white to mint gradient, long notes as tall rounded bars, lit keys tint the hands.
- `0m39s.jpg`: quiet passage (audio dip). Fewer notes, residual smoke still hanging in the air.
- `0m50s.jpg`: dense two-hand passage. Many short notes; readability holds because each note is a separate rounded pill.
- `1m06s.jpg`: fast run. Notes stack into vertical columns per key; the gradient makes "which is next" obvious.
- `1m08s.jpg`: loudest stretch (66-72 s). Most keys lit at once, the glow merges into bands over each hand.
- `1m10s.jpg`: fast repeated notes. Tiny pills stacked tightly in the same column, still separable.
- `1m25s.jpg`: wide chords in both hands. Several white flares along the hit line at once.
- `1m40s.jpg`: slow soft section. Sparse long red notes far up, nothing landing, smoke fading.
- `2m04s.jpg`: chord passage. Long white notes next to short ones; length = duration.
- `2m13s.jpg`: final chords. Both hands lit, upcoming chord as tall white bars above.
- `2m13s-crop.jpg`: full-res crop. The hit-line glow brightens into white blobs at each lit key; the line itself is a wavy, animated mint "electric" stroke.
- `2m14s.jpg`: last chord held. Bright mint key glow under one hand.
- `2m15s.jpg`: after the last note. Hands lifted, smoke plumes keep drifting for a couple of seconds.
- `2m18s.jpg`: end card. Keyboard gone, logo and "Don't forget to Subscribe and Like!".
- `spectrogram-0m00s-0m30s.jpg`: audio, first 30 s. Silent until about 3.6 s, then only piano partials (horizontal lines) and note onsets (vertical streaks).

## Report

**Layout.** Flat, straight-on, no perspective. Highway fills the top half (y 0 to ~548 of 1080). The hit line sits right on top of the keyboard. Keyboard is real video footage, full width, all 88 keys, y ~548 to ~800; hands visible. Below the keyboard is black, with a small watermark bottom-left. Background is pure black with faint gray vertical lines, one per octave. No HUD.

**Notes.** Rounded rectangles ("pills"). White-key notes are about one white key wide (~39 px vs 37 px key); black-key notes are narrower (~22 px). Color shows **time to hit, not hand or pitch**: red at the top, pink, then white mid-highway, mint green right before the line. Both hands use the same colors. Long notes are tall bars, with the gradient running along their length. A note is consumed into the line on landing.

**Feedback.** On each note: a white-hot flare where note meets line, the struck key lit mint (the glow spills onto the fingers), and a green/white sparkle-smoke plume rising from the hit point. The hit line is always a wavy, animated mint glow. Judgments, combo and score: not visible, none in the video (it's a performance, not a game).

**Motion and timing.** Notes fall at a constant ~255 px/s (measured on a 5 fps column strip), about 2.1 s of lookahead. In dense runs, notes stack into per-key columns of small pills, still separable. Smoke plumes linger about 1-2 s and drift upward; they keep going after the last note (2m15s). Key glow lasts only while the key is held.

**Palette and mood.** Black, red/pink, white, mint/teal. Cool, nocturnal, elegant; restrained, not arcade.

**Sound.** The mix is solo piano only. The spectrogram shows harmonic partials and onsets, with no click, tick or whoosh layer; content above 8 kHz sits about 42 dB below the full mix. No hit sound separate from the music is visible. Integrated -19.2 LUFS, loudness range 11.2 LU. Peaks: 25 s (-12.9 LUFS momentary), 66-72 s (-12.1), 133 s (-12.2). Dips: 37-41 s (-30.7), 54-60 s (-29.7), the slow section 73-108 s (-20 to -30), and 122-128 s (-33.1). Music ends at ~135 s, then silence under the end card. Loud stretches line up with denser notes and more lit keys. I couldn't confirm that glow size follows velocity. Limits: these are numbers and images only, with no listening and no speech check. Audio was resampled to 22 kHz, so anything above 11 kHz wasn't inspected.

**Steal.**
1. Color by time-to-hit (red to white to mint). It teaches "what's next" on any lane width, and it frees up color for other uses.
2. Key-lights-up under the note, on the real keyboard drawing: the strongest 88-key feedback, since it lands exactly where the finger is.
3. Put the juice on the hit line, not in the lanes: one flare and a plume per hit, rising into the empty space above. This answers our "where do effects go" question.
4. Notes sized to key type (narrow for black keys) and rounded pills, so dense runs stay legible.
5. Lingering smoke as a soft "streak" signal: it could scale with combo instead of being constant.

**Avoid.**
1. Mint-on-everything near the line: the landing color, key glow and hit line are all mint, which would hide a miss or a wrong key. Use a distinct miss/wrong color.
2. A heavy smoke layer over the highway in dense passages; it competes with upcoming notes for a learner.
3. No HUD at all: we need judgments and combo, ideally anchored near the hit line, not over the narrow lanes.
