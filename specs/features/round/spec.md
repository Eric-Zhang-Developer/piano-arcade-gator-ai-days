---
name: "The Round: play Frère Jacques once and the DGX plays your own take back as voices 2, 3 and 4"
depends_on: ["experiments", "core-loop", "piano-out", "piano-voice", "hand-mode", "song-pack-1", "laptop-sound", "duo-tokens"]
owns: ["specs/features/round/", "changes/round.md", "specs/decisions/round-", "web/src/game/x/round/", "web/public/songs/rounds/"]
assignee: "eric"
---

# The Round

Issue #1123, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**The pitch:** you play Frère Jacques once, and the DGX plays your own take back as voices 2, 3 and 4 at the round's
entry interval. Each echo voice has its own MIDI channel and General MIDI program (strings, then flute or vibes, then
choir aahs, picked by ear and logged). Only voice 1, you, is judged.

## How it mounts (the experiment contract, #878)
- **Its folder:** `web/src/game/x/round/`, plus its one line in the registry (`web/src/game/x/index.ts`), under the
  lane rule.
- **Registry entry:** group "Wow", line "Play a round once and the DGX sings it back as voices 2–4 (#1123)", href
  `/play?song=rounds/frere-jacques&x=round`. That id is the planner's guess at the folder; use whatever id the chart
  gets.
- **On `/play`, with `?x=round` only,** through the frame's hooks:
  - `wrapInput` sees each press and filters echoes;
  - `onEvent` gives the clock's zero (`songStart`) and the stops;
  - `draw` paints the voices;
  - `resultsPanel` gives the card.

  With the flag off, none of its code runs.
- **Imported, never edited:**
  - piano-voice's `programChange`;
  - hand-mode's `echoGuard`;
  - piano-out's `allNotesOff`;
  - beat-track's lookahead pattern (`lookaheadMs`, re-implemented in the folder if it isn't exported);
  - laptop-sound's "Portable Grand";
  - the Duo kit.

## The charts
- **Frère Jacques** and **Row, Row, Row Your Boat**, plus a third round if a source decision 003 allows fits.
- **The route:** this spec owns `web/public/songs/rounds/`, the song-pack path (song-pack-5 and -6 own their chart
  folders the same way). Each chart follows song-pack-1's Sources and What to chart:
  - a cited notation source decision 003 lets us commit (public domain, CC0, CC BY, CC BY-SA), with its URL, license
    and edition in `source`;
  - the notes as printed, never from memory;
  - the note count checked against the score;
  - song-pack-1's converter where the source is MIDI or MusicXML;
  - song-pack-1's library test covers them, with no new test code.
- **They're normal charts.** Song select lists every chart under `web/public/songs/` at any depth, so these show
  there too, playable without the round, like any song request.
