# select-motion: the spring, the repeat curve and the scroll

**Context.** The spec asks for one critically damped spring behind the focus bar and the list's scroll, stiffening
with the key-repeat rate so the bar is on the focused row within a frame of key-up. It leaves the constants, the
curve and the wheel snap rule to the worker.

**Choices.**
- **The spring** is the closed-form critically damped solution, stepped by `dt`, in `select-motion/spring.ts`. It is
  exact at any frame length and can't overshoot, and a retarget keeps position and velocity. No motion library: the
  spec says none, and this is 20 lines.
- **Base response 0.3 s** (ω = 2π/0.3 ≈ 21): Apple's default for a critically damped move. It rests on the target
  once it's under 0.5 px and 20 px/s.
- **The repeat curve:** ω = max(base, 6 / interval), capped at 400. A critically damped spring tracking a ramp lags
  by 2·speed/ω. At one row per interval that's a third of a row, so key-up finds the bar on the right row. At a
  33 ms repeat ω is about 180. A lone press, or a repeat slower than about 280 ms, uses the base. Key-up resets the
  curve.
- **The scroll** goes to the snap position (row and header tops, clamped to the range) nearest the centred row, or
  to the chip's header. `scroll-snap-type` is off while the spring scrolls and comes back on at rest, on a snap
  position, so nothing jumps. Section headers became snap points (`scroll-snap-align: start`), so a chip can land on
  one.
- **The wheel** keeps the browser's own mandatory snap: it already scrolls freely, then rests on a row. A wheel
  event during a spring scroll hands the list back to the wheel. No JS wheel snap.

**How to undo.** Change `springSettings` in `spring.ts` (`responseS`, `repeatGain`, `maxOmega`). The header snap point
is one line in `main-page.module.css`.
