---
name: "Hero replay: a downloaded take file drives /play, judged and sounding, the same every run"
depends_on: ["take-midi", "scenes", "piano-out", "notice-toast"]
owns: ["web/src/game/hero-replay/", "web/public/takes/"]
assignee: "eric"
---

# Hero replay

For the video: Eric plays his best Für Elise once on the DGX, then re-shoots it as often as needed without playing
it live again. The whole of `/play` reacts as it did live: the highway, judgments, HUD, juice and results, with the
piano sounding. Watch replay (replay-view) is different. It replays a take you just played, on an overlay, after the
results. This drives the real `/play` from a file.

Issue: #374

## Plan
It's built on what exists. The take file is the `.mid` that take-midi's Download MIDI saves. The player is scenes'
bot scheduler, which already plays scripted presses at chart times, handles pause and resume, and sends to the
"Portable Grand" with `audible=1`. Records already skip any `bot`.
1. **`fix(take-midi)`:** `takeToMidi` writes a Marker meta event (`FF 06`, text `bar 1`) at chart time 0's tick, so
   a whole-bar shift for count-in presses can be undone. Add `readTakeMidi(bytes, chart)` next to the writer, as its
   inverse: it returns `TakeEvent[]` (pitch, velocity, `timeMs`, `offTimeMs` on the chart clock), or the reason it
   refuses.
2. **`fix(scenes)`:** a bot named `take`. `?bot=take&take=<file>` fetches `/takes/<file>` in the bot device's async
   `start()` and plays its presses with their own velocities and holds (`Press` gains an optional `velocity`). While
   it runs, `wrapInput` also swaps any MIDI input for a silent device. A touched key, or a DGX echo of the
   `audible=1` notes, can't change the replay.
3. **`feat(hero-replay)`:** `web/src/game/hero-replay/verify-hero.mjs`, `web/public/takes/` for Eric's files, and the
   done note.

## Requirements
- **Reading:** ticks become beats at 480 PPQ, then ms at the open chart's `bpm`. The marker's tick is chart time 0.
  Without a marker (a file saved before step 1), tick 0 is chart time 0, and a toast says so.
- **Refused, then a toast and a normal take** (notice-toast's `toast()`, as scenes' unknown-bot notice is): the file
  can't be fetched or parsed, its track name isn't the chart's `title`, or its tempo isn't the chart's `bpm` (a take
  from `tempo=70` stays a 70% take). `take` must match `^[\w.-]+\.mid$`. Any other value is refused, and nothing
  outside `/takes/` is fetched.
- **Deterministic:** each press is emitted with its file time as `timeMs`, as the bots do, so the judge sees the same
  offsets every run. That's within half a tick of the live take: 0.95 ms at Für Elise's 66 BPM. The results match
  the original take's, except a note that sat within half a tick of a window edge.
- **Sound:** with `audible=1`, every press and release goes to the Portable Grand at its own velocity. Without a
  piano the replay runs silent, as scenes' bots do.
- **Not a record,** like every bot (`practiceReason`). Pause and resume behave as in scenes.

## Validation
- `pnpm -C web test`: `readTakeMidi(takeToMidi(chart, take), chart)` returns every press's pitch and velocity
  exactly, and `timeMs` and `offTimeMs` within half a tick. A take with a press at −300 ms comes back at −300 ms
  (marker at bar 2). A file without a marker reads tick 0 as 0. A wrong title, a wrong tempo and truncated bytes
  are each refused with a reason. scenes' existing tests pass.
- Headless, from a clone: `node web/src/game/hero-replay/verify-hero.mjs --out <dir>` starts its own dev server and
  prints `verify-hero: pass` (exit 0), or names each failure (exit 1):
  1. `/play?song=twinkle&bot=rank-c&midi=sim` -> results. Click `download-midi` and keep the bytes and the results.
  2. Route `/takes/verify.mid` to those bytes (`page.route`, so nothing is written into `web/public/`), then open
     `/play?song=twinkle&bot=take&take=verify.mid&midi=sim&audible=1`. The counts, accuracy, max combo and each note's
     judgment must equal step 1's. The sim's fake piano must have received one note-on per press, at the file's
     velocities.
  3. Run step 2 again: same judgments, and a screenshot at the same chart time (1920×1080) in each run.
  4. `take=../x.mid` and a file with another song's title each show a `toast` and play normally.
- `verify.py --slug hero-replay` passes. `node web/src/game/replay-view/verify-replay.mjs --out <dir>` still passes.
- On the piano (Eric; mark it in the done note): play Für Elise, Download MIDI, and put the file in
  `web/public/takes/`. Open `/play?song=fur-elise&bot=take&take=<file>&audible=1&capture=1` twice. The DGX plays your
  take, the results equal your live results, and no note hangs.

## Defaults
- Eric's own take files are his performances, so they may be committed under `web/public/takes/`. An agent commits
  one only when Eric hands it over.
- No file picker and no Start-free autoplay: the URL drives it, like every other mode, and Start starts it. Add an
  `autostart` only if the shoot needs one (cabinet's `AutoStart` is the pattern).
- **No NEW RECORD on a replay:** a `bot=take` take is a bot, so records (and record-moment's stamp) skip it. The
  video's NEW RECORD shot comes from a live take; a replay never writes a record it didn't earn live.
- No laptop tones for the replay: the video's sound is the DGX. Log any other choice in
  `specs/decisions/hero-replay-*.md`.
