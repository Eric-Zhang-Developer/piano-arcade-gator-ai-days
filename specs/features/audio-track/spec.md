---
name: "Audio track: a song's own recording plays in sync under /play (local songs)"
depends_on: ["core-loop", "options-panel", "bar-loop"]
owns: ["specs/features/audio-track/", "changes/audio-track.md", "web/src/game/audio-track/", "specs/decisions/audio-track-"]
assignee: "eric"
---

# Audio track

Issue #675. Eric, 2026-10-25: "Let's go for it." Play "Golden" (KPop Demon Hunters, HUNTRX) over the song's real
recording, the way Chunithm plays the original track under its charts, with the player's piano as the lead on top.

**The song is a local spike.** Its charts, its MP3 and the spike notes stay gitignored. The brief is
`video-references/golden-sheet/BRIEF.md` in Eric's main checkout. This spec covers only the game code, which is
committable (decision 004).

**Decision 003, amended by Eric for local play only:** "the original recording never plays in the game" is lifted
for local play ("we're breaking that decision for 'it's local only'"). A recording may play in the game on Eric's
machine. Nothing with a recording is committed, deployed or shared. **Footage with the recording in the video is not
decided: the default is no.**

## What exists (origin/main, 2026-10-25)
- **Local songs** live in `web/public/songs/local/<id>/chart.json`, a folder whose own `.gitignore` is `*` then
  `!.gitignore`. `/play?song=local/<id>` plays them, and the select lists them.
- **A chart has one `bpm` and one `beatsPerBar`** (`web/src/contracts/index.ts`). There's no tempo map. The
  backing-track work (#500) is MIDI only. Nothing plays an audio file in sync today.
- **The chart clock** is built in `app/play/page.tsx` (core-loop) with `toPerf`, and pause and resume go through
  play-slots' `pauseClock`.

## Plan
1. **`feat(audio-track)`, part 1:** `web/src/game/audio-track/`, a plugin that loads the song's sidecar, decodes the
   file with Web Audio, and schedules it against the chart clock. Its pure timing helpers get unit tests.
2. **`fix(options-panel)`:** a "Recording volume" row, shown only when the song has a recording.
3. **`feat(audio-track)`, part 2:** `verify-audio.mjs` against a short generated test tone (committed, our own work),
   then the done note.

## Requirements
- **Where the recording comes from:** a sidecar next to the chart, `audio.json`:
  `{ "src": "golden.mp3", "offsetMs": 1234 }`. `src` resolves relative to the song's folder, and `offsetMs` is the
  time in the file of chart time 0 (the first downbeat). No sidecar, no audio. Nothing changes for any other song,
  and the chart contract is untouched. `?audio=off` mutes it for a take.
- **Sync:**
  - The recording starts so that file time `offsetMs` sounds exactly at chart time 0. Schedule it with an
    `AudioBufferSourceNode` on the `AudioContext` clock, mapped from `clock.toPerf(0)`, and correct for
    `outputLatency` where the browser reports it.
  - A count-in before chart time 0 plays the file's own lead-in, or silence if `offsetMs` is shorter.
- **Pause and quit:** pause stops it, and resume restarts it at the chart's current time. Quit, retry and leaving
  /play stop it at once. Nothing sounds after the take ends, besides a short fade-out.
- **Practice:**
  - **With `from` and `to` (bar loop):** it plays from the window's start time in the recording, and each loop pass
    restarts there.
  - **With `tempo` other than 100, wait mode or flow mode:** no recording, since the record can't bend. Log why.
- **Volume:**
  - its own `GainNode`, set from `pianoArcade.recordingVolume` (0–100%, 70% by default) through the options row;
  - **independent of the effects mute and the piano volume.**
- **Test hook:** `window.__pianoArcadeAudio = { loaded, playing, fileTimeAt(chartMs) }`.

## For the Golden spike (not this feature's code)
- **The chart contract has one tempo,** but Golden goes 90 (3/4) → 123 (4/4) → 90 (3/4).
- **The spike's default:** encode the notes in beats at the body's tempo, converting the 3/4 sections' beats so every
  note's *time* is exact. The cost is that bar lines and numbers are off in the intro and outro. That's visual only, and
  logged in the spike's findings.
- **A real tempo map is a later `contract:` PR,** if Eric wants one. Its blast radius is the judge, the highway and
  bar-lines.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/audio-track`:
   - `fileTimeAt(chartMs) = offsetMs + chartMs`;
   - a resume after a pause restarts at the right file time;
   - a bar-loop window maps to the right start;
   - no recording plays with `tempo≠100`, wait mode or flow mode.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug audio-track --worktree . --cmd "node {worktree}/web/src/game/audio-track/verify-audio.mjs --out {out}"`.
   It runs on a committed test song with a generated click-track WAV and a sidecar, and prints `verify-audio: pass` or
   names each failed step:
   1. `__pianoArcadeAudio.playing` turns true at chart time 0. The recording's position tracks `fileTimeAt` within
      20 ms, sampled every second for 20 s.
   2. Pause, then resume: the position is still within 20 ms.
   3. Quit: `playing` is false at once.
3. **On Eric's machine** (the Golden spike, Eric): the measured drift across the full song goes in the findings, and
   the done note marks whether it feels locked.

## Defaults
- **Ahead of the restyle's later screens,** after duo-hud. Spikes are cut at Sunday noon (2026-10-25 12:00 ET), and
  so is this.
- Log any choice this spec doesn't make in `specs/decisions/audio-track-*.md`.
