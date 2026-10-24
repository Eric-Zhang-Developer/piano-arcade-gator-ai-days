---
name: "Backing track: a chart may name a band MIDI that the DGX plays in sync under the player's part"
depends_on: ["core-loop", "beat-track", "bar-loop", "wait-mode", "hand-mode", "piano-sim", "notice-toast", "crash-guard"]
owns: ["specs/features/backing-track/", "changes/backing-track.md", "web/src/game/backing-track/", "spikes/band-player/", "specs/decisions/backing-track-"]
assignee: "eric"
---

# Backing track

The Flower Dance spike (eric-agent-3, `video-references/flower-dance-sheet/work/FINDINGS.md`, local) arranged the
song for a full band as MIDI files: EDM with 11 parts, orchestral with 10, and both again without the piano. They
play to the DGX-660 only from the spike's own player page, so the band and the game would have to be started by hand
at the same moment. This feature lets a chart name a band file that the DGX plays in time with the highway, under
the player's piano part. The spike recommends it; the Tchaikovsky concerto idea (#484) needs the same thing. The
video's Flower Dance cut (EDM, printed bars 58–90, about 80 s) is what it's for.

Issue: #494

**Gate:** promotion into a milestone waits on Eric hearing the spike's arrangements on the DGX (nobody has yet). This
spec is in no milestone until he has; don't pick it before then.

## Plan
1. **`feat(backing-track)`: the band player page.** eric-agent-3 wrote its first version in the Flower Dance spike
   (`work/index.html`); this makes it generic and moves its MIDI code into the shared module. `spikes/band-player/`:
   `index.html` and a small `player.mjs` (the page's controls), plus `local/.gitignore` (`*` then `!.gitignore`) for
   arrangements copied in. The MIDI reader and scheduler go in `web/src/game/backing-track/band.mjs` with
   `band.test.ts`, so the page and the game play the same thing. No copyrighted notes in this PR.
2. **`contract:`** `backing?: string` on `Chart` in `web/src/contracts/index.ts`, its check in `validateChart`, and
   cases in `web/src/contracts/contracts.test.ts`. Additive.
3. **`feat(backing-track)`: the plugin.** `web/src/game/backing-track/index.ts` with its tests, and its line in
   `web/src/game/layers.ts` (an open path in `.agents/config.toml`, so it rides in this PR), plus
   `make-twinkle-backing.mjs`, the fixture's generator.
4. **`fix(beat-track)`:** `web/src/game/beat/` skips its hits inside the backing's spans (Requirements, Beat track).
5. **`fix(core-loop)`:** core-loop owns `web/public/songs/twinkle/`. Add the generated `backing.mid` and
   `"backing": "backing.mid"` to Twinkle's `chart.json`.
6. **`feat(backing-track)`:** `verify-backing.mjs`, and `changes/backing-track.md`.

`web/package.json` is frozen: no new dependency. No change to `web/src/app/play/`: everything goes through
`GamePlugin` hooks.

## The contract
- `Chart` in `web/src/contracts/index.ts` gains `backing?: string // a .mid beside the chart, relative to its
  folder; absent: no band`.
- `validateChart`: when present, it must be a non-empty string ending in `.mid` (any case), with no leading `/`, no
  `..` segment and no `://`. Otherwise `backing must be a relative .mid path`.
- The file's time 0 is the chart's beat 0 of bar 1 (chart time 0). A file with a lead-in bar is wrong, not adjusted.
- `/play?song=<id>` loads `/songs/<id>/chart.json` (`web/src/app/play/page.tsx`), so the plugin fetches
  `/songs/<id>/<backing>` (`twinkle` when `song` is absent, as `/play` does).

## Requirements

### The shared module (`band.mjs`)
- Plain JavaScript with JSDoc types, importable from the plugin's TypeScript (`allowJs` is on in
  `web/tsconfig.json`) and from the band player page as a browser module.
- `readMidi(bytes)`: Standard MIDI File format 0 or 1, tracks merged. Running status, note-on velocity 0 as note-off,
  the tempo map (every `FF 51` on any track) turned into ms. Skips meta and SysEx events. Refuses SMPTE division,
  format 2 and cut-short files with a reason. `take-midi`'s `readTakeMidi` isn't reused: it reads one track at one
  tempo and checks the chart's title.
- It returns `{ events: { atMs, data }[] (sorted, stable), endMs, channels, channel1Notes }`.
- `between(events, fromMs, toMs, { tempo, seekMs, passMs, passes })`: the events due in a chart-time window. A file
  time `m` plays at chart time `(m - seekMs) × 100 / tempo + k × passMs` for pass `k`, so a window never returns an
  event twice.
- `setup(events, seekMs)`: chases the state at the seek point: per channel, the last program change and the last
  value of each controller at or before `seekMs` (CC 64 excepted: the pedal starts up).
- `silence(channels)`: CC 123 = 0 (All Notes Off) and CC 64 = 0 (pedal up) on each channel listed.
- `GM_ON`: `F0 7E 7F 09 01 F7`.

