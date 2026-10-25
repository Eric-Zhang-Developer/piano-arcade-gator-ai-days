## What shipped
- Crowd Mode, `?x=crowd` on /play, in the Lab's Wow group. A press opens the laptop mic, and an AudioWorklet hears the room's claps over the piano: 2–8 kHz spectral flux, gated by flatness, with the threshold raised near note-ons.
- On screen: a CROWD meter (the on-beat share), a ROOM ruler of ticks on the hit line, and "ROOM n% ON BEAT · k claps" on the results. The room's score never touches the judge, the score or the take, and the audio is never stored or sent.
## Where it lives
`web/src/game/x/crowd/` (dsp, mix, score, worklet, index), `specs/decisions/crowd-onsets.md` and `crowd-grid.md`, and `specs/features/crowd/shots/`.
## How to check it
- Unit tests: `pnpm -C web exec vitest run src/game/x/crowd`. At −6 dB on synthesized claps over the laptop voice, precision and recall are 1.000 and the median |error| is 0.7 ms. CPU is about 0.7% of each block's budget, offline.
- Browser: not verified locally; covered by CI. Not heard by Eric: spec step (d), 30 s of Twinkle on the DGX while someone claps.
## Gaps
- The fixtures are synthesized: no real room, no DGX. On the hammer stress bed, P = R = 0.958.
- CPU was measured offline in node, not inside a live worklet.
