## What shipped
A Dynamics panel on the results screen. It grades how loud you played against the score, two bars at a time, by shape, not level: each phrase's velocity relative to your take's average, compared with the score's relative to the chart's.
- A summary ("1 of 7 phrases too soft"), one entry per graded phrase ("Bars 13–14: too soft, -43"), and your average velocity against the score's.
- Laptop keys and scores without dynamics get a one-line message.
## Where it lives
`web/src/game/dynamics/` (`index.ts` grading and plugin, `panel.tsx`, `dynamics.test.ts`, `verify-dynamics.mjs`), one entry in `web/src/game/layers.ts`, screenshots in `specs/features/dynamics/screens/`. Chart velocities: #180 and #186 (song-pack-1's converter, rule decided on #181).
## How to check it
- `verify.py --slug dynamics` passed at 14a36c7.
- `node web/src/game/dynamics/verify-dynamics.mjs --out <dir>` passed: Chopin at its own velocities shows "All 7 graded phrases match the score". With bars 13–14 at velocity 30, it flags that phrase alone as too soft (-43).
## Gaps
- **Which charts grade:** only `chopin-prelude-4` has velocities (from its CC7 dynamics, 34–106). Ode to Joy, Für Elise, Twinkle and the rest show "This score marks no dynamics".
- **Not verified on the piano** (Eric): play a phrase much louder than marked, and the panel should flag it. The DGX's velocity range against the CC7 levels is unmeasured. The shape rule should absorb the difference, but that's untested on the instrument.
