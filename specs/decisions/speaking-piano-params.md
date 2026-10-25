# speaking-piano: the frame rate, keys a frame, the floor, the velocity map, the cluster and the caps

**Context.** The spec sweeps frame rate × keys a frame and leaves the rest to the worker. eric-agent-3, 2026-10-25.
All of these values are in `analysisDefaults` (`web/src/game/x/speaking-piano/analysis.ts`).

- **12 frames a second × 14 keys:** the sweep's best mean STOI (0.601; the table is in
  `spikes/speaking-piano/FINDINGS.md`). 16 × 14 scored 0.597 at a third more notes a second. **Undo:**
  `node spikes/speaking-piano/render.mjs --pick 16x14`.
- **Floor:** 40 dB under the phrase's loudest band. Lower than that, the frame filled with near-silent keys.
- **Velocity:** linear in dB, from 24 at the floor to the cap at the peak.
- **Caps:** velocity at most 100, and n = 14 notes a frame. Both are enforced in the analysis and again in playback,
  and both are shown on the page. 100, not 127, because a phrase strikes up to 168 keys a second and the DGX is in a
  booth.
- **Fricatives:** a frame whose 4–8 kHz energy is ≥ 35% of its total gets C7, E7 and G♯7 at half the frame's
  velocity, as a soft hiss for "s", "h" and "t". It takes 3 of the 14.
- **Re-strike:** every frame strikes its keys again, with the note-off 2 ms before the next note-on, so a held vowel
  keeps sounding through the piano's decay.
- **Undo:** each value is one field in `analysisDefaults`. Re-render the presets after changing one.
