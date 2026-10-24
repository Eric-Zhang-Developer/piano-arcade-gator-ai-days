---
name: MIDI watchdog: reconnect when Chrome's input goes silent
depends_on: ["core-loop"]
owns: ["web/src/game/midi-watchdog/"]
assignee: "eric"
---

# MIDI watchdog

The spike's one open risk: twice, Chrome stopped receiving keys for minutes, cause unknown
(`spikes/piano-midi/RESULTS.md`, Unknowns). Detect it and recover. Register with `wrapInput` in
`web/src/game/layers.ts`.

## Requirements
- The DGX-660 sends Active Sensing (`0xFE`) constantly, so silence on the port means a stall, not a quiet player.
  A stall is: no MIDI message of any kind for 3000 ms while the piano's input port is connected.
- On a stall: re-request MIDI access, reopen the same port, and show a small "reconnecting MIDI" notice until a
  message arrives. Log each stall and recovery with times to the console and to a list the results screen can show.
- Never drop or duplicate key events across a reconnect.
- If the piano is unplugged (`statechange` to disconnected), show "piano disconnected: laptop keys active" and switch
  to laptop keys.

## Validation
- Vitest: with a fake clock and a fake port, 3 s of silence triggers exactly one reconnect; messages every 300 ms
  trigger none.
- On the piano (Eric): play for 10 minutes with two Chrome tabs open, then close one. Record any stall and recovery.

## Defaults
- If Active Sensing turns out not to arrive in Chrome, fall back to: no key event for 10 s while notes are due.
