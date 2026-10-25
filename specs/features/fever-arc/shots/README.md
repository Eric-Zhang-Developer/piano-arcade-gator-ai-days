# fever-arc shots

From the dev server through the in-app browser, 2026-10-25: before is origin/main 3a412df6 (`:3000`), after is this
branch. Canvas layers only (the shots composite every `<canvas>`), Twinkle at 100 BPM.

**The take:** `/play?input=test&beat=off`, every note pressed through core's test device 5 ms late, except note
index 20 (after fever starts), which breaks the combo. Fever starts at the 12th press (7205 ms, combo 12); its beat
is 7800 ms.

**Contact sheets** (`before-1280.jpg`, `after-1280.jpg`, `before-1920.jpg`, `after-1920.jpg`,
`after-1280-reduce.jpg`): 45 frames, row by row, 9 to a row. Frames 1–39 run every 100 ms from ignition −1800 ms (the
10th press, gauge at 83%) to ignition +2000 ms; frames 40–45 run every 100 ms from the break (+0 to +500 ms). Each
frame is within 16 ms of its time.

**Single frames:** `after-1280-ignition.jpg` (7806 ms, the first frame after the beat), `before-1280-feverstart+400.jpg`
(main at 7613 ms, already lit since 7205), `after-1280-sustain.jpg` (ignition +2 s).

**Videos** (`fever-before.webm`, `fever-after.webm`): ignition −1900 to +2500 ms, then the break −100 to +700 ms, at
60 fps. Stepped frames, not a live capture, and silent: the sweep isn't retimed in this PR
(`specs/decisions/fever-arc-switch-offs.md`), so the sound would be the same before and after.
