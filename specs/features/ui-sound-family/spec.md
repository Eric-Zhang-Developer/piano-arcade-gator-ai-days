---
name: "UI sound family: the menu sounds as one soft celesta family in the song's key, measured under the music"
depends_on: ["ui-sounds", "juice-sound", "song-preview", "beat-track", "select-layout", "stage-card", "pause-skin", "experiments"]
owns: ["specs/features/ui-sound-family/", "changes/ui-sound-family.md", "specs/decisions/ui-sound-family-", "web/src/game/x/ui-sounds-ab/"]
assignee: "eric"
---

# UI sound family

Issue #1167. It's a polish item in #856's terms: one deep pass on one thing, the sound of the menus. It's a normal
game-lane change, and its only flag is the Lab A/B.

**Why a new spec, not a revision of ui-sounds':** ui-sounds is done (`changes/ui-sounds.md`), and its spec is the
record of what shipped (#266). This pass has its own Validation and its own done note, and it reaches
`web/src/game/ui-sounds/` through the lane rule. ui-sounds is in this lane (`assignee: "eric"`).

**Today (origin/main, `ui-sounds/index.ts`):**
- move: one triangle blip, 30 ms;
- confirm and back: two triangle notes rising or falling, a fifth apart;
- sting: a square-wave rising arpeggio, about 0.8 s (line 75);
- tick and tickAccent: sines at beat-track's click pitches (`clickHz` 1320, `clickAccentHz` 1760, `clickLengthS`
  0.03);
- every node peaks at `UI_PEAK`, song-preview's laptop-tone peak (`toneVolume` 0.08 × velocity 80 / 127, about 0.05):
  level with the preview, not under it.

**The model:** product UI sound design. One family that's short (under 150 ms), soft-attacked and low-mid, isn't
fatiguing after 20 presses, and is musically related to the product.

## The pass
1. **One timbre** (`timbre.ts`, pure):
   - `render(sound, opts): Float32Array` returns mono samples at a given sample rate;
   - a synthesized celesta or music box: additive synthesis with slightly inharmonic partials, an exponential decay,
     and a 1–2 ms hammer-noise transient shaped inside the attack, so it never clicks;
   - **live,** each sound is an `AudioBuffer` (filled from `render`) played through ui-sounds' own context and gain;
   - **in node unit tests,** the measurements read the same arrays directly;
   - no samples and no dependency. sampled-piano's Salamander (#806, waiting on #966) can replace the timbre later.
2. **Mapping:**
   - **move:** the next scale degree of the focused song's key. With no key, C major;
   - **confirm:** a struck perfect fifth;
   - **back:** the falling fifth;
   - **sting:** a 3-note figure in the song's key, replacing the square arpeggio;
   - **tick and tickAccent:** a soft woodblock, at beat-track's click pitches (1320 and 1760 Hz, a fourth apart, so
     the accent is more than a semitone higher), so the countdown matches the count-in.
3. **The song's key:**
   - charts carry no key (the frozen format has none), so a pure `keyOf(pitches)` infers it by correlation with the
     Krumhansl–Kessler key profiles;
   - copy the profile values from a cited source into `specs/decisions/ui-sound-family-key.md`, never from memory;
   - the callers pass it: select-layout from the focused row's roll pitches, the stage card from its chart;
   - the key is an optional argument (`uiSound(name, delayMs, { key })`), so a caller without one gets C major.
4. **Pile-up:**
   - at 20 moves a second, at most one new voice per ~60 ms: a sound within 60 ms of the last steals the oldest
     voice, which fades out over a few ms, not cut;
   - a small voice cap, logged;
   - velocity eases down slightly on fast repeats and recovers after a pause.
5. **The mix:**
   - each sound sits **12 dB or more under the song preview's level, measured, not assumed** (Validation a);
   - it follows the effects volume and mute (`getPrefs`, `subscribePrefs`), as today;
   - it never plays before the page's first trusted press, as today (`pressed`, `ui-sounds/index.ts`);
   - **effects off** (mute) still silences everything, scheduled sounds included.

