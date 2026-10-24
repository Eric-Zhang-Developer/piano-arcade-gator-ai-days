---
name: Play Twinkle on the real piano, judged, with a results screen
bootstrap: true
depends_on: []
owns: ["web/src/app/play/", "web/src/app/layout.tsx", "web/src/app/globals.css", "web/src/game/core/", "web/public/songs/twinkle/", "web/e2e/"]
assignee: "eric"
---

# Core loop (bootstrap)

The skeleton every other feature builds on, and a rough but real demo: open `/play` in Chrome with the piano
plugged in, notes fall, you play Twinkle, every note is judged, and a results screen shows how you did. It must work
the same on laptop keys with the piano unplugged. Rough is fine; wrong is not.

Read first: `specs/mission.md` (the judging rule is exact), `specs/tech-stack.md` (layout), `specs/decisions/`,
`spikes/piano-midi/RESULTS.md` (what the hardware really does) and the frames in `specs/context/references/` (the
look). Copy the spike's lessons, not its code.

## Plan
1. Scaffold Next.js (App Router, TypeScript) in `web/` with pnpm. Pin `packageManager`. Add the scripts `lint`,
   `typecheck`, `test`, `build`, `verify`. Replace CI's placeholder "Project checks" step with
   `pnpm -C web lint && pnpm -C web typecheck && pnpm -C web test && pnpm -C web build` (with pnpm set up).
2. Write the shared formats in `web/src/contracts/` (below) first, as types plus small validators. They become frozen.
3. Write the Twinkle chart, the clock, input, judging (pure functions), the highway renderer, the results screen.
4. Write `web/src/game/layers.ts`, the one open file where later game features register themselves.
5. Write the Vitest players and the Playwright verify script, and set `[verify].command`.

## Requirements
**Shared formats** (`web/src/contracts/`, frozen once merged; both lanes read them):
- `Chart`: `{ id, title, composer, catalog?, source, bpm, beatsPerBar, notes: ChartNote[] }`. `ChartNote`:
  `{ id, pitch (MIDI 21–108), beat (start, from beat 0 of bar 1), duration (beats), hand: "R" | "L" }`. `source`
  is the score the notes came from (a URL or citation; licenses per decision 003), or `"Eric"`.
- `Take`: `{ chartId, startedAt (ISO), latencyOffsetMs, inputDevice: "midi" | "keys" | "test", events: TakeEvent[] }`.
  `TakeEvent`: `{ pitch, velocity (1–127; laptop keys use 80), timeMs, offTimeMs | null }`, with times in ms on the
  chart clock (0 is beat 0 of bar 1).
- `Results`: `{ chartId, judgments: { noteId, judgment: "PERFECT" | "GREAT" | "MISS", offsetMs | null,
  eventIndex | null }[], extras: { eventIndex }[], counts, accuracy, maxCombo, rank }`. `offsetMs` is signed:
  negative is early.
- `GameEvent`: a union of `songStart`, `countInBeat { beat }`, `noteHit { noteId, pitch, judgment, offsetMs }`,
  `noteMiss { noteId, pitch }`, `extra { pitch }`, `combo { count }`, `comboMilestone { count }` (25, 50, then every
  100), `feverStart`, `feverEnd`, `fullCombo`, `songEnd { results }`. Each carries `atMs` on the chart clock.
- `InputDevice`: `{ kind, start(onEvent), stop() }`, emitting `{ type: "on" | "off", pitch, velocity, timeMs }`.
- `GamePlugin` (what `layers.ts` registers): `{ id, draw?(ctx, frame), onEvent?(event), transformChart?(chart,
  params), wrapInput?(input) }`. `frame` gives the chart clock now, the visible key range and the judgment line's
  position, so a layer can draw aligned to keys.

**Chart:** Twinkle, the first verse (all six phrases), right hand, at 100 BPM in 4/4, in
`web/public/songs/twinkle/chart.json`. The notes come from a cited score of the melody (decision 003); put the citation in
`source`. Don't write the notes from memory. If you can't get a source, file a `needs-human` issue and leave the chart
for Eric. Eric checks it by playing.

