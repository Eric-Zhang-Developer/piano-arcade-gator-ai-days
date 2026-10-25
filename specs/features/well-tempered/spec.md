---
name: "Well-Tempered: the DGX retunes itself, and each interval's beat rate pulses on screen"
depends_on: ["experiments", "lab-gallery", "nav-bar", "piano-out", "laptop-sound", "composers-hands", "duo-tokens"]
owns: ["specs/features/well-tempered/", "changes/well-tempered.md", "specs/decisions/well-tempered-", "web/src/game/x/well-tempered/", "web/src/app/tuning/", "web/public/lab/well-tempered"]
assignee: "eric"
---

# Well-Tempered

Issue #1356, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878, with its
own Lab page, listed in the gallery. It lands on main off by default and stays out of the main game until Eric picks
it in the Lab.

**The pitch:** the DGX retunes itself, and the screen shows each sounding interval's acoustic beat rate.

## How it mounts
- **The page:** `/tuning` (`web/src/app/tuning/page.tsx`, over `web/src/game/x/well-tempered/`).
  - The route was free on main when this spec was written.
  - It follows the other Lab pages' pattern (`/speak`, `/musicbox`, `/name`, `/sheet`): a thin `page.tsx` with
    `metadata.title` as `Well-Tempered · ${APP_NAME}`, rendering one client component from the experiment's folder.
