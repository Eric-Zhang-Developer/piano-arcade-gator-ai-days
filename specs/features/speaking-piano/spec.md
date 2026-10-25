---
name: "The Speaking Piano spike: can the DGX say a short phrase a listener understands?"
depends_on: ["experiments", "piano-out", "laptop-sound", "duo-tokens", "beat-track"]
owns: ["specs/features/speaking-piano/", "changes/speaking-piano.md", "specs/decisions/speaking-piano-", "web/src/game/x/speaking-piano/", "web/src/app/speak/", "spikes/speaking-piano/"]
assignee: "eric"
---

# The Speaking Piano (spike)

Issue #1153, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's a tech spike under decision 004
(one question, code committed, content local, and it ends in FINDINGS), mounted as an experiment under #878.

**Lineage:** Peter Ablinger's speaking piano. FINDINGS.md cites a source for it (its URL), and quotes nothing from
memory.

## The question
Can the DGX say a short phrase so that a listener understands it, at least once a subtitle is shown after?
- **Yes:** Eric understands "Welcome to Étude" on the DGX with no subtitle, or understands it on hearing it again once
  the subtitle has been shown (Validation d). The STOI sweep (a) gives the best setting a score to report.
- **No:** Eric can't make it out even with the subtitle, at the best setting from the sweep.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state. With no DGX run yet, it says
  "listen pending".

Every bar here is the planner's, not a measured threshold.

## How it mounts
- **`/speak`** (`web/src/app/speak/page.tsx`, a client page over `web/src/game/x/speaking-piano/`), following the
  experiments pattern from #914 (the Conductor's `/conduct` is the same shape).
- **Registry entry** (`web/src/game/x/index.ts`, its one line, under the lane rule): group "Wow", line "The piano
  speaks a phrase (#1153)", href `/speak`. Its `plugin()` has no hooks, so `?x=speaking-piano` on `/play` does nothing.
  The Lab gallery reads the registry, so the Lab isn't edited.
- **Imported, never edited:**
  - piano-out's `allNotesOff`;
  - the "Portable Grand" output (laptop-sound's virtual one when no DGX is plugged in);
  - beat-track's lookahead pattern (`lookaheadMs`, re-implemented in the folder if it isn't exported);
  - the Duo kit.

## What to build
1. **Analysis** (`analysis.ts`, pure TypeScript):
   - **One code path:** the same file runs in the browser and offline. Offline, Node 24 runs it directly through its
     type stripping, so keep the file to erasable TypeScript.
   - **The pipeline:**
     - pre-emphasis, then an STFT;
     - 88 semitone bands, one per key's fundamental, for the DGX-660's 88 keys (A0–C8, MIDI 21–108);
     - formant weighting over about 300–2500 Hz;
     - noisy high-band energy (fricatives) mapped to soft clusters in the top octave.
   - **Each frame:**
     - strikes the top N keys above a floor;
     - takes velocity from dB;
     - re-strikes keys that continue, so the piano's decay doesn't drop the sound.
   - **Frame rate and N are swept parameters** (Validation a). The pick is logged in
     `specs/decisions/speaking-piano-params.md`.
2. **Playback:**
   - through the "Portable Grand" output on a lookahead scheduler (as beat-track's), with `MIDIOutput.send(data,
     timestamp)`;
   - **caps:** a hard velocity cap and a notes-per-frame cap, both shown on screen;
   - **silence:** All Notes Off (and pedal up) at the end, on Stop and on `pagehide`.
3. **Inputs:**
   - **(a) the mic:** hold "Speak" for up to 3 s, and playback starts on release. `getUserMedia` audio is asked for only
     on this page, on the first press.
   - **(b) presets,** rendered offline:
     - the phrases: "Hello, judges", "Welcome to Étude", "Thank you";
     - macOS `say -o <file>.aiff` (installed: `/usr/bin/say`, with `/usr/bin/afconvert` for WAV), then the analysis,
       then a frame table and a MIDI file;
     - **only the derived tables and MIDI are committed:** tables in `web/src/game/x/speaking-piano/presets/` for the
       page, MIDI in `spikes/speaking-piano/presets/`;
     - **never the TTS audio.** It stays in `spikes/speaking-piano/local/`, self-ignored (`*`, `!.gitignore`), per
       decision 004.
   - **Mic privacy:**
     - the audio is analyzed in memory only, never stored or sent, and dropped after playback;
     - **a test** shows no network request carries audio: a static check that the folder makes no `fetch`, XHR,
       WebSocket or beacon call, plus the network log on the page during a mic run on your dev server, with no
       request after the mic opens.
4. **On screen:**
   - the speech spectrogram morphs into the piano roll it became, aligned in time;
   - the keyboard lights as it plays;
   - **the subtitle appears only after playback;**
   - the Duo kit look;
   - **reduced motion:** two static panels, spectrogram and roll, with no morph.
5. **Booth safety:**
   - a visible volume cap (the velocity cap);
   - no autoplay: it plays only on a press of Speak or a preset.

## Validation
The bars are the planner's, not measured thresholds.

**(a) STOI of the resynthesis:**
- **What's scored:** STOI (Taal et al., 2011) of the resynthesized piano against the original TTS audio, for the 3
  presets.
- **The sweep:** frame rate 8, 12 and 16 per second × N = 6, 10 and 14. The full table and the pick go in FINDINGS.md.
- **The resynthesis:** sampled-piano (#806) is still open, so the default is a simple additive synth in the spike's
  script. Say which one was used.
- **STOI, hand-implemented:**
  - numpy isn't on this machine (checked: no system or Homebrew Python has it), and installing `pystoi` from PyPI is a
    download that needs Eric's yes;
  - so implement STOI from the paper in the spike's own Node script (`spikes/speaking-piano/stoi.mjs`), in the same
    language as the analysis;
  - **its self-test:** identical signals score about 1.0; the score falls as white noise is added (+10, 0 and −5 dB
    SNR give decreasing scores); a delayed copy beyond the paper's frame tolerance scores lower;
  - only if the hand version can't be validated, file a `needs-human` issue asking for `pystoi`, and report the sweep
    as unvalidated.

**(b) Timing and caps** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/speaking-piano`):
- the analysis on synthetic tones: a pure tone at a key's fundamental lights that key, and a noise burst in the high
  band gives a top-octave cluster;
