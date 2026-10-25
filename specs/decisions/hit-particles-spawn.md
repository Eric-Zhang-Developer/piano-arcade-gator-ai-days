# hit-particles: spawn cap, governor and reduced motion

**Context.** The spec asks for a cap on spawns per second, a governor that halves spawning on slow frames and
recovers slowly without ever freezing, and a fraction of the particles under reduced motion, with the numbers left
to the worker. The pool holds 16,384 slots and dust lives 2–3 s, so about 6,500 spawns a second keep it full.

**Choice** (all in `hitParticleSettings`, `web/src/game/hit-particles/pool.ts`):
- **Cap: 6,000 spawns in any 1 s window**, as a token bucket: 1,200 at once (a big chord), the other 4,800 refilled
  evenly. Below the pool's turnover, so a full pool overwrites only its oldest, faintest specks.
- **Per hit:** PERFECT 140 specks and 4 wisps, GREAT 90 and 3, GOOD 50 and 2. **Held hit key:** 420 specks a second.
- **Governor:** a frame-time average (5% of each new frame) above **20 ms** (under 50 fps) halves spawning, at most
  once every 500 ms; good frames win back **a tenth of the full rate per second** (floor to full in about 9 s). The
  floor is **1/16**, never zero, and the governor never stops the render: only spawning slows. A gap of 250 ms or
  more is a pause, not a slow frame.
- **Reduced motion: a quarter** of every spawn.

**Options not taken.** A hard per-frame cap (bursts would look clipped); freezing like fever-stage's guard (the spec
forbids it); a quicker recovery (it would oscillate on a machine that sits near 20 ms).

**How to undo.** Change the numbers in `hitParticleSettings`; the tests in `pool.test.ts` read them.
