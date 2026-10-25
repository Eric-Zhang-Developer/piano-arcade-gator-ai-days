---
name: "Record seams: Golden's recording ends on a bar line under the results and starts under the count-in"
depends_on: ["audio-track", "results-landing", "count-in", "milestone-sfx", "golden-demo", "bar-lines"]
owns: ["specs/features/record-seams/", "changes/record-seams.md", "specs/decisions/record-seams-", "web/src/game/record-seams/"]
assignee: "eric"
---

# Record seams

Issue #1269. It's a hero-tier polish item (#856), because it's the demo's ending: the seams where a song's own
recording starts and stops. It's a normal game-lane change with the design pass, and it has no flag. It applies to
any song with an audio sidecar (`songs/local/<id>/audio.json`).

**Today (origin/main):**
- **At songEnd,** audio-track fades the recording with `setTargetAtTime` at `fadeOutS / 3` (`fadeOutS` 0.25,
  `audio-track/index.ts:13` and `:263-271`), then disconnects it, and its level stops reporting (`levelNow` reads
  `anchor`, which is set to null). Golden's singer is cut off mid-phrase as results-landing (#978) cuts in.
- **Pause and quit** call `silence()`, an immediate disconnect. Leaving `/play` without a quit is caught by a 250 ms
  `watchMs` check, which songEnd clears. A Retry runs `transformChart` again, which also calls `silence()`.
- **The count-in** (#1013) draws 8 beats on beat-track's click times. It has no title slate (decision
  `count-in-slate`: "the HUD's song card already says it there"). So the pitch's "title slate" is the HUD's song card
  during the count-in.
- **pedal-lamp** stays skipped (`specs/milestones.toml`, the extras comment). This adds no pedal display.

**Golden, measured from Eric's local files** (gitignored, read only, decision 003):
- `golden-hard/chart.json`: 123 bpm, 4/4, the last note ending at beat 387.28, so chart 188.9 s.
- `audio.json`: `offsetMs` 3784, so the last note ends at file 192.7 s.
- `golden.mp3` (`afinfo`): 198.8 s, about 6 s past the last note.

So on Golden:
- **the outro takes the play-out path** (its natural end is within ~12 s);
- **the intro fits inside the count-in:** 8 beats at 123 bpm is 3902 ms of lead, against a 3784 ms intro, so the
  recording already starts about 118 ms into the count-in when the AudioContext is running.

**The model:** film's J-cut and L-cut, where the sound leads or trails the picture. A DJ never chops a vocal.