### The band player page (`spikes/band-player/`)
- A standalone dev page. Serve the worktree root (`python3 -m http.server 8041 -d <worktree>`) and open
  `http://localhost:8041/spikes/band-player/?file=<path>`; `?file=` is relative to the page, and `?port=` matches a
  MIDI output's name (default "Portable Grand", as the game uses).
- Play sends GM System On, the file's setup, a one-bar count-in (side stick, channel 10, at the file's first tempo),
  then every channel of the file. Stop, Esc and leaving the page (`pagehide`) send pedal up and All Notes Off on all
  16 channels.
- It shows the file's parts (channel, first program, note count), the elapsed time and the chosen port, or "No MIDI
  output named <port>".
- **Local arrangements:** copy them into `spikes/band-player/local/` (self-ignored, decision 003). Worktrees read
  local content by copying it in (decision 004's rule, PR #493). Nothing copyrighted is committed.

### The plugin (`web/src/game/backing-track/`)
- One `GamePlugin`, registered in `layers.ts` before `barLoop()` (after `easyCharts()`), so its `transformChart`
  sees the chart before the loop and calls bar-loop's exported `loopChart` itself for the loop plan.
- **Loading:** in `transformChart`, when the chart has `backing`, fetch and `readMidi` it, and find the output whose
  name contains "Portable Grand" (as beat-track does). Once both are ready, send `GM_ON` once, at load, before Start.
  Not at `songStart`: a reset then could swallow piano-voice's program change on channel 1.
- **songStart:** send the setup on channels 2–16, timestamped now. Then schedule events with beat-track's
  pattern: `zero = performance.now() - atMs`, a 300 ms lookahead filled on each `draw`, and
  `MIDIOutput.send(data, zero + atMs)`. Never timers.
- **Channel 1 is the player's, so it's skipped entirely** (notes, program changes, controllers, pitch bend). The DGX
  sends and plays the player's keys on channel 1 (`spikes/piano-midi/RESULTS.md` R2; piano-sim's `keyChannel: 1`).
  piano-voice sets the player's voice with a program change on channel 1, and hand-mode plays the other hand on
  channel 1. A band part on channel 1 would double the player, change their voice, or collide with hand-mode's notes.
  `band.mjs` counts channel-1 notes; when there are any, the plugin logs one `console.warn` with the count, so a
  local file that put a part there gets fixed in its arranger, not here. For Flower Dance, use the spike's
  minus-piano files.
- **Silence on every exit:** `silence(2..16)` and `clear()` (when the browser has it) on `pause`, `quit`,
  `songEnd`, `pagehide` and a new `songStart`, and on crash-guard's error paths:
  - its own hook throws: the plugin silences, then rethrows, so the guard still turns it off;
  - the frame loop stops without an event (the "Something broke." card, an unmount): an interval silences when no
    `draw` has come for 500 ms while playing.
  Never on channel 1.
- **Resume** re-anchors as beat-track does: `zero = performance.now() - atMs`, then events from `atMs` on. Notes cut
  at the pause aren't re-struck.