**Songs** (added after core-loop shipped, #75): `/play?song=<id>` loads `/songs/<id>/chart.json`. With no `song`
it loads Twinkle. An unknown id shows a clear message and a link to `/`, never a blank page. `?input=test` and the
verify script keep working. This lands as a `fix(core-loop)` PR.

**Input:**
- MIDI: Chrome Web MIDI. Pick the port whose name contains "Portable Grand", else the first input. Ignore `0xFE` and
  `0xF8`. A note-on with velocity 0 is a release. Use the message's `timeStamp` for time.
- Laptop keys: map white keys to `A S D F G H J K L ;` and black keys to `W E T Y U O P`, starting at the chart's
  lowest white key. Use the keyboard event's `timeStamp`. Ignore key repeat.
- Test input (`?input=test`): a device the verify script drives with exact timestamps. Never enabled otherwise.
- Latency offset: a slider from -150 to +150 ms in 1 ms steps, saved in `localStorage` as
  `pianoArcade.latencyOffsetMs`. A key's judged time is its arrival time minus the offset.

**Judging** (pure functions, no React): exactly the rule in `mission.md`. Superseded in part by `judging-tiers`
(GOOD, WRONG notes, the new accuracy); the original rule follows for history. Match each key press to the nearest
unmatched chart note of the same pitch within ±50 ms. Combo counts consecutive PERFECT and GREAT; a MISS resets it;
extras don't. Fever starts at a combo of 50 and ends at the next MISS. Accuracy = (PERFECT + 0.5 × GREAT) / notes.
Rank: S ≥ 95%, A ≥ 90%, B ≥ 80%, C ≥ 70%, else D.

**Highway** (one canvas, `requestAnimationFrame`, state in refs):
- Draw only the keys from the chart's lowest to highest pitch, padded to whole white keys plus one white key on each
  side. The keyboard is drawn along the bottom; its top edge is the judgment line.
- Notes are one color, rounded bars, as wide as their key (narrower on black keys), as tall as their duration. A
  missed note turns a clearly different, desaturated color. A pressed key lights up.
- Lookahead: 2000 ms by default (a setting).
- Perspective: a setting from 0 (flat, the default) to 0.3, where the top of the highway is (1 - p) times as wide as
  the bottom. The judgment line stays aligned with the keys at every value. Settable with `?perspective=0.15`.
- A count-in of 8 beats (two bars) before beat 0: show the beats; emit `countInBeat`. No sound in this feature
  (`beat-track` plays it). Each note ends with a gap and starts with a bright leading edge, so repeated notes read
  as separate (playtest, `specs/context/findings.md`).
- The judgment word for the latest note (PERFECT, GREAT or MISS) and its offset in ms, once, centered above the line.

**Results screen** (React): counts of PERFECT, GREAT, MISS and extras, accuracy, max combo, rank, and a Retry button.

**Layers:** `web/src/game/layers.ts` exports the list of registered `GamePlugin`s (empty in this feature). `/play`
draws each plugin's layer on its own canvas above the highway, forwards every `GameEvent` to `onEvent`, and applies
`transformChart` and `wrapInput`.

## Validation
- `pnpm -C web test`: the Vitest synthetic players, each against the Twinkle chart:
  - Perfect player: every note at offset 0 gives all PERFECT, accuracy 100%, rank S.
  - Skipper: drops notes 3 and 10 gives exactly 2 MISS, 0 extras.
  - Late40: every note at +40 ms gives all GREAT.
  - Boundary: +25 ms gives PERFECT, -50 ms gives GREAT, +51 ms gives a MISS plus an extra (GOOD since
    `judging-tiers`; that spec's Validation replaces this line).
  - Wrong pitch: one note a semitone off gives a MISS plus an extra (since `judging-tiers` that extra is also a
    WRONG note).
- `[verify].command`: `pnpm -C {worktree}/web verify --out {out}`. It starts the app, opens `/play?input=test`
  headless, plays the Perfect player, and fails unless the results screen shows every note PERFECT. It saves a
  screenshot of the results screen to `{out}`.
- On the piano (Eric; mark it in the done note): open `/play` in Chrome, allow MIDI, play Twinkle, see judgments and
  the results screen. Then unplug and play it on laptop keys.

## Defaults
- Prefer the smaller option; leave visual polish to `hud` and `juice-visual`.
- Any tuning number is a named setting with the default above (see `decisions/000-defaults.md`).
- If a reference frame and this spec disagree, the spec wins.