- **The entry interval** lives in the experiment's own config (`roundSettings.entries: { [chartId]: { everyBars,
  voices } }`), never in the frozen chart format. It comes from the source's own entry marks (a round's score marks
  where voice 2 comes in), cited in `specs/decisions/round-entries.md`, not from memory. The pitch's "two bars for
  Frère Jacques" is checked against the source.
- **Credits:** a CC-licensed source is credited in `CREDITS.md` through a separate `docs:` PR (the credit append rule
  covers only `feat(song-pack-<n>)` PRs).

## What to build
1. **The echo engine** (pure scheduling in `echo.ts`):
   - each played note (pitch, velocity, duration from its release, timing) goes out at its press time + k × the
     interval, for k = 1, 2, 3;
   - **channels and programs:** voice k+1 plays on MIDI channel k+1 (2, 3 and 4), each with a program change at the
     take's start;
   - **the programs are picked by ear on the DGX, then logged** (`specs/decisions/round-voices.md`). Starting points
     from the pitch: strings, then flute or vibes, then choir aahs, as General MIDI numbers;
   - **the scheduler** sends only what falls inside the lookahead window (as beat-track does), so a Stop or a pause
     cancels what hasn't gone out yet.
2. **The feedback trap:** the piano-midi spike measured no echo at the DGX's default settings
   (`spikes/piano-midi/RESULTS.md` R7; #429 is a headless CI check, not the piano). A changed panel setting could
   still echo, and core's `midiDevice` passes note-ons from every channel and carries no channel, so guard anyway:
   - **channel filter:** the experiment opens its own read-only listener on the same MIDI input. `wrapInput` drops a
     note-on whose pitch and `timeStamp` match a message the listener saw on channels 2–16. The player's keyboard is
     channel 1; log it if the DGX sends on another;
   - **echo guard, off by default:** hand-mode's `echoGuard` can also drop a note-on of the same pitch and velocity
     within a few ms of a scheduled echo send, for a piano that echoes on channel 1. It ships off
     (`echoWindowMs: 0`): R7 saw no echo, and a round puts one pitch in two voices at once, so a perfect press lands
     on its own echo, and laptop keys and bots play one velocity (on `/sim` the bot lost 6 of 32 presses). Turn it
     on (a few ms, not hand-mode's 30) if Eric's run shows a channel-1 echo. Log the window;
   - **echoes are never judged.** The log counts echoes received and dropped.
3. **The ending:**
   - after your last note, voices 2, 3 and 4 finish their copies in turn, so they drop out one at a time. The results
     screen can show while they finish;
   - **silence on every exit,** per backing-track's rules: pedal up (CC64 = 0) and All Notes Off (CC123) on every
     channel used, at the end, on Stop, on `pause`, `quit` and a new `songStart`, and on `pagehide`;
   - a pause drops the pending echoes (logged).
4. **On screen:**
   - a played note rises back up its lane, then falls again as an outline in voice 2's color, then voice 3's, then
     voice 4's;
   - the voice colors come from the Duo tokens, never `--pa-hype` (moments only, #663), and are logged;
   - a kit `MonoLabel` "VOICE 2" (then 3, 4) shows at each entry;
   - **the result card** says "4 voices, all you". If highlight-reel (`/highlight?take=last`) works from a saved take
     cheaply, link to it; otherwise skip it and log why;
   - **reduced motion:** no rising trail, outlines only.
5. **Optional, last:** a "Canon" toggle, an entry at the fifth after one bar. Build it only if the main round lands,
   and log the result.

## Validation
The bars are the planner's, not measured thresholds.

**(a) The source table:** one row per round chart in `specs/decisions/round-entries.md`, with the source URL,
license, edition, note count checked, and the entry interval with where the score marks it. Plus `CREDITS.md` through
a `docs:` PR if the source is CC.

**(b) Echo timing ±2 ms:**
- **unit test** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/round`): a scripted take's presses give
  echoes at press + k × interval, ±2 ms, on channels 2–4, with each note's own velocity and duration, sent only
  inside the lookahead window;
- **live log:** on `/sim`'s fake piano (as replay-view's check reads its sent messages), every echo's send timestamp
  against its press + k × interval. The median and max |error| go in the PR. Run it on your dev server through the
  in-app browser; there's no local headless suite.

**(c) No feedback:**
- **unit test:** a synthetic echo (same pitch, the same `timeStamp` on channel 2) fed through the input filter is
  dropped, and the echo guard, when on, drops a channel-1 copy within its window. A real press of the same pitch
  outside the window, or in exact unison at its own velocity, is kept and judged; with the guard off (the default) a
  unison press is always judged;
- **live, Eric at the DGX:** a round with 0 echoes judged as input, the log's echoes received and dropped counts.
  This is a morning-page item.

**(d) Multitimbral:** live on the DGX (Eric), channels 2–4 play in distinct voices, logged. If the DGX can't, fall
back to the piano voice an octave apart per voice, say so in the done note, and log it. This is a morning-page item.

**(e) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- score with taste v2 at 1280×720 and 1920×1080, plus reduced motion, from your own dev server in the in-app browser
  (one slot, `devserver.1` to `.4`);
- fix the top three problems a round, at most three rounds;
- scores and our shots go in the PR's Design section, and the shots in `specs/features/experiments/shots/round/`.

**The perf gate** (contract item 4): `perf.mjs --params x=round`, p95 ≤ 6 ms. It runs locally only under
`verify.lock`; otherwise "not run locally; main's scheduled run covers it".

**(f) Eric's 1-minute Frère Jacques round on the DGX** (morning page, low rank).

The hardware runs, (c) live, (d) and (f), need Eric at the DGX. The worker ships the unit tests and the `/sim` log,
and the done note says "not verified live" for those three until Eric runs them.

**Eric's URLs:** Lab → The Round, or `localhost:3001/play?song=<the round's id>&x=round`.

## Gaps (accepted)
- Only voice 1 is judged. Echoes copy your take exactly, mistakes included.
- The DGX's multitimbral behavior and its echo are unknown until Eric's run.
- The round charts appear in the song select as normal songs.

## Defaults
- **In `extras`,** after highway-field.
- Log any choice this spec doesn't make in `specs/decisions/round-*.md`: the programs, the voice colors, the echo
  window, and the lookahead.
- The smaller option; no new dependency; no change to `web/src/contracts/`.