- frame onsets: each frame's note-ons are scheduled at frame start ±2 ms, checked from the sent messages' timestamps
  (on `/sim`'s fake piano for the live log, as replay-view's check reads them);
- the caps: no velocity above the cap, and no frame with more than N notes;
- silence: All Notes Off is sent at the end, on Stop and on `pagehide`;
- the privacy check above.

**(c) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- score with taste v2 at 1280×720 and 1920×1080, plus reduced motion, from your own dev server in the in-app browser
  (one slot, `devserver.1` to `.4`);
- fix the top three problems a round, at most three rounds;
- scores and our shots go in the PR's Design section, and the shots in
  `specs/features/experiments/shots/speaking-piano/`.

**(d) The question, on the morning page, ranked high:** at the DGX, Eric plays "Welcome to Étude" with no subtitle.
Did he understand it? Then he plays it again with the subtitle shown after. Live DGX checks need Eric, so the worker
ships the tests and the sweep, and the done note says "not verified live" until he runs it.

**Eric's URLs:** Lab → The Speaking Piano, or `localhost:3001/speak`.

## FINDINGS.md (`spikes/speaking-piano/FINDINGS.md`)
Per decision 004:
- the question;
- the measured answer: the STOI table and the pick, and Eric's answer when he has given it;
- the Ablinger source, cited;
- what worked, what didn't, what to keep;
- **promote**, **iterate** or **kill**.

## Disk and content
- About 4.4 GiB is free. Keep spike audio short and few (three presets and a few sweep renders), local only, in
  `spikes/speaking-piano/local/`.
- **Nothing is deleted by the worker** (Eric's no-delete rule). Any cleanup is Eric's.
- No mic recording is ever written to disk.

## Gaps (accepted)
- STOI scores intelligibility against the TTS original, not a listener. Eric's run is the real answer.
- One voice (macOS `say`'s default); no voice sweep.
- The mic path is capped at 3 s, with no editing.

## Defaults
- **In the `spikes` milestone,** after wet-paint.
- Log any choice this spec doesn't make in `specs/decisions/speaking-piano-*.md`: the floor, the dB-to-velocity map,
  the cluster rule and the caps.
- The smaller option; no new dependency; no downloads.
