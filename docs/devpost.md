# Devpost draft

The submission fields Devpost asks for ([event.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/context/event.md), section 3), drafted from what's in the
repo. Every fact links to its source. **Open** items are empty on purpose: they need a person, and nothing here fills
them with a guess. Before pasting, re-read the linked sources; the numbers in them are dated.

## Open before submitting

| Item | Why it's open | Where it's tracked |
|---|---|---|
| The "past 12 months" technology | The challenge asks for one, central to the project; which one is undecided, so nothing below claims one | [#10] |
| A `LICENSE` file | None on `main`; Best Open Source needs "a clear open-source license" ([event.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/context/event.md), section 5). The choice is Eric's | [#958] |
| The live URL | Vercel needs the Supabase keys and `ANTHROPIC_API_KEY`, the repo connected and a redeploy | [#792] |
| The demo video | Not recorded yet; Devpost allows "3 minutes maximum" | none |
| The team roster | Full names and Devpost registration for every member | none |
| The sponsor prizes to enter | A choice for the team (see [Prizes](#prizes)) | none |

## Project title

Étude ([mission.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/mission.md); named on 2026-10-25, working name Piano Arcade,
[naming.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/context/naming.md)).

## Elevator pitch

A piano tutor for everyone: it finds what you know, picks what to practice next, and listens to every note you play
on a real piano. The arcade is the method.

## About the project

### Inspiration

Practicing piano alone, you get lost. You don't know what you got wrong or what to work on next, and the practice is
lonely and quiet ([judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#impact-what-étude-does-for-a-learner), [mission.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/mission.md)).

The apps don't fix that. The four leading learning apps we checked (Simply Piano, Flowkey, Yousician, Playground
Sessions) cost about $100 to $150 a year. All four grade *which* notes you hit, not *how* you played them, none lets you
bring your own song, and all of them top out around intermediate
([competitors.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/context/raw/competitors.md)).

The best answer today is a person: a piano tutor. A tutor personalizes. They hear how you played, so you always know
what to work on next. The best tutors also know learning theory and build a whole program around it, so each week's
practice adds up to the next.

But not everyone can have one. Tutors are expensive, and even if everyone could pay, there aren't enough of them to
go around.

So we built Étude: a 10/10 piano tutor for everyone. The product is a tutor that resolves feeling lost at the piano;
the arcade is the method that makes you keep practicing
([Product philosophy](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/PRODUCT_PHILOSOPHY.md), principle 1;
[what are we building](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/context/dialogues/2026-10-25-what-are-we-building.md)).

### What it does

**The tutor** (`/learn`)

- A new student names the songs they want to play, then takes a diagnostic of up to 15 minutes. After that the tutor
  drives: `/learn` opens on a map of music skills with the next step ready to start
  ([LearningLanding.tsx](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/LearningLanding.tsx), [learning-ui](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/learning-ui.md)).
- The steps it hands you: understand an idea (`/learn/understand`, with a theory chat), recall it
  (`/learn/review/theory`), practice a passage with help that fades (`/learn/practice`), prove it in a cold check
  (`/learn/check`: at tempo, both hands, no help), and play the whole piece with feedback after the last bar
  (`/learn/play-through`). `/learn/goals` changes the songs you're aiming at
  ([README](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/README.md#run-it), [`web/src/app/learn/`](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/tree/main/web/src/app/learn)).

**The game** (`/`, `/play`)

- Notes fall toward the keys of a real 88-key piano (a Yamaha DGX-660) in Chrome, or toward laptop keys with no piano.
  Every note is judged against the chart's clock: PERFECT, GREAT, GOOD, MISS and WRONG
  ([mission.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/mission.md), [README](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/README.md#how-it-works)).
- Flow mode waits at each note and follows your tempo, so a beginner isn't left behind
  ([flow-mode](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/flow-mode.md)).
- On the song select, L opens the focused song in wait mode, to learn it before playing it judged
  ([learn-from-select](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/learn-from-select.md)).
- Practice in chunks starts on the whole song at 70% tempo. Below 85% accuracy it narrows onto the half with more
  missed notes; after 2 clean takes it grows; at one phrase it offers to learn those bars in wait mode or slow to 50%.
  A strip shows each phrase tinted by its accuracy. Not tried by Eric on the piano yet
  ([adaptive-chunks](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/adaptive-chunks.md)).
- The results screen grades how you played: early or late, loudness against the score, evenness of runs, and the
  weakest bars, with a link to practice them slower ([judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#impact-what-étude-does-for-a-learner)).
- `/stage` shows the live take on NOSTALGIA's hill for the people watching on a second display
  ([stage-view](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/stage-view.md)).
- Takes save and `/progress` shows them over time ([judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#impact-what-étude-does-for-a-learner)).
- An LED strip over the keys: keys played on the DGX-660 light it ([firmware results](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/firmware/RESULTS.md), [#639]),
  and the game sends it the next key and every hit, checked so far against a simulated board (42 of 42 hints), not yet
  with the real strip ([led-game](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/led-game.md)).
- 40 songs, each charted from a cited score ([`web/public/songs/`](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/tree/main/web/public/songs/)).

**The Lab** (`/lab`) holds experiments and spikes, each off the main path:

- Real Keys (`/real-keys`), a spike: calibrate a camera on the key bed, then play with the highway's notes falling
  onto the live picture of the real keys ([real-keys](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/real-keys.md)).
- Conduct (`/conduct`), a spike: a hand at the laptop camera leads the piano; a still hand holds, a fist cuts off,
  and stroke size swells the velocities ([conductor](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/conductor.md)).
- Highlight reel (`/highlight`), a spike: a take rendered into a 15 s broadcast replay WebM. The encode was a no:
  MediaRecorder dropped frames, so the recommendation is to iterate with WebCodecs ([highlight-reel](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/highlight-reel.md)).
- Wrong note (`/wrong-note`), a listening spike: the DGX plays 8 notes of a song with one moved 2 semitones, and you
  press the wrong one ([wrong-note-spike](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/wrong-note-spike.md)).
- Simon (`/simon`), a spike: the DGX plays the opening notes of a library song, you repeat them, and each round adds
  a note ([simon-says-spike](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/simon-says-spike.md)).
- The Composer's Hands (`/composers-hands`), a spike: a composer's own piano roll, his left hand while you play the
  right, and his tempo drawn against yours ([composers-hands](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/composers-hands.md)).
- Wet Paint (`/paint`), a spike: free play where each note blooms as paint in Scriabin's colors, wet while the pedal
  is down ([wet-paint](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/wet-paint.md)).
- The Speaking Piano (`/speak`), a spike: preset phrases or up to 3 s of your voice played on the DGX, the voice's
  spectrum struck on 88 keys ([speaking-piano](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/speaking-piano.md)).
- Pinned (`/musicbox`), a Lab experiment: your take as a brass music-box cylinder over a steel comb, with an STL
  export ([pinned](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/pinned.md)).
- The Build Sonata (`/sonata`), a Lab experiment: the night the agents built Étude as 90 s of music, one note per
  merged PR ([build-sonata](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/build-sonata.md)).
- The Round (`?x=round`), a Lab experiment: you play a round once and the piano plays your take back as voices 2, 3
  and 4 ([round](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/round.md)).
- Hand palette (`?x=hand-palette`), a Lab experiment: three hand and judgment palettes, with a colour-blind
  simulation ([hand-palette](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/hand-palette.md)).
- Screen shake (`?x=screen-shake`), a Lab experiment: each combo milestone shakes the highway ([screen-shake](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/screen-shake.md)).
- Menu sounds A/B (`?x=ui-sounds-ab`), a Lab experiment: the old menu sounds against the new soft family
  ([ui-sound-family](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/ui-sound-family.md)).

### How we built it

**The tutor.** A tutor needs to know the subject, know the student, choose what comes next, and listen. Each of those is
a part you can read:

- **A skill graph with sources.** 207 skills and 481 prerequisite links across six regions: pitch, rhythm, keys,
  chords, expression and pieces, with nine backbone skills. The skills cite 146 distinct source titles, and 433 items
  test them: 278 theory questions and 155 passages to play. A test fails the build if a skill has no source, a link has
  no rationale, or the graph splits in two
  ([curriculum](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/tree/main/web/src/learn/frontend/mastery/curriculum), [audit.test.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/curriculum/audit.test.ts)).
- **A diagnostic that adapts.** It asks backbone skills first, then concepts, then details, and stops when every
  backbone skill is settled or after 15 minutes of active time. Each answer also nudges the skills linked to it, so a
  short test covers a large graph. Theory items are multiple choice; playing items need a MIDI piano
  ([diagnostic/model.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/diagnostic/model.ts)).
- **Knowledge tracing.** Every attempt updates the tutor's belief that you know each skill. A skill counts as mastered
  at a belief of 0.95, with at least 3 counted attempts on at least 2 different items. Mastered skills come back as
  cold checks after 1, 3, 7, 21 and 60 days: a step further out after each success, back to the first after a
  failure. One failed check keeps the skill; two in a row demote it. Every number is a standard knowledge-tracing
  value, not calibrated on real students
  ([constants.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/engine/constants.ts)).
- **Claude picks what's next.** The server replays your attempts and builds up to 20 candidates from the graph,
  scored by whether a check is due, the skill's layer, its links to skills you've mastered, and the songs you said you
  want to play, with at most 3 skills you've never touched. Claude Opus 5.5 picks 3 to 5 of them and says why. A reply
  that doesn't pass the graph check, an upstream error or a missing key falls back to the top candidates, and the plan
  says which one it is
  ([decide/index.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/decide/index.ts), [candidates.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/decide/candidates.ts)).
- **Help that fades, then cold checks.** Practice offers a demo, guide keys, a slower tempo and hands separately. A
  take counts as evidence only when help was on for at most 30% of it. A skill reaches the spaced checks only after
  repeated cold successes, and a check is cold: at tempo, both hands, no help
  ([constants.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/engine/constants.ts), [playing/attempt.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/playing/attempt.ts)).
- **Its own ear.** The tutor scores a played passage with its own scorer, separate from the game's judge: notes in
  order (the longest in-order match, with notes struck together counted as one chord), timing spread in ms around the
  click, evenness of loudness, and legato joins and pedal changes where the passage asks for them. Each measure that
  misses its bar comes back as one plain line, such as "hold each key until the next one goes down"
  ([piano/score.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/piano/score.ts)).
- **A theory chat that doesn't give the answer.** Claude Opus 5.5 asks one short guiding question at a time, so the
  student reasons their way there. It never states, confirms or rules out an option, and claims nothing beyond the
  student's own attempts
  ([tutor.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/app/learn/api/chat/tutor.ts)).
- **Saves.** Attempts and goals land on the device first, then sync through a server route to Supabase, so nothing is
  lost offline; the browser never writes to the database
  ([remote/store.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/remote/store.ts), [AGENTS.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/AGENTS.md#the-database)).

**The game and the hardware.**

- Next.js and TypeScript in Chrome; Web MIDI for the piano; Web Audio for sound; one canvas per layer for the highway
  ([tech-stack.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/tech-stack.md)).
- One pure judge function, the same in the game, in tests with synthetic players, and on the server that re-judges
  saved takes ([README](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/README.md#how-it-works), [judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#technicality-how-it-was-built)).
- Supabase Postgres and Auth for takes; the browser never writes to the database
  ([tech-stack.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/tech-stack.md), [judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#technicality-how-it-was-built)).
- An ESP32 drives a WS2812B strip over the keys ([led-strip](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/led-strip.md),
  [firmware results](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/firmware/RESULTS.md)).

**The team.** Three people and a swarm of coding agents, specs first: a feature counts as done only when its done note
with a check is on `main`. The counts, the CI times and how they were measured are in
[judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#technicality-how-it-was-built) and [the build story](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md).

### Challenges we ran into

From [the build story](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md) and [judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#presentation-limitations-and-trust):
- A real pianist scored 10 to 20% in strict mode and couldn't rejoin, which led to flow mode
  ([chapter 7](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-7-the-impossible-song)).
- A playtest ran on a build 9 hours old ([chapter 4](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-4-the-stale-build)).
- `main` went red eight times on Saturday; each time got an issue, and nothing merged on red
  ([chapter 5](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-5-main-went-red-and-we-said-so)).

### Accomplishments

- A skill graph where every skill cites a source and every link carries a rationale, checked by a test on every
  build ([audit.test.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/curriculum/audit.test.ts)).
- `/veritas` puts the judge on trial: test players plant known mistakes in real songs, and the judge finds exactly
  those, with no false alarms ([judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#presentation-limitations-and-trust),
  [chapter 6](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-6-veritas-the-judge-on-trial)).
- The laptop hears each piano key with millisecond timing
  ([chapter 1](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-1-will-the-piano-even-talk-to-us)).
- `/play` stopped lagging by measuring first: it drew 53 canvases and 436 megapixels a frame on a Retina screen, and
  now draws 3 canvases and 9.4 megapixels ([chapter 11](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-11-53-canvases), [#678], [#684]).
- A strict mode Eric called "completely undemoable" got its fix in an hour: from his approval to flow mode merged, with
  a browser check passing 9 of 9 ([wins log](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/wins.md), [#618], [#620], [#625]).
- 40 songs, each charted from a cited source; the ones under CC BY or CC BY-SA are credited
  ([`web/public/songs/`](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/tree/main/web/public/songs/), [CREDITS.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/CREDITS.md)).

### What we learned

- **Check what's being tested before testing it.** One playtest ran on a build 9 hours and 233 commits behind `main`.
  Now the select shows the commit it serves and its age ([incident](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/incidents/2026-10-24-stale-playtest-build.md),
  [build-stamp](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/build-stamp.md)).
- **Measure before optimizing.** The lag fix started with a probe that counted canvases and megapixels, not with a
  guess ([chapter 11](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-11-53-canvases)).
- **Fast CI for one can be slow CI for all.** Each fix for slow checks took more of a shared runner pool, until CI
  jammed. A PR now runs a smoke check, the full browser suite runs on `main`, and a red full run opens an issue
  instead of freezing merges ([incident](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/incidents/2026-10-25-ci-gridlock.md)).
- **One screen, one PR.** The new song select was split into twelve PRs, and the screen didn't change for over two
  hours. The rule is now one PR per thing a person sees
  ([incident](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/incidents/2026-10-25-duo-select-split.md), [AGENTS.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/AGENTS.md)).
- **A rule repeated is not a rule.** A "before Monday" gate passed from agent to agent until Eric was asked to rule on
  a deadline no file set ([incident](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/incidents/2026-10-25-made-up-gate.md)).
- **Check citations before they ship.** A second agent checked 15 of the build story's claims against git: 14 held,
  and the 15th, a quote attributed to the wrong person, was fixed before merge ([wins log](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/wins.md), [#677]).

### What's next

What's known not to be true yet ([judges.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/judges.md#presentation-limitations-and-trust)):
- The tutor saves its own attempts but doesn't read your `/play` takes yet ([#874]).
- The tutor's numbers (the 0.95 mastery line, the check intervals, the 30% help line) are standard values, not yet
  calibrated on real students ([constants.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/engine/constants.ts)).
- The deployed site has no keys yet: until they're set, live saves and sign-in are off (the tutor keeps attempts on
  the device), Next uses the top candidates without Claude, and the theory chat is off ([#792]).
- The judge can't flag rushing ([#545]).
- Flow mode and practice in chunks haven't been played on the piano yet
  ([flow-mode](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/flow-mode.md), [adaptive-chunks](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/adaptive-chunks.md)).

## Built with

Next.js, React, TypeScript, Web MIDI, Web Audio, three.js, OpenSheetMusicDisplay, Supabase (Postgres and Auth),
Vitest, Playwright, GitHub Actions, the Anthropic API (Claude Opus 5.5: the theory chat and the next-step picker),
ESP32, WS2812B
([`web/package.json`](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/package.json), [tech-stack.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/tech-stack.md),
[led-strip](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/changes/led-strip.md), [decide/index.ts](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/web/src/learn/frontend/mastery/decide/index.ts)).

## Links

- **Code:** https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days
- **Try it:** open ([#792]). Until then: clone and follow [Run it for judging](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/README.md#run-it-for-judging).
- **Video:** open.

## Team

| Name | GitHub | Lane |
|---|---|---|
| Eric Zhang | [@Eric-Zhang-Developer](https://github.com/Eric-Zhang-Developer) | The game ([AGENTS.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/AGENTS.md)) |
| Sharan (full name: open) | [@iKnow24](https://github.com/iKnow24) | Backend, accounts, progress, LED firmware ([AGENTS.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/AGENTS.md)) |
| Andres (full name: open) | [@seeko-codes](https://github.com/seeko-codes) | Learning: the tutor ([chapter 9](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/docs/story.md#chapter-9-andres-and-the-tutor-becoming-étude)) |

Devpost wants 2 to 5 registered members ([event.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/context/event.md), sections 3 and 4). Whether everyone is
registered: open.

## Prizes

The prizes and what each needs, from [event.md](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/blob/main/specs/context/event.md), section 5. Which to enter: open.

| Prize | What it needs | In the repo today |
|---|---|---|
| 1st / 2nd / 3rd | The main judging, on the challenge statement | Depends on [#10] |
| Best Open Source Project (MLH) | "a public GitHub repository with a clear open-source license" | Public repo; no license yet ([#958]) |
| Best Use of Gemini (MLH) | Built with the Gemini API or Google AI Studio | No Gemini call in the code |
| Best Use of the Twinly API | Twinly's computer-use, voice-clone calling or iMessage APIs | None |
| Vobile Prize | Judged on the same challenge statement as the main awards | Depends on [#10] |

[#10]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/10
[#545]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/545
[#618]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/618
[#620]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/620
[#625]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/625
[#639]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/639
[#677]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/677
[#678]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/678
[#684]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/684
[#792]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/792
[#874]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/874
[#958]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/958
