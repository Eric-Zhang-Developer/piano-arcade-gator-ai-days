# Devpost draft

The submission fields Devpost asks for ([event.md](../specs/context/event.md), section 3), drafted from what's in the
repo. Every fact links to its source. **Open** items are empty on purpose: they need a person, and nothing here fills
them with a guess. Before pasting, re-read the linked sources; the numbers in them are dated.

## Open before submitting

| Item | Why it's open | Where it's tracked |
|---|---|---|
| The "past 12 months" technology | The challenge asks for one, central to the project; which one is undecided, so nothing below claims one | [#10] |
| A `LICENSE` file | None on `main`; Best Open Source needs "a clear open-source license" ([event.md](../specs/context/event.md), section 5). The choice is Eric's | [#958] |
| The live URL | Vercel needs the Supabase keys, the repo connected and a redeploy | [#792] |
| The demo video | Not recorded yet; Devpost allows "3 minutes maximum" | none |
| The team roster | Full names and Devpost registration for every member | none |
| The sponsor prizes to enter | A choice for the team (see [Prizes](#prizes)) | none |

## Project title

Étude ([mission.md](../specs/mission.md); named on 2026-10-25, working name Piano Arcade,
[naming.md](../specs/context/naming.md)).

## Elevator pitch

A rhythm game on a real piano that judges every note to the millisecond and shows how you played it, not only which
notes you hit.

## About the project

### Inspiration

Practicing piano is lonely and quiet. The four leading learning apps we checked grade *which* notes you hit, not *how*
you played them, and arcade rhythm games are loud and addictive but don't teach a real instrument
([mission.md](../specs/mission.md), from [competitors.md](../specs/context/raw/competitors.md)).

### What it does

- Notes fall toward the keys of a real 88-key piano (a Yamaha DGX-660) in Chrome, or toward laptop keys with no piano.
  Every note is judged against the chart's clock: PERFECT, GREAT, GOOD, MISS and WRONG
  ([mission.md](../specs/mission.md), [README](../README.md#how-it-works)).
- Flow mode waits at each note and follows your tempo, so a beginner isn't left behind
  ([flow-mode](../changes/flow-mode.md)).
- The results screen grades how you played: early or late, loudness against the score, evenness of runs, and the
  weakest bars, with a link to practice them slower ([judges.md](judges.md#impact-what-étude-does-for-a-learner)).
- `/stage` shows the live take on NOSTALGIA's hill for the people watching on a second display
  ([stage-view](../changes/stage-view.md)).
- Takes save and `/progress` shows them over time; an LED strip on the piano lights the next key and every hit
  ([judges.md](judges.md#impact-what-étude-does-for-a-learner)).
- 40 songs, each charted from a cited score ([`web/public/songs/`](../web/public/songs/)).

### How we built it

- Next.js and TypeScript in Chrome; Web MIDI for the piano; Web Audio for sound; one canvas per layer for the highway
  ([tech-stack.md](../specs/tech-stack.md)).
- One pure judge function, the same in the game, in tests with synthetic players, and on the server that re-judges
  saved takes ([README](../README.md#how-it-works), [judges.md](judges.md#technicality-how-it-was-built)).
- Supabase Postgres and Auth for takes; the browser never writes to the database
  ([tech-stack.md](../specs/tech-stack.md), [judges.md](judges.md#technicality-how-it-was-built)).
- An ESP32 drives a WS2812B strip over the keys ([led-strip](../changes/led-strip.md)).
- Three people and a swarm of coding agents, specs first: a feature counts as done only when its done note with a check
  is on `main`. The counts, the CI times and how they were measured are in
  [judges.md](judges.md#technicality-how-it-was-built) and [the build story](story.md).

### Challenges we ran into

From [the build story](story.md) and [judges.md](judges.md#presentation-limitations-and-trust):
- A real pianist scored 10 to 20% in strict mode and couldn't rejoin, which led to flow mode
  ([chapter 7](story.md#chapter-7-the-impossible-song)).
- A playtest ran on a build 9 hours old ([chapter 4](story.md#chapter-4-the-stale-build)).
- `main` went red eight times on Saturday; each time got an issue, and nothing merged on red
  ([chapter 5](story.md#chapter-5-main-went-red-and-we-said-so)).

### Accomplishments

- `/veritas` puts the judge on trial: test players plant known mistakes in real songs, and the judge finds exactly
  those, with no false alarms ([judges.md](judges.md#presentation-limitations-and-trust),
  [chapter 6](story.md#chapter-6-veritas-the-judge-on-trial)).
- The laptop hears each piano key with millisecond timing
  ([chapter 1](story.md#chapter-1-will-the-piano-even-talk-to-us)).

### What's next

What's known not to be true yet ([judges.md](judges.md#presentation-limitations-and-trust)):
- The judge can't flag rushing ([#545]).
- Flow mode hasn't been played on the piano yet ([flow-mode](../changes/flow-mode.md)).
- The learning side runs on a sample learner and doesn't read your takes yet ([#874]).

## Built with

Next.js, React, TypeScript, Web MIDI, Web Audio, three.js, OpenSheetMusicDisplay, Supabase (Postgres and Auth),
Vitest, Playwright, GitHub Actions, the Anthropic API (the learning side's theory chat), ESP32, WS2812B
([`web/package.json`](../web/package.json), [tech-stack.md](../specs/tech-stack.md),
[led-strip](../changes/led-strip.md)).

## Links

- **Code:** https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days
- **Try it:** open ([#792]). Until then: clone and follow [Run it for judging](../README.md#run-it-for-judging).
- **Video:** open.

## Team

| Name | GitHub | Lane |
|---|---|---|
| Eric Zhang | [@Eric-Zhang-Developer](https://github.com/Eric-Zhang-Developer) | The game ([AGENTS.md](../AGENTS.md)) |
| Sharan (full name: open) | [@iKnow24](https://github.com/iKnow24) | Backend, accounts, progress, LED firmware ([AGENTS.md](../AGENTS.md)) |
| Andres (full name: open) | [@seeko-codes](https://github.com/seeko-codes) | Learning ([chapter 9](story.md#chapter-9-andres-and-the-tutor-becoming-étude)) |

Devpost wants 2 to 5 registered members ([event.md](../specs/context/event.md), sections 3 and 4). Whether everyone is
registered: open.

## Prizes

The prizes and what each needs, from [event.md](../specs/context/event.md), section 5. Which to enter: open.

| Prize | What it needs | In the repo today |
|---|---|---|
| 1st / 2nd / 3rd | The main judging | — |
| Best Open Source Project (MLH) | "a public GitHub repository with a clear open-source license" | Public repo; no license yet ([#958]) |
| Best Use of Gemini (MLH) | Built with the Gemini API or Google AI Studio | No Gemini call in the code |
| Best Use of the Twinly API | Twinly's computer-use, voice-clone calling or iMessage APIs | None |
| Vobile Prize | Judged on the same challenge statement as the main awards | Depends on [#10] |

[#10]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/10
[#545]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/545
[#792]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/792
[#874]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/874
[#958]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/958