- **End:** the band stops at `songEnd` (`/play` ends about 1 s after the last note's window), or at the file's end if
  that's sooner.
- **No piano** (laptop only): the band is off, and a `toast` once per take: "No piano connected: the backing track
  plays only on the DGX." Beat-track plays as it does today. No Web Audio fallback.
- **Not ready at songStart** (fetch failed, the file refused, still loading): off for this take, a toast with the
  reason, and beat-track as today.
- **Off switch:** `?backing=off`, as beat-track has `?beat=off`.

### Beat track
- `backing-track` exports `backingSpans(): [fromMs, toMs][]` on the chart clock: empty unless the band is playing.
  Plain play: `[0, endMs]`. A loop: one span per pass.
- `fix(beat-track)`: beat-track skips hits inside those spans. So its count-in still plays (side sticks before chart
  time 0), and so do a loop's one-bar gaps. The band's own drums take over from beat 0. If the band stops (crash,
  no piano), the spans empty and beat-track's beat comes back.

### Modes
- **wait-mode:** no band (`isWaitMode`). The clock holds at every note, so a band can't follow it.
- **bar-loop and tempo:** `seekMs` is bar `from`'s start on the original chart, `(from - 1) × beatsPerBar × 60000 /
  bpm`. The segment runs to bar `to`'s end, scaled by `100 / tempo`. Each pass replays it, with `passMs` =
  `passBeats` at the looped bpm. A note still sounding at the segment's end gets its note-off there, and notes begun
  before `seekMs` aren't played. `setup` is chased at `seekMs`.
- **hands=:** unaffected. hand-mode's notes are on channel 1, the band's never are.
- **Practice takes** (chunk-practice, weak-bars' loop link, the coach's drill) reach `/play` as bar-loop URLs, so they
  behave as bar-loop does. Nothing extra.

### Latency
Do the same as beat-track, which applies no offset to what it sends: sends sit exactly on the chart clock. The
calibration offset is subtracted from the player's presses in `/play`'s judge (`page.tsx`, `clock.now(e.timeMs) -
latency`), and calibration measures taps against clicks from the same piano. Shifting the band too would count it
twice.

### Songs
- **Local:** Flower Dance's charts in `web/public/songs/local/` (self-ignored) get `backing` on Eric's machine only:
  `flower-dance` and `flower-dance-var1`, with the spike's minus-piano EDM file copied beside them. Nothing is
  committed (decision 003). `flower-dance-var2` (115% speed) gets none: its timing isn't the file's.
- **Committed fixture:** Twinkle gets a tiny original backing, our own work. `make-twinkle-backing.mjs` writes it
  from Twinkle's committed chart, so no note comes from memory:
  - bass on channel 2 (GM program 33, Acoustic Bass): each bar's first chart note two octaves down, held for the bar;
  - drums on channel 10: kick on beats 1 and 3, snare (38) on 2 and 4, closed hi-hat (42) on every beat;
  - 480 PPQ, the chart's 100 BPM, bars 1–12.
  Rerunning the generator reproduces the committed file byte for byte.

## Validation
- `pnpm -C web exec vitest run src/game/backing-track`:
  - **Parse:** a format-1 file with a conductor track and two tempos lands each note at its ms. Running status and
    velocity-0 note-offs parse. SMPTE and a cut-short file are refused with a reason. The Twinkle fixture parses to
    exactly the generator's notes.
  - **Schedule, against a fake clock and a fake output:**
    - at t=0, the first event goes at `zero + 0`, after the setup;
    - at tempo 70%, a file event at 1,000 ms lands at 1,428.6 ms;
    - a loop from bar 5 at 100 BPM, 4/4: seek 9,600 ms. The file's event at 9,600 ms plays at chart 0, and again at
      `passMs` for pass 2. A program change at 2,000 ms is chased into the setup;
    - pause at 3,000 ms, 2 s paused, resume: the next event goes at the new `zero + atMs`, and nothing is sent twice.
  - **Channel 1:** a file with a channel-1 note and program change sends neither, and `channel1Notes` is 1.
  - **Every exit path silences:** `pause`, `quit`, `songEnd`, `pagehide`, a new `songStart`, a throw in `draw`, and
    500 ms without `draw` each send CC 123 and CC 64 = 0 on channels 2–16, and none on channel 1.
  - **Charts:** every chart under `web/public/songs/` with `backing` names a file that exists and parses (local ones
    included when present).
- `node web/src/game/backing-track/verify-backing.mjs --out <dir>`. The fake piano's output (`?midi=sim`) records
  what's sent, the pattern `hand-mode/verify-hands.mjs` uses. Chart zero is taken from beat-track's count-in side
  sticks:
  1. `/play?song=twinkle&midi=sim&input=test` -> GM On before Start, the setup before the first note, then every
     fixture event in order, each within ±20 ms of its chart time. No channel-1 note-on is sent at all (plain
     Twinkle has no hand-mode or voice), and no kick or hi-hat from beat-track inside the span.
  2. The same, quit mid-song through the pause menu -> CC 123 and CC 64 = 0 on channels 2 and 10 after the last
     note-on, and no note-on after them.
  3. `&from=5&to=6&tempo=70&passes=2` -> the first band note is the fixture's first in bar 5, spacing scaled by
     100/70 within ±20 ms, the segment twice, and beat-track's sticks or beat in the gap bar.
  4. Without `midi=sim` -> the toast shows, nothing errors, and the laptop beat plays.
  ci-browser's runner picks the file up by its name.
- **Band player, once by hand:** serve the worktree, open `?file=../../web/public/songs/twinkle/backing.mid` -> the
  parts list shows channels 2 and 10. With no piano, it says "No MIDI output named Portable Grand".
- `verify.py --slug backing-track` passes (plain play unchanged without `backing`).
- **On the DGX (Eric; mark it in the done note):** Flower Dance with the EDM backing, bars 58–90 as the spike prints
  them, in sync with the highway. The spike puts that span at chart beats 268–400, so `from` = 268 / beatsPerBar + 1
  and `to` = 400 / beatsPerBar. Also: nothing hangs after Esc → Quit, and the band never sounds in the player's
  voice.

## Gaps (accepted)
- No laptop fallback: the band is for the DGX. Laptop play keeps beat-track's clicks.
- Notes sustained across a pause are cut and not re-struck on resume.
- The band stops when `/play` ends the song, so a long final chord or outro is cut.
- "Replay on piano" and "Watch replay" play without the band.
- A chart with a tempo map can't say so (one `bpm`); Flower Dance lines up because both clocks are in seconds.

## Defaults
- The smaller option; log choices the spec doesn't make in `specs/decisions/backing-track-*.md`.
- Band volume is the file's (its CC 7). No mix setting until Eric asks for one after hearing it.
