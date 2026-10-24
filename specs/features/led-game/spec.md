---
name: LED game link: the game lights the next key and every hit on the strip
depends_on: ["core-loop", "led-strip"]
owns: ["web/src/game/leds/"]
assignee: "eric"
---

# LED game link

Connect the game to the LED board (`led-strip`) so the strip is part of play: the next note glows before it
arrives (guide lights), and hits and misses show on the keys. Register as one `GamePlugin` in
`web/src/game/layers.ts`. The protocol is in `specs/features/led-strip/spec.md`; `firmware/tester.html` has a
working client to port.

## Requirements
- A "Connect lights" button opens Web Serial at 115200 and waits for the `PAL1 leds=` line (opening the port
  resets the board, about 1-2 s). No Web Serial or no board: the button says so and the game runs as before.
- **Guide lights:** each chart note sends a hint `lead` ms before its time (default 600) and clears it when judged.
- **Hits:** a judged note sends key on with its judgment's color; release sends key off. Misses flash red.
- Heartbeat `0xFE` every 1000 ms while connected. On song end and page unload, send `0xF0`.
- Never block or delay judging on a serial write.

## Validation
- Vitest: a pure function turns a chart, a clock time and judgments into the exact byte messages, including hint
  lead and clears.
- On the piano (Eric): play Twinkle with lights connected; every next key glows before its note, and nothing
  stays lit after the results screen.

## Defaults
- Colors come from the HUD's judgment colors, scaled to 0-127.
