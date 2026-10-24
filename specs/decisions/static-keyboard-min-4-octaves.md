# static-keyboard: a four-octave minimum, C2–C6 for songs that fit

**Context.** static-keyboard shipped (#412) with a two-octave minimum. The library's keyboards then ran from 15
white keys (Twinkle, the Minuet) to 43 (Moonlight, the Nocturne, Maple Leaf): a 2.9× spread in key width between
songs. Eric delegated reversible calls; the planner took the recommended default on 2026-10-24.

**Options.** A: keep two octaves. B: four octaves, centered on each chart (Twinkle would get C3–C7). C: four
octaves, and every chart that fits inside C2–C6 gets exactly C2–C6.

**Choice.** C. Five of the ten songs share C2–C6 (29 white keys); Für Elise and Gymnopédie keep 36, the three widest
keep 43. The spread is 1.5×. Narrow charts outside C2–C6 still split their missing octaves, the odd one above.

**How to undo.** In `web/src/game/core/range.ts`, set `MIN` back to 24 and drop the `HOME` line; restore the
spec's "Minimum 2 octaves" rule and the Twinkle and Minuet rows (C4–C6, 15 keys).
