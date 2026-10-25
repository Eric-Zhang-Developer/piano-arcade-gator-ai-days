# Milestone SFX: the sound-juice pass, its moments and the mix under the DGX (#1396)

**Context.** Eric, 2026-10-25: sound juice "in more places", from the NOSTALGIA and Chunithm reports. Still never on
every note: the piano is the hit sound.

**Choice.**
- **FULL COMBO / ALL PERFECT** on the clear card follow NOSTALGIA's measured sequence (`nostalgia-stage-findings.md`,
  Audio): a click, music-box tones at +0.16, 0.66, 1.13, 1.58 and 2.13 s (F6, A6, G6, C7, A6: 1.4–2.1 kHz), a 7 Hz
  tremolo chord from +2.78 s for 1.17 s, and the wipe's transient at +4.05 s. NOSTALGIA's music drops to near-silence
  under it, so on a full combo the drumroll and the old fanfare are gone; the rank hit stays.
- **New moments:** a whoosh on Start (`songStart`), a deflate when a miss or wrong note ends a combo of 20 or more
  (instead of the miss cue; the miss-cue setting turns it off), a deeper sub under the rank hit's thud, and a low
  settle chord 600 ms after the rank hit.
- **Mix:** every effect goes through one bus at 0.7 (−3.1 dB) and a compressor (−20 dB threshold, 12 dB knee, 4:1,
  3 ms attack, 250 ms release), so stacked layers never spike over a live DGX. Per-voice levels stay in
  `voiceSettings.levels`: start 0.12, comboBreak 0.10, settle 0.08, the rest unchanged.

**Not done.** The count-in already clicks (beat-track's side-stick, on the count-in's beats), so there's no second
tick. There's no mascot tutor on main yet, so it has no pop. Nobody has listened on the DGX.

**How to undo.** The numbers live in `soundSettings`, `mixSettings` and `voiceSettings`; revert the PR to restore the
old fanfare and drumroll.