## The pass
1. **The L-cut outro, on a natural songEnd only:**
   - **the tail:** the recording keeps playing under results-landing, about 6 dB under its take level from songEnd
     through the landing's clear and rank stingers;
     - the stinger times come from results-landing's `planLanding`, or the duck covers the whole tail if that's
       simpler; logged;
     - milestone-sfx's loudness rule keeps holding: `recordingLevelAt` keeps reporting the tail's level, ducked, until
       it ends, so `loudnessGain` still sees it;
   - **the fade:** over 2 bars, ending exactly on a bar line from the chart's bpm and `beatsPerBar`. The fade starts
     at the first bar line at or after songEnd (the rule logged). If record-follows' beat map has landed, its mapped
     bar lines are used instead;
   - **the play-out:** if the recording's natural end is within ~12 s of songEnd, it plays out with no fade. That's
     Golden's case;
   - **the pulse:** a faint beat pulse stays on the field while it's visible, until the fade ends;
     - if highway-field (#1122) has landed, the pulse uses its downbeat;
     - otherwise it's a plain bar-line pulse from this feature, with a one-line switch (a `ponytail:` comment) for when
       #1122 lands;
     - `web/src/game/highway-field/` is read only here, since #1122 is open.
2. **The J-cut intro:**
   - **the recording's intro** (file time 0 to `offsetMs`) sits under the count-in, and the song card appears with the
     recording's first sound, not before;
   - **the count-in clicks** land on the recording's real beats: the chart clock's count-in beats, through
     `fileOffset()` (the sidecar's `offsetMs` plus Options' "Recording offset"), within 5 ms;
   - **a demo** (`bot=…&demo=1`) can't start its AudioContext until a press (`wakeable`). The intro behavior is
     specified for a running context, and the demo's case is logged;
   - **an intro longer than the count-in's lead** should make the count-in wait and start on the right bar, with no
     double count. That needs `/play`'s lead (`zeroPerf`, `app/play/page.tsx:183`) or `core/settings.ts`'s
     `countInBeats`, and **#600 holds both**. So that case is a named Gap: today such a recording joins mid-intro
     (audio-track's `offsetS` clamp). Golden doesn't need it.
3. **Quit stays instant:**
   - Esc → Quit, Retry, and leaving `/play` keep today's immediate stop, now also reaching a running tail;
   - the 250 ms watch keeps running until the tail ends, so leaving from the results stops it too.
4. **A tag on results** while the tail plays:
   - a kit tag, "♪ fades at bar N" ("♪ plays out" on the play-out path), with a **Stop music** button
     (`kitButton`);
   - it's audio-track's `resultsPanel` and is gone when the tail ends;
   - Stop music silences within 300 ms, like quit.
5. **Reduced motion:** no beat pulse. The audio is unchanged.

**Recordings stay local** (decision 003). The tests use a fixture generated in code at test time: a tone and click
track with a known intro, bar grid and end, as audio-track's option B (`specs/decisions/audio-track-fixture.md`). No
audio binary is committed.

## How it's built
- **The module:** `web/src/game/record-seams/` (new) is pure:
  - the tail plan: kind, fade start and end on bar lines, the end bar N, and the duck span;
  - the gain envelope as explicit points, so a test can render it per audio frame;
  - the intro's alignment check;
  - the fixture generator.
- **audio-track only schedules** what the module plans.

**Files and holders** (re-check each before any edit):

| File | Owner (done) | Holder | This pass |
|---|---|---|---|
| `web/src/game/audio-track/index.ts` | audio-track | free | the tail, the duck, the level during the tail, quit reaching the tail, the watch, `resultsPanel` |
| `web/src/game/count-in/index.ts` | count-in | free now, but **#1177's fix** (`fix(count-in)`, ci-red, beat 1's first frame late) will change it | only if the song card's timing needs it |
| `web/src/game/results-landing/` | results-landing | free | read only (`planLanding`'s stinger times) |
| `web/src/game/highway-field/` | highway-field | **#1122** (draft) | read only; the switch line |
| `web/src/game/milestone-sfx/` | milestone-sfx | free | read only (`loudnessGain`, `levelEnvelope`) |
| `web/src/app/play/page.tsx`, `web/src/game/core/settings.ts` | core-loop | **#600** | nothing; the long-intro wait is a Gap |
| `web/src/game/core/highway.ts` | core-loop | #747, #600 | nothing |

- **Order with #1177:** #1177's count-in fix goes first. It's a ci-red fix-forward and touches the first beat's
  scheduling, which this pass must not change. record-seams rebases on it. If record-seams reaches `count-in/index.ts`
  while #1177's fix is still open, it leaves that file alone and makes the song card change after.
- **The lane:** every row is the eric lane, so a `feat(record-seams)` PR may change the free files while no open PR
  touches them.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score each round against `references/critique.md` and fix the top three problems. A hero item gets up to 5 rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Measured on the generated fixture** (`pnpm -C web exec vitest run src/game/record-seams src/game/audio-track src/game/count-in src/game/results-landing`):
- the fade path ends on a bar line within ±1 audio frame at 48 kHz;
- the play-out path is chosen when the natural end is within the threshold, and the fade path otherwise;
- in the rendered envelope (the plan's gain × the fixture's level), no drop of more than 20 dB within 50 ms, except on
  quit and Stop music;
- quit, Stop music, Retry and leaving `/play` during the tail are silent within 300 ms;
- the count-in clicks are within 5 ms of the fixture's intro beats, through `fileOffset()` with a Recording offset of
  0 and of ±100 ms;
- `recordingLevelAt` reports the ducked level during the tail and null after;
- audio-track's existing tests stay green.

**(b) The look:**
- before and after shots at 1280×720 and 1920×1080: the results with the tail tag, and the song card over the intro;
- the same under reduced motion;
- the taste v2 score for each round, up to 5.

**(c) Golden's ending, recorded:**
- before and after recordings of Golden's last 20 s, with the bot on the DGX and on the laptop voice;
- local only, never committed; how they were captured is logged;
- on the morning page, ranked mid.

Browser checks (`verify-audio`, `verify-count-in`, `verify-landing`): not verified locally; covered by main's scheduled
full run.

**Eric:** at `localhost:3001/play?song=local/golden-hard&bot=perfect&audible=1&demo=1&beat=off`, let it finish (the
play-out under the results, the tag), then Esc → Quit mid-song to confirm the fast stop. The done note says `not heard
by Eric` until he does.

## Gaps (accepted)
- An intro longer than the count-in's lead still joins mid-intro until `/play`'s lead can grow (#600 holds it).
- Bar lines come from the chart's constant bpm until record-follows' beat map lands.

## Defaults
- **In `extras`,** at the end. Polish bundle 4 may append too; whichever plan PR goes second rebases.
- Log any choice this spec doesn't make in `specs/decisions/record-seams-*.md`: the fade curve, the duck span, the
  play-out threshold, the pulse's strength and the tag's copy.
- The smaller option; no new dependency, and no committed audio.
