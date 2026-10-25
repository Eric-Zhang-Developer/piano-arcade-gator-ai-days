---
name: "Laptop sound: with no piano connected, the laptop plays the game's piano part and your key presses"
depends_on: ["core-loop", "piano-out", "beat-track", "options-panel", "piano-sim"]
owns: ["specs/features/laptop-sound/", "changes/laptop-sound.md", "web/src/game/laptop-sound/", "specs/decisions/laptop-sound-"]
assignee: "eric"
---

# Laptop sound

Issue #612. Eric, 2026-10-24, after a grill round: "Yes to all eight recommendations." Today the game's sound is
MIDI only. Without the DGX plugged in, Eric can't test locally, and the player's own laptop key presses make no
sound. It also matters for a demo on a teammate's laptop and for a Vercel site, where there's no piano.

About 12 features find the piano by looking for a MIDI output named "Portable Grand": beat, piano-out, piano-voice,
hand-mode, scenes and watch-demo, demo-reset, midi-watchdog, core input, and the `/simon`, `/calibrate`, `/attract`
and `/sim` pages. So this feature doesn't touch them. It makes a "Portable Grand" exist when no piano does.

## Plan
1. **`feat(laptop-sound)`, part 1:** `web/src/game/laptop-sound/`, with the synth, the virtual output, the
   `requestMIDIAccess` wrapper and their tests. Not installed anywhere yet.
2. **`fix(core-loop)`:**
   - `web/src/app/layout.tsx` imports the install module (below).
   - `keysDevice` in `web/src/game/core/input.ts` calls laptop-sound's `laptopKey(type, pitch, velocity)` in its key
     handler, right after the `keyMap` lookup.
   - `midiDevice`'s status reads `Piano: laptop sound` when the virtual output is active.
3. **`fix(options-panel)`:** a "Piano volume" slider beside "Effects volume".
4. **`feat(laptop-sound)`, part 2:** `verify-laptop.mjs`, the done note.

## Requirements
**The wrapper**
- Installed once, when a client module imported by `layout.tsx` first loads (`if (typeof window !== "undefined")`
  at the top level), not in an effect. Child effects run before the layout's, so a pull request from any page or
  plugin must already see the wrapper.
- `navigator.requestMIDIAccess(opts)` calls the browser's own. If its outputs include a name containing "Portable
  Grand", it returns the browser's access unchanged: **a real DGX always wins**.
- Otherwise it returns an access whose `outputs` also lists the virtual output, `name: "Portable Grand"`,
  `manufacturer: "Laptop sound"`, `id: "laptop-sound"`, and whose `inputs` are the browser's own.
- With no Web MIDI at all (Safari, Firefox without the permission), it defines `requestMIDIAccess`, so the access
  has no inputs and only the virtual output. `midiDevice` then reads "no device", as today.
- A DGX plugged in later (the access's `statechange`) takes over: the virtual output goes silent (All Notes Off),
  and new lookups find the real one.
- `?midi=sim` is untouched: piano-sim's `installSim` replaces `requestMIDIAccess` whole, so `/sim`'s fake piano
  stays silent and the tests stay quiet.

**When it's on**
- Automatic when no piano answers.
- `?midi=laptop` forces it on even with the DGX connected. The virtual output is then listed first and named
  "Portable Grand", so features use it.
- `?midi=off` keeps it silent (no virtual output).
- Test hook: `window.__pianoArcadeLaptop = { active, voices }`, where `voices` is the count sounding now.

**The sound** (Web Audio, synthesized, no sample files)
- Note-on and note-off on channels 1–16 (velocity 0 is note-off, as the DGX sends), plus CC64 (the pedal) and CC123
  (All Notes Off).
- A piano-like voice: a fast strike, then a decay, louder and brighter with velocity.
- **The pedal:** while CC64 is ≥ 64, a note-off doesn't end the note. Lifting the pedal ends every held note.
- **Channel 10 drums,** for beat-track: kick (36), snare (38), side stick (37), closed hi-hat (42), each a short
  synthesized hit. Other drum notes are silent.
- Program changes are accepted and ignored: every other channel plays the piano voice in v1.
- **At most 32 voices.** A 33rd steals the oldest.
- One `AudioContext`, resumed on the first key press or click (the browser's autoplay rule). Until then, nothing
  sounds and nothing throws.

**Laptop key presses**
- In laptop mode (the virtual output active), a laptop key sounds from `keysDevice`'s own key event, not the frame
  loop. The target is under ~15 ms from key to sound. With the DGX connected, laptop keys stay silent, so there's
  no double sound.
- The key's release ends the note, through the same voice and pedal rules.

**Volume**
- "Piano volume" in the options panel, beside "Effects volume". 0–100%, 70% by default, saved per browser in
  `localStorage` (`pianoArcade.pianoVolume`). The effects mute doesn't touch it.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/laptop-sound`, against a fake `AudioContext`:
   - the voice lifecycle: note-on starts a voice, note-off releases it, and velocity 0 counts as a release;
   - the pedal: notes released while CC64 ≥ 64 keep sounding until CC64 < 64, then all end;
   - All Notes Off (CC123) ends every voice;
   - the 32-voice cap steals the oldest;
   - channel 10's 36/38/37/42 make drum hits, and other channel-10 notes are silent;
   - the wrapper: a fake access with a "Portable Grand" output comes back unchanged; one without gets the virtual
     output; no `requestMIDIAccess` gets one defined; `?midi=off` adds nothing; `?midi=laptop` adds it even
     beside a real one.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug laptop-sound --worktree . --cmd "node {worktree}/web/src/game/laptop-sound/verify-laptop.mjs --out {out}"`.
   Chromium with no MIDI devices. It prints `verify-laptop: pass` or names each failed step:
   1. `/play?song=twinkle` -> `__pianoArcadeLaptop.active` is true, and the status line reads `Piano: laptop sound`.
   2. Laptop keys A, S, D -> `voices` rises with each press and falls after release. It prints the key-to-voice
      time measured in the page for each key.
   3. watch-demo on Twinkle (`W` from the select) -> voices sound through the song, and `voices` is 0 at the end
      (no stuck notes).
   4. `?midi=off` -> `active` is false, and a key press starts no voice.
3. On the laptop, with the piano unplugged (Eric; mark it in the done note): is it playable, and is the latency
   acceptable?

## Defaults
- **First in `extras`,** ahead of score-card, as Eric asked. Cut if it isn't done by Sunday noon (2026-10-25
  12:00 ET).
- **No migration:** the existing oscillator beeps (song-preview, watch-demo, hand-mode, wait-hint, beat clicks,
  ui-sounds) stay as they are. Most go through "Portable Grand" first anyway, so they now sound through this
  feature. The cleanup is later, as its own issue.
- **Samples later,** as their own issue (licensing and size).
- **Calibration:** the done note says to rerun `/calibrate` in laptop mode. Laptop sound has its own latency, which
  Eric's DGX offset doesn't cover.
- Log any choice this spec doesn't make in `specs/decisions/laptop-sound-*.md`.
