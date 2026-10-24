## What shipped
Fever now comes from a gauge instead of a combo of 50, so it happens on Twinkle. PERFECT adds 1, GREAT 0.5, GOOD nothing. The gauge is full at a quarter of the chart's notes, clamped to 12–50 (Twinkle: 12). Before fever a MISS or WRONG halves it. During fever a combo break ends fever and empties it, and fever can start again after a refill. A thin meter under the HUD panel fills in sun orange, burns in the sun gradient during fever and says FEVER (dim, then lit).
## Where it lives
`web/src/game/fever-gauge/` (`gauge.ts` the pure reducer, `index.ts` the meter plugin, `gauge.test.ts`, `verify-fever.mjs`), one entry in `web/src/game/layers.ts` (last). The judge uses it since #171 (`web/src/game/core/judge.ts`; `FEVER_COMBO` is gone). The gauge landed in #166. `specs/decisions/fever-gauge-meter.md`, screenshots in `specs/features/fever-gauge/screens/`.
## How to check it
`verify.py --slug fever-gauge` pass at c94e42c: 42/42 PERFECT with test input and through the MIDI path on /sim. `node web/src/game/fever-gauge/verify-fever.mjs --out <dir>` pass at c94e42c: on Twinkle, fever started at combo 12, ended at the miss and started again after a refill, and the meter agreed with the judge.
## Gaps
- Not played by hand in desktop Chrome. The spec's Chrome steps ran in headless Chromium (verify-fever), with screenshots.
- Not verified on the piano (Eric): on Twinkle, fever should come within the first half of a good take.
- The meter has no animation, so reduced motion needs nothing extra. `fillShare` hasn't been tuned on real takes.
