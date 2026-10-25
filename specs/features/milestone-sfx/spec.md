---
name: "Milestone SFX: Chunithm-level sound on combo steps, fever, full combo, clear, rank and new record, never per hit"
depends_on: ["juice-sound", "audio-track", "rank-stamp", "clear-card", "record-moment", "fever-moment"]
owns: ["specs/features/milestone-sfx/", "changes/milestone-sfx.md", "specs/decisions/milestone-sfx-", "web/src/game/milestone-sfx/"]
assignee: "eric"
---

# Milestone SFX

Issue #877. Eric, 2026-10-25: "it's like sound effects, proper, adding a lot of juice in terms of the gameplay
aspect. I really like Chunithm. like the amount of juice there is." Then: "It wouldn't be on every hit. No, it would
be on milestones, like full combo."

**The ask:** arcade-grade sound **only on milestones**: combo steps, fever start, FULL COMBO / ALL PERFECT, clear,
the rank stamp and NEW RECORD. **Never on every hit:** the DGX is the instrument (decision 001, row 8).

**Today** (`changes/juice-sound.md`): `web/src/game/sound/index.ts` synthesizes a stinger on each `comboMilestone`, a
sweep on `feverStart`, a drumroll from `songEnd` and a rank hit when the stamp lands, a fanfare on a full combo, and an
optional miss cue. Each is a few oscillators. This pass makes them layered and mixed to sit under a live piano, with a
variant or two per moment.

## Plan
**One PR: `feat(milestone-sfx)`.** The new voices and the mix live in `web/src/game/milestone-sfx/`. It hooks into
juice-sound's scheduler (`web/src/game/sound/`), which is done and in this lane, so ownership is open
(AGENTS.md). It keeps one place that schedules sounds; there's no second plugin racing it.

## Requirements
- **Moments only:** `comboMilestone`, `feverStart`, `fullCombo`, the clear and ALL PERFECT (from clear-card's
  outcome), the rank stamp (`stampImpactMs()`), and NEW RECORD (where record-moment reveals it).
  - No sound is tied to `noteHit`.
  - The miss cue stays juice-sound's, unchanged, behind its own setting.
  - If a moment has no event or hook to schedule from, the worker reads its plugin for one. It changes no frozen
    contract: if a `GameEvent` is needed, file a `contract-change` issue and ship the rest.
- **Sources:** synthesized in code with plain Web Audio, or files that are ours or openly licensed. Files go in
  `web/public/sounds/` with their license in `web/public/sounds/LICENSES.md` and a credit per
  `specs/decisions/003-sources-and-licenses.md`. No ripped game audio, and **no new dependency**.
- **Settings are respected:** Mute (`pianoArcade.sfxMuted`), the effects volume (`pianoArcade.sfxVolume`) and the miss
  cue (`pianoArcade.sfxMissCue`) apply to every new sound. Wait mode stays as juice-sound has it: no end-of-song
  sounds.
- **Mixed under the piano:** scheduled on the audio clock from `GameEvent.atMs`, as juice-sound does today.
- **Never under a recording's loud parts.** When audio-track is playing a song's recording (`web/src/game/audio-track/`,
  a decoded `AudioBufferSourceNode`), a milestone sound doesn't land on a loud stretch of it. The worker measures
  the recordings' loudness to set what "loud" means, and logs the threshold and what a blocked sound does (waits,
  softens or is skipped) in `specs/decisions/milestone-sfx-*.md`.
- **Variants:** a variant or two per moment may be offered in the Lab as experiments under
  `specs/features/experiments/spec.md`. The default set ships here.
- **A visual beat:** each moment's sound lines up with the visual already there (fever-moment's flash, clear-card,
  rank-stamp, record-moment). Retime the sound, not the visual.
- **No invented data.** Levels, durations and the loudness threshold are measured or logged as choices. The NOSTALGIA
  findings (`specs/context/nostalgia-stage-findings.md`, from stage-view) are a reference if they've landed. They
  aren't a dependency.

## Design
Mostly sound. Where the work is visible (a setting's row, a Lab entry), it gets AGENTS.md's design pass: invoke
`frontend-design` before writing the UI and `design-taste-frontend` for the look loop. The PR body has a Design
section. With nothing visible, the PR says so.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/milestone-sfx src/game/sound`:
   - **never per hit:** a scripted take of hundreds of `noteHit` events plus its milestones schedules sounds only at
     the milestones;
   - Mute gives zero gain, and the miss-cue setting still gates the miss cue;
   - wait mode schedules no end-of-song sounds;
   - the loudness rule: on a scripted envelope, a moment on a loud stretch is handled as logged, and one on a quiet
     stretch plays on time;
   - juice-sound's existing tests stay green.
2. Existing checks are covered by main's scheduled full run, not run locally. The done note says "not verified
   locally; covered by main's scheduled full run".
3. The design pass, where there's something to see.
4. **Eric listens once** on the piano, with and without a recording. Mark that in the done note (`not heard by Eric`
   until he does).

## Defaults
- In `extras`, after stage-view.
- Log any choice this spec doesn't make in `specs/decisions/milestone-sfx-*.md`.