## Files, and who holds them
Check again before each edit: `gh pr list`, then each open PR's files. When this spec was written:
- **`web/src/game/ui-sounds/`:** no open PR. The timbre, the mapping, the key argument and the pile-up go here.
- **The callers,** which only pass a key: `select-layout/index.tsx` (lines 107, 115, 126, 153), `stage-card/index.tsx`
  (line 19) and `pause-skin/index.tsx` (no key needed). All three are in #600 (abbasi2010), which the planner reads
  as stale, so it doesn't block. Keep the diffs to the call sites.
- **`song-preview/opening.ts`:** read only, for the level reference. It's in #600's file list too.
- **`sound/index.ts`:** in #600 (stale). ui-sounds already imports its `getPrefs`, `subscribePrefs` and `tone`.
  This pass needs no edit there.

## The Lab A/B
- `?x=ui-sounds-ab` is an experiment (#878) in `web/src/game/x/ui-sounds-ab/`, with its one registry line under the
  lane rule.
- Its start panel on `/play` has old-vs-new buttons for each sound, plus a "20 moves" button for fatigue.
- **The old sounds** are kept in the experiment folder as `legacy.ts`, a copy of today's `uiSound` switch, so the
  comparison survives the replacement. Pruning the experiment deletes it.
- Registry entry: group "Polish", line "The menu sounds, old against new (#1167)", href
  `/play?song=twinkle&x=ui-sounds-ab`.
- That's the A/B, so no toggle goes on the select. With nothing new to see on the select, no visual pass is needed
  there. The A/B panel itself gets the normal design pass.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Rendered measurements per sound, before and after, pinned by unit tests**
(`pnpm -C web exec vitest run --passWithNoTests src/game/ui-sounds src/game/x/ui-sounds-ab`):
- duration ≤ 150 ms (the sting ≤ 600 ms);
- peak and RMS each 12 dB or more under the preview's. The reference is song-preview's opening notes at their
  velocities, rendered the way they play on the laptop (laptop-sound's synth, or song-preview's laptop tone at
  `toneVolume`), measured the same way;
- spectral centroid between 500 Hz and 3 kHz;
- attack (10–90% of the envelope's rise) of 2 ms or more;
- no DC offset (mean ≈ 0);
- the tail ends at a zero crossing (the last sample is 0);
- `keyOf` finds C major in a C scale and A minor in an A harmonic-minor scale, and its result drives move's degree.

The "before" values come from rendering today's oscillator sounds in the same harness (a small offline model of
`tone`), so before and after are measured alike. Both tables go in the PR.

**(b) Pile-up:** 40 moves in 2 s never exceed the voice cap and never clip (peak of the summed output ≤ the level
cap), and the velocity eases and recovers.

**(c) The "shots":**
- offline waveform and spectrogram images of each sound, old against new, rendered from the same arrays, in
  `specs/features/ui-sound-family/shots/`;
- **the Design section** says sound measurements replace the visual taste v2 score here, because the select and stage
  card don't change. The Lab A/B panel gets the normal visual pass (`frontend-design`, then `design-taste-frontend`,
  at 1280×720 and 1920×1080, plus reduced motion).

**(d) The A/B on the morning page** (low rank): a 1-minute listen.

**The browser check:** `verify-ui-sounds.mjs` keeps its checks (nothing on load, one move per ↓, none at the end,
confirm and sting on Enter, none muted, none on a direct `/play` load). Update its spy from `OscillatorNode.start` to
`AudioBufferSourceNode.start`, and say why in the PR. Per AGENTS.md it doesn't run locally: the done note says
"not verified locally; covered by main's scheduled full run".

**Eric:** at `localhost:3001`, arrow through the select, press Enter on a song, and press Esc mid-take for the
countdown. The Lab A/B compares old and new. The done note says `not heard by Eric` until he does.

## Gaps (accepted)
- A synthesized celesta, not a sampled one: #806 can swap the timbre later.
- The key is inferred from the notes, not read from the score.
- On `/play` with the DGX, the UI sounds still come from the laptop.

## Defaults
- **In `extras`,** after build-sonata.
- Log any choice this spec doesn't make in `specs/decisions/ui-sound-family-*.md`: the partials, the decay, the
  figure for the sting, the voice cap and the velocity easing.
- The smaller option; no new dependency; no sample files.
