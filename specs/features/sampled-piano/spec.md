---
name: "Sampled piano: the laptop voice plays real piano samples, not an oscillator"
depends_on: ["laptop-sound"]
owns: ["specs/features/sampled-piano/", "changes/sampled-piano.md", "specs/decisions/sampled-piano-", "web/public/samples/piano/", "web/src/game/sampled-piano/"]
assignee: "eric"
---

# Sampled piano

Issue #798. Eric, 2026-10-25: "is there any way to make the laptop's synth like this? ... improve that with an actual
like piano keys?", then "do it". laptop-sound's virtual "Portable Grand" plays a two-oscillator voice
(`web/src/game/laptop-sound/synth.ts`, `strike()`). laptop-sound deferred samples to their own issue; this is it.
A judge without a DGX hears this voice first, so it should sound like a piano.

## Plan
One `feat(sampled-piano)` PR. Under "Ownership is open within a lane" (AGENTS.md) it may change
`web/src/game/laptop-sound/`, as long as no open PR is working on those files (check with `gh pr list` first).
`check_ownership.py` lets only `feat(song-pack-<n>)` append to `CREDITS.md`, so the credit line goes in its own
`docs:` PR, merged before or with this one. No sample is committed without its credit.

## Requirements
**The voice**
- `strike()` in `laptop-sound/synth.ts` plays a decoded piano sample (an `AudioBufferSourceNode` through a gain)
  instead of the oscillators, once the samples are loaded.
- Each pitch plays the nearest sample, pitch-shifted with `playbackRate` (`2 ** ((pitch - samplePitch) / 12)`).
  Velocity picks the layer (if there are two) and sets the gain.
- Release: a note-off (or the pedal lifting) fades the sample out over about `releaseS`, as today, then stops it.
  A note left ringing ends when its sample does.
- Unchanged: the voice bookkeeping, the pedal (CC64), All Notes Off (CC123), the 32-voice cap stealing the oldest,
  a re-struck key starting over, program changes ignored, the piano volume, and the channel-10 drums (still
  synthesized).
- Everything that plays through the virtual "Portable Grand" gets the new voice with no other change: laptop keys
  on `/play`, song preview, the bot demo (watch-demo), and Golden in laptop mode. No other feature's file changes.

**The source**
- The Salamander Grand Piano (Yamaha C5, by Alexander Holm), believed CC BY 3.0, unconfirmed.
- Before committing any sample, the worker confirms the license from the source itself (its own download page or
  readme), and logs the source URL, the license text it found and the version in
  `specs/decisions/sampled-piano-source.md`, per decision 003. `CREDITS.md` gets a line (see Plan).
- Notes come from the samples. Nothing is synthesized to imitate a missing sample; a gap is filled by pitch-shifting
  a real one.
- If the license doesn't hold (or can't be confirmed from the source), file a `needs-human` issue and take another
  openly licensed grand, with the same checks.

**The subset**
- One sample every few semitones across A0–C8, pitch-shifted in between, with one or two velocity layers.
- A few MB in total, as compressed audio every target browser decodes (the worker picks the format and logs it).
- The worker picks the spacing, the layers and the format, logs them in `specs/decisions/sampled-piano-subset.md`,
  and reports the exact committed size (`du -ch web/public/samples/piano/`) in the PR.
- Files live in `web/public/samples/piano/`, with a small manifest (sample pitch, layer, file) that the loader reads.

**Loading**
- No new dependency: plain `fetch` and `decodeAudioData`, no Tone.js. `web/package.json` is frozen.
- Loading starts when the `AudioContext` first exists. Nothing waits on it: the existing synth voice plays until
  every sample has decoded, then new notes are sampled. Notes already sounding finish as they started.
- If any fetch or decode fails, the synth voice stays on for the page's life, with one `console.warn`. Nothing throws.
- The test hook `window.__pianoArcadeLaptop` gains `sampled: boolean` (true once the samples are in use).

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/laptop-sound src/game/sampled-piano`, against a fake
   `AudioContext` (the existing tests stay green):
   - before load: notes use the synth voice, and `sampled` is false;
   - after a fake decode succeeds: notes start a buffer source with the nearest sample and the right `playbackRate`;
   - after a fake decode fails: notes stay on the synth voice, and nothing throws;
   - the 32-voice cap still steals the oldest, and All Notes Off still ends every voice, with samples loaded;
   - channel 10's 36/38/37/42 still drum, and other channel-10 notes are still silent.
2. The existing browser checks that touch laptop sound (`verify-laptop.mjs` and the song-preview, watch-demo and
   options-panel checks) stay green. Covered by main's scheduled full run; no local verify. The done note says "not
   verified locally; covered by main's scheduled full run".
3. A sound change, so no screenshots: the PR has a short before/after audio clip or waveform image of the same few
   notes, synth versus sampled.
4. Eric plays it by ear on his laptop, piano unplugged. Marked in the done note (not done until he does).

## Defaults
- Format, spacing, layers and the source's exact version: the worker's call, logged in
  `specs/decisions/sampled-piano-*.md`.
- No sustain-pedal resonance, release samples or key noise in v1.
- Any other choice this spec doesn't make: the smaller, reversible option, logged in `specs/decisions/sampled-piano-*.md`.
