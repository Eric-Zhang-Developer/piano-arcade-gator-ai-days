---
name: "Piano remote: outside a song the piano drives the menus, and the strip shows which keys"
depends_on: ["play-slots", "led-game"]
owns: ["web/src/remote/"]
assignee: "sharan"
---

# Piano remote

At the booth nobody should touch the laptop. Outside a song, four piano keys drive the screens: **C4** (MIDI 60) is
OK / next, **A3** (57) is retry / back, **D4** (62) is up and **B3** (59) is down. In phase 2 the LED strip lights
them: C4 red, A3 blue. While a song plays, the remote is off and every key is just a note.

The screens are keyboard-driven, and the keys mean different things on each (on results, Enter is retry), so the
remote maps per screen, not one global key swap. Each row below is the screen's real control on `origin/main`:

| Screen (how the remote knows) | C4: OK / next | A3: retry / back | D4: up · B3: down |
|---|---|---|---|
| Music select: `/` | Enter on the focused song link: it plays it (`onPlay` in `game/select-layout/index.tsx`) | nothing: the select has no back (its keys: ↑ ↓ Enter L W E F O X) | ArrowUp · ArrowDown on the focused link (the list's `onKeyDown`) |
| Options drawer open on `/` (`dialog[open]`, `game/options-panel/`) | Enter on the focused row (`enterToggles`) | closes the dialog | ArrowUp · ArrowDown (the dialog's `onKeyDown`) |
| `/play` start screen (the remote's `startPanel` is mounted) | Enter on the focused control: Start has `autoFocus` (`app/play/page.tsx`) | back to `/` (the screen has no key or link for it) | nothing |
| `/play` loading or error | nothing | back to `/` (the error's "Back to the song list") | nothing |
| Playing: `songStart` until `songEnd` or `quit` (count-in and pause included) | **off**: a note | **off**: a note | **off**: notes |
| Results (the remote's `resultsPanel` is mounted) | Songs: to `/` (the Songs link in `game/results-layout/index.tsx`) | `retry()` from `ResultsPanelContext`, "the same as the Retry button" | nothing |
| Results with the replay open (`[data-testid="replay-overlay"]`) | nothing | Escape (closes the replay, `game/replay-view/overlay.tsx`) | nothing |
| Any other route (`/cabinet`, `/attract`, `/lab`, `/sheet`, ...), or `/play?cabinet=` | off | off | off |

"Enter / Escape / ArrowUp on X" means a synthetic `keydown` dispatched on X (bubbling), so the page's own handlers
run. A synthetic Enter doesn't activate a link or button, so when no handler called `preventDefault`, the remote then
calls `click()` on the focused element, as the browser does for a real Enter. A synthetic Escape doesn't close a native
`<dialog>`, so the remote closes an open one itself.

## Plan
Phase 1, keys only. Needs nothing from Eric but the mount.
1. `web/src/remote/keys.ts`: pure. `actionFor(screen, pitch)` (the table above) and the press filter (below),
   unit-tested.
2. `web/src/remote/listen.ts`: `requestMIDIAccess`, every input, `addEventListener("midimessage")` on each and on
   inputs that connect later, as `web/src/game/midi-watchdog/index.ts` and `web/src/game/cabinet/idle.ts` do. It
   never sets `onmidimessage` and never wraps core's input, so core's MIDI device keeps working. Returns a disarm.
3. `web/src/remote/index.tsx`: `pianoRemote()`, a `GamePlugin` whose `onEvent` turns the remote off at `songStart`
   and on at `songEnd` / `quit`; a `startPanel` and a `resultsPanel` that tell the remote which `/play` screen is up
   (the results one keeps `retry`) and show one hint line ("On the piano: C4 start · A3 songs" / "C4 songs ·
   A3 retry"). And `<PianoRemote />`, a client component that reads the route and runs the table.
4. The mount, two lines in Eric's files (`.github/CODEOWNERS`: `web/src/game/`; `app/layout.tsx` is game code too).
   The remote PR doesn't touch them: a `needs-human` issue for `eric` asks for exactly this, the way `demo-reset` and
   `help-overlay` mount:
   - `web/src/app/layout.tsx`, next to `<DemoReset />`: `<PianoRemote />` (import `{ PianoRemote } from
     "../remote"`).
   - `web/src/game/layers.ts`, after `leds()`: `pianoRemote(), // piano-remote: C4 OK, A3 back, D4/B3 up/down
     outside a take` (import `{ pianoRemote } from "../remote"`).
5. `web/src/remote/verify-remote.mjs`: the headless check below.

Phase 2, LED prompts. Waits on Eric's answer to one question: how a second module sends on the LED link. A page can't
open the Web Serial port twice, and reopening it resets the board for 1-2 s, so the remote must use led-game's
connection. `web/src/game/leds/serial.ts` already exports `send(m)`, `linkState()` and `subscribe()`, and
`messages.ts` exports `hint(pitch, rgb)`. But `autoConnect()` runs only from the "Connect lights" button on
`/play`'s start screen, so after a fresh load of `/` the link is closed.
- **A (recommended):** Eric names `send`, `linkState` and `subscribe` in `game/leds/serial.ts` as the API the remote
  may import, and calls `autoConnect()` once from the layout, so the link opens on `/` too. No new module.
- **B:** a shared connection module outside `game/` that both use. More moving parts for the same result.
- Either way the remote never opens a port itself.

Once answered:
6. `web/src/remote/lights.ts`: on each screen change, hints (`0xA0 note r g b`) for that screen's live keys, and
   `0,0,0` for keys that go dark. Off at `songStart`: clear all four before the game's guide lights start. Only
   while `linkState()` is `"ready"`; otherwise do nothing.

## Requirements
- **Press filter:** a note-on with velocity > 0 on one of the four pitches is one press. Another note-on of the same
  pitch counts only after its note-off (some keyboards repeat a held key). Every other pitch does nothing.
- **Arm delay:** a screen takes presses `armMs` (default 1500) after it appears. A song's last notes, or a chord
  still held when the results come up, never navigate.
- **Off during a take:** from `songStart` to `songEnd` or `quit`, the remote does nothing, pause included. The
  game's input, judging and timing are unchanged: the remote only adds listeners to the raw ports.
- **Off during a replay on the piano** (`getReplayState().playing`, `game/piano-out/`): its notes go out to the DGX
  and must never navigate if the DGX echoes them back.
- **Real ports only:** `?input=test` turns the remote off. `?midi=sim` (`piano-sim`) and laptop-sound's virtual
  output add no MIDI input, so they can't press anything.
- **No piano, no change:** without Web MIDI, with permission refused, or with no input, nothing happens and nothing
  errors. Laptop keys and the mouse work as before (`mission.md`).
- **LED prompts are light only** (phase 2): C4 red `(127,0,0)`, A3 blue `(0,0,127)`, lit only on screens where that
  key does something. With no board, no Web Serial or a closed link, the game behaves exactly as without the remote.
  Nothing waits on a serial write.
- Disarm on unmount: leaving the page leaves no MIDI listener and no lit hint behind.

## Validation
- Vitest (`web/src/remote/`): `actionFor` for every row of the table; the press filter (60 then 60 with no note-off
  in between -> one press; 60, note-off, 60 -> two; velocity 0 -> none; 61 -> none); the arm delay (a press at
  1499 ms -> none, at 1500 ms -> one).
- `verify-remote.mjs`, headless, with a fake `navigator.requestMIDIAccess` installed before the page loads (as
  `web/src/game/cabinet/verify-cabinet.mjs` does), and the two mount lines applied in a scratch copy, since they
  live in Eric's files:
  on `/`, wait 1.5 s, send 59, 59 -> the third song link is focused; 62 -> the second; 60 -> `/play?song=<that id>`.
  On the start screen, 60 -> the take starts. During the take, send 60, 57, 62, 59 -> the URL and phase don't change
  and the take's results count those notes as the game always did. At results, 57 before 1.5 s -> nothing; after
  it -> a new take starts (retry). At the next results, 60 -> `/`. Without the fake (no MIDI at all), plain
  Twinkle to results passes as before, with no console errors. Keep the URLs and a screenshot of each hint line.
- `python3 .agents/scripts/verify.py --slug piano-remote --worktree . --cmd "node {worktree}/web/src/remote/verify-remote.mjs --out {out}"`.
- Phase 2, with a fake LED board (as `web/src/game/leds/verify-leds.mjs` does): `/` -> `a0 3c 7f 00 00` and
  `a0 39 00 00 7f`; at `songStart` -> `a0 3c 00 00 00` and `a0 39 00 00 00` before the first guide light.
- On the DGX-660 (a person): from `/` start a song, finish it, retry with A3, go back with C4, never touching the
  laptop; then the same with the strip. If nobody tried it, the done note says `not verified on the piano`.

## Defaults
- The keys are MIDI numbers (60, 57, 62, 59), whatever octave the keyboard's labels show.
- Phase 2: D4 and B3 stay dark. Sharan named lights for C4 and A3 only.
- No on-screen hint on `/`: the select's header is Eric's. A hint there is a `needs-human` issue for `eric`.
- Not mapped: L, W, E, F, O, X, the initials on a new record, and the pause menu (reached only with Esc on the
  laptop). Clicking Retry or Songs on a new record skips the initials, as the mouse does.
- Chrome counts no MIDI message as a user gesture, so audio and MIDI permission may still need one click per page
  load. The booth fix is outside this feature (a Chrome launch flag for the booth laptop, checked there). The done
  note says what was seen.
- Changes to `armMs`, the keys or the colors go in `specs/decisions/piano-remote-*.md`.
