---
name: "Piano sim: a virtual DGX-660 for testing the real MIDI path, and a /sim page"
depends_on: ["core-loop"]
owns: ["web/src/game/sim/", "web/src/app/sim/"]
assignee: "eric"
---

# Piano sim

Only one piano exists, and an agent can't press its keys. This feature is a virtual DGX-660 that speaks Web MIDI.
The game's **real** MIDI input code (port pick, `0xFE` filter, velocity-0 release, `timeStamp`) runs against it in
Vitest, so CI and agents can test MIDI features without the piano. A `/sim` page shows it working: the game, a
virtual keyboard, a live MIDI log and fault buttons. It goes in the Devpost deep dive.

Read first: `spikes/piano-midi/RESULTS.md` (what the piano really does), `spikes/piano-midi/python-piano.log` (a real
capture), and core-loop's input requirements (`specs/features/core-loop/spec.md`).

## Plan
1. A fake `MIDIAccess` (the standard Web MIDI interfaces, nothing custom) in `web/src/game/sim/`.
2. A behavior profile built only from measurements, plus fault switches.
3. A real-capture fixture converted from `python-piano.log`, and a record mode that makes more of them.
4. Vitest tests that drive core-loop's real MIDI input through the fake.
5. The `/sim` page.

## Requirements
**Fake Web MIDI:**
- `createSimMidiAccess(profile)` returns an object with the `MIDIAccess` shape: `inputs` and `outputs` maps,
  `onstatechange`, and ports with `name`, `manufacturer`, `state`, `onmidimessage` and `send`. Events carry
  `data` (a `Uint8Array` of raw MIDI bytes) and `timeStamp`.
- The default ports match Chrome's view of the real piano: one input and one output, named `Portable Grand`, with
  manufacturer `Yamaha Corporation` (RESULTS R1: Chrome shows "Portable Grand (Yamaha Corporation)").
- It is driven by a timeline of `{ timeMs, bytes }`: from a `Take`, a fixture, the virtual keyboard or a test.
- Messages sent to the output are recorded so tests can assert on them, but never echoed back to the input
  (RESULTS R7: no echo).

**Behavior profile:** every value cites its RESULTS line. Defaults, all measured:
- keys on channel 1;
- release as note-on with velocity 0;
- CC 64 as a ramp of values, sent on both channel 1 and channel 2;
- chord notes may share a `timeStamp` (0.0 ms gaps seen in Chrome).

**Unknown, so left off by default:** Active Sensing. The spike filtered it, so its interval in Chrome was never
measured. Its setting is `activeSensingMs: null`, meaning none is sent. The page and the tests say "unmeasured".
Don't fill in a number from the MIDI spec or from memory.

**Faults**, each off by default:
- `stall(ms)`: no messages of any kind for that long, while the port still says connected.
- `unplug()` and `replug()`: port `state` changes and a `statechange` event fires.
- `jitterMs`: random ± delay per message, with a seeded random source so tests repeat.
- `dropRelease(pitch)`: the next release of that pitch never arrives (a stuck note).

**How `/play` uses it:** `/play?midi=sim` replaces `navigator.requestMIDIAccess` with the fake before the game asks
for MIDI. It is never enabled otherwise. It hooks in through `web/src/game/layers.ts` (the open file); it changes
nothing in `web/src/game/core/`. If core-loop's input code can't be reached that way, file an issue for a
`fix(core-loop)` instead of editing core. The fake listens on `BroadcastChannel("pianoArcade.sim")`, so the `/sim`
page can play the game in an iframe.

**Fixtures:**
- `web/src/game/sim/fixtures/python-piano.json` is converted from `spikes/piano-midi/python-piano.log` by a small
  script kept beside it. Keep every message with its time and bytes, and its source path.
- **Record mode** (`/sim?record`, with the real piano): log every raw message unfiltered, including `0xFE`, with
  `timeStamp`, and download it as a fixture JSON. This is how Eric measures Active Sensing and adds real takes.

**`/sim` page:**
- **Game:** `/play?midi=sim` in an iframe.
- **Virtual keyboard:** the chart's key range under it. Click or laptop keys send note-on and note-off through the
  fake.
- **MIDI log:** a scrolling log of raw bytes in hex, with time and gap, the same columns as the spike log.
- **Fault buttons:** stall 5 s, unplug, replug, jitter on or off, stuck note.
- **"Watch the bot":** plays the Perfect player's Twinkle take through the fake, so the game judges it live.
- **"Replay a real take":** plays `python-piano.json` through the fake.
- **The profile:** shown with each value's source, and "unmeasured" where it applies.

## Validation
- `pnpm -C web test`, Vitest. The tests import core-loop's real MIDI input; they never re-implement it.
  - The Perfect player's Twinkle take, sent as raw bytes through the fake, judges all PERFECT. It's the same result
    as `?input=test`, reached through the MIDI path.
  - A note-on with velocity 0 yields an `off` event, and `0xFE` and `0xF8` yield no event.
  - With a second input named "IAC Driver Bus 1" listed first, the game still picks `Portable Grand`.
  - Replaying `python-piano.json` yields one `on` event per note-on with velocity above 0 in the log, at the logged
    times. The test counts them from the fixture, not from a hard-coded number.
  - `stall(3000)` with a fake clock: no messages for 3000 ms while the port's `state` stays `connected`.
  - `unplug()` fires `statechange` with `state: "disconnected"`.
  - Output messages are recorded, and none appear on the input.
- `/sim` in Chrome, each step `action -> what you should see`:
  1. Open `/sim` -> the game, the virtual keyboard, an empty log, and the profile with "Active Sensing: unmeasured".
  2. Click a key -> a note-on line in the log, the key lights in the game.
  3. Click "Watch the bot" -> Twinkle plays, every note judged PERFECT, the results screen in the iframe.
  4. Click "stall 5 s" -> the log stops for 5 s, then resumes.
  5. Click "unplug" -> the log shows the state change.

  Keep a screenshot of step 3's results screen.
- On the piano (Eric; mark it in the done note): open `/sim?record`, leave the piano idle for 60 s, then play
  Twinkle once, and download the fixture. Record in the done note whether `0xFE` arrived, and its interval if it did.
  Set `activeSensingMs` from that number, or leave it `null` if none arrived.

## Defaults
- Prefer the smaller option. No new dependencies: a seeded random source is a few lines.
- No pretty polish beyond readable; `juice-visual` owns the arcade look.
- If a measured behavior and this spec disagree, `RESULTS.md` wins. Fix this spec in the same PR and say why.