- **The registry:** one line in `web/src/game/x/index.ts`, with `href: "/tuning"`. It carries lab-gallery's fields:
  `kind: "wow"`, `needs` (the DGX, from the code's own MIDI use) and a `poster` at `web/public/lab/well-tempered.webp`
  (60 KB or less, captured with `?capture=1`).
  - The pitch says #1309 (harmony-map) holds `x/index.ts`, but #1309 has merged, and no open PR held the file when
    this spec was written.
  - Re-check; if a PR holds it then, whichever lands second rebases its one line.
- **The nav bar:** `"/tuning"` is added to `EXPERIMENT_PAGES` in `web/src/game/nav-bar/slots.ts:35`, a hand list,
  so the nav lights Lab there (lab-pages-a11y). That's one line under the lane rule; nav-bar is done, and the file was
  free.
- **Its own MIDI access,** as the other DGX pages have.

## The build
1. **The screen:**
   - **beat lines:** a line between each pair of sounding keys pulses at that interval's acoustic beat rate. Pure
     intervals are still, and the meantone wolf shimmers;
   - **the dial:** a circle-of-fifths dial shows how each tuning spreads the Pythagorean comma, in cents per fifth;
   - **a guided demo** of about 60 s, each step with a one-line caption:
     1. bach-prelude-c's first bars in Werckmeister III, then the same bars in equal. bach-prelude-c is in the library
        (`web/public/songs/bach-prelude-c/`, "Prelude in C major", 60 bpm, 4/4, with a `pedal.json`);
     2. a C major chord in quarter-comma meantone;
     3. the same chord built where meantone's wolf fifth falls (the pitch says on G♯/A♭). The worker places it from
        the cited meantone table's own layout, not from memory;
   - **free play** in any tuning, from the DGX's keys or laptop keys;
   - **reduced motion:** the beat rates as numbers (Hz), with no pulsing.
2. **The beat formula:** for two partials in the ratio p:q (p > q), the beat rate is |q·f_high − p·f_low|.
   - For a major third (5:4): |4·f_high − 5·f_low|.
   - For a fifth (3:2): |2·f_high − 3·f_low|.
   - Equal C4–E4 beats at about 10.4 Hz, and a pure third at 0.
   - The intervals shown, and which partials, are logged.

## The planner's decisions
1. **Only cited tunings:**
   - equal, Pythagorean, quarter-comma meantone, Werckmeister III and Vallotti, as cent tables in
     `specs/decisions/well-tempered-tunings.md`;
   - each table cites a source the worker read (URL or citation, page or table), never memory;
   - where two sources disagree, both values and the choice are logged.
2. **The retuning path is verified, never assumed.** In order, each tried and logged:
   - **(a) SysEx scale tuning,** only if Yamaha's DGX-660 MIDI Reference documents it.
     - The worker reads the reference in the browser, doesn't download or commit the PDF, and cites the page.
     - Web MIDI SysEx needs `requestMIDIAccess({ sysex: true })`, which brings a permission prompt. The page asks only
       when path (a) is chosen, and says why.
   - **(b) Channel rotation:** each sounding note on its own channel, with a preset pitch bend at a known bend range
     set by RPN 0. This works only as far as the reference documents multi-channel reception, RPN 0 and the channels'
     voices; the program set per channel is logged.
   - **(c) The laptop voice** at exact cents, for when neither DGX path works, or with no DGX.
3. **Reset is the risk.**
   - **What it sends:** bend centered (`0xE0 0x00 0x40`) on every channel used; the bend range and the RPN back to the
     reference's defaults, then RPN null; scale tuning zeroed (path a); and all notes off and the pedal up on every
     channel.
   - **When:** on Stop, `pagehide` and unmount.
   - **How:** it also has to beat anything still queued in the lookahead ring, so a single "now" message isn't enough.
     It reuses the pattern lab-midi-release fixed (#1310–#1314, its spec's "shared cause": Chrome's `MIDIOutput` has
     no `clear()`): `x/composers-hands/rolls.ts` `silence()` (`:73-81`), which sends everything now and again after
     its lookahead.
     - The spec doesn't write a third copy: it imports or extends that helper. lab-midi-release's feat PR (#1348) is
       open, so the worker re-checks and builds on whatever it lands.
     - `play()` claims a run token before its first await and bails if superseded (#1314's pattern).
   - **A unit test asserts the reset messages,** with a fake output and fake timers: after Stop mid-demo, every
     channel's last bend is centered, and its last CC123 and CC64=0 are stamped at or after every queued note-on.
4. **Cut from this PR:** playing the game's charts in a chosen tuning. It would touch the play path and held files
   (`app/play/page.tsx` and `core/settings.ts` by #600, `core/highway.ts` by #747 and #600). It's a follow-up idea in
   the Gaps.
5. **Measurement:**
   - **pitch-tracking:** each note is tracked with YIN or autocorrelation through the laptop mic;
   - **recordings** go to a local folder kept out of git (`web/src/game/x/well-tempered/recordings/` with a committed
     `.gitignore` of `*` and `!.gitignore`), and are never committed;
   - **the bar:** 12 notes per tuning within ±3 cents of the cited table, with the table of measured against cited in
     the PR;
   - **without a DGX:** if the DGX isn't reachable from the worker's session, the worker measures path (c) and the
     bend math (the expected cents from each bend value), moves the DGX measurement to Eric's morning page, and says
     so in the Gaps.
6. **The design pass:** see below.
7. **Eric's listen,** ranked low: the 60 s guided demo on the DGX. Is the wolf obvious?
8. **Held files:** `x/index.ts`, `nav-bar/slots.ts` and `lab-gallery`'s `web/public/lab/` were free (see How it
   mounts), and the switch lines above cover a holder appearing.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, at 1280×720 and 1920×1080 on the dial, the beat lines
  and the guided demo, plus reduced motion, fixing the top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Unit tests** (`pnpm -C web exec vitest run src/game/x/well-tempered src/game/x/composers-hands`):
- each tuning's 12 cents equal its decision file's cited table, with the source named in the test;
- **the beat formula** on known pairs:
  - equal C4–E4 is about 10.4 Hz;
  - a pure 5:4 third and a pure 3:2 fifth are 0;
  - the meantone fifth beats slowly, and the wolf fast;
- the bend math: cents to a 14-bit bend at the set range, both ways;
- **the reset**, as in decision 3;
- the demo's steps and captions in order, about 60 s.

**(b) Measured:** 12 notes per tuning within ±3 cents, by YIN or autocorrelation through the laptop mic, on whichever
path was used (decision 5). The table goes in the PR.

**(c) The design pass,** above.

**(d) Eric** (the morning page, ranked low): at `localhost:3001/tuning`, the guided demo on the DGX. Is the wolf
obvious? Plus the DGX measurement if the worker couldn't reach it. The done note says `not heard by Eric` until he
does.

Browser checks: not verified locally; covered by main's scheduled full run.

## Gaps (accepted)
- **Charts in a chosen tuning** (a follow-up idea): it touches the play path and files held by #600 and #747.
- **The DGX's own measurement** waits for Eric if the worker's session can't reach the piano.
- **Which retuning path the DGX supports** is whatever its MIDI Reference documents, and nothing beyond.

## Defaults
- **In `extras`,** at the end, after touch-visible.
- Log any choice this spec doesn't make in `specs/decisions/well-tempered-*.md`: the path chosen, the channels and
  programs, the bend range, the pulse's mapping from Hz to motion, the dial's layout and the demo's timing.
- The smaller option; no new dependency, and no downloads.
