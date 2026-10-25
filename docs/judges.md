# Étude, for the judges

A short read, cut from [the build story](story.md) and ordered by Gator Hack V's criteria: impact, technicality,
design, novelty, presentation ([event.md](../specs/context/event.md), section 2). Every number links to its evidence.

## Impact: what Étude does for a learner

Practicing piano alone, you don't know what you got wrong or what to do next. Étude is a rhythm game played on a real
piano in Chrome, or on laptop keys with no piano at all ([mission.md](../specs/mission.md)).

- **Play a real piece on a real piano.** Notes fall toward the keys and every note is judged against the chart's
  clock. The laptop hears each key with millisecond timing: two keys grazed together arrived 3.1 ms apart, as two
  separate events ([chapter 1](story.md#chapter-1-will-the-piano-even-talk-to-us)).
- **Don't get left behind.** A real pianist scored 10 to 20% in strict mode and couldn't rejoin. Flow mode waits at
  each note, follows your tempo (0.5 to 1.3 times the chart's) and scores what a listener hears: wrong notes, skipped
  notes and stops ([chapter 7](story.md#chapter-7-the-impossible-song), [flow-mode](../changes/flow-mode.md)).
- **Be told what to fix.** The results screen grades how you played, not only which notes you hit: early or late
  ([timing-feedback](../changes/timing-feedback.md)), loudness against the score ([dynamics](../changes/dynamics.md)),
  evenness of runs ([evenness](../changes/evenness.md)), and the weakest bars, with a link to practice them slower
  ([weak-bars](../changes/weak-bars.md)).
- **See progress.** A finished take is saved and re-judged on the server, and `/progress` shows it over time
  ([chapter 8](story.md#chapter-8-sharans-lane-saving-takes-lighting-keys)). Two limits are open; see below.
- **Lights on the keys.** An LED strip sits over the keys. Keys played on the DGX-660 light it, though it isn't
  calibrated yet, so on-key placement is unchecked ([firmware results](../firmware/RESULTS.md), [#639]). The game
  sends it the next key and every hit; that link is checked against a simulated board (42 of 42 hints) and hasn't run
  with the real strip ([led-game](../changes/led-game.md)).

## Technicality: how it was built

Eric, Sharan and Andres built it in one weekend, with a swarm of coding agents. The agents are the evidence, not the product.

- **"Done" means a file on `main` with a check in it.** A feature counts only when its done note is merged, saying how
  to check it or that it's not verified. 108 features had one by Saturday midnight, and 379 PRs merged that day
  ([chapter 2](story.md#chapter-2-the-swarm)).
- **CI on GitHub's machines.** Every browser check (56) runs on `main` in about 17 minutes, and an ordinary PR in about
  2 ([chapter 3](story.md#chapter-3-the-machine-fights-back)).
- **A backend that guards itself.** The browser never writes to the database. When the backend went live, all 10 songs
  committed then saved and read back against it, and 14 of 14 abuse checks were blocked
  ([chapter 8](story.md#chapter-8-sharans-lane-saving-takes-lighting-keys), [#660]). The library has 40 songs now; that
  check loops over all of them and hasn't been re-run since.

## Design

The look is Duo: two hands as the brand, sharp corners, sheet music on paper ([#636]). The name Étude came from the team,
as the arcade became a tutor ([chapter 9](story.md#chapter-9-andres-and-the-tutor-becoming-étude)). The product
philosophy's first principle is "Resolve feeling lost." ([PRODUCT_PHILOSOPHY.md](../PRODUCT_PHILOSOPHY.md)).

## Novelty

The challenge asks for a technology first made public in the past 12 months, central to the project. Which one is
still open ([#10]), so this page claims none.

## Presentation: limitations and trust

**Veritas: the judge on trial.** `/veritas` runs test players that plant known mistakes in real songs, and the game's
own judge has to find exactly those. On Für Elise: **2 planted, 2 found, 0 false alarms**. Every player on all 40
committed songs finds exactly what it planted: [players.test.ts](../web/src/veritas/players.test.ts) reads every
committed chart, and on `main` at `b878080d` it passes 247 tests, with rushing as its one expected fail
([chapter 6](story.md#chapter-6-veritas-the-judge-on-trial), [#545]).

What we know is not yet true:

- **The judge can't flag rushing.** `/veritas` shows that gap instead of hiding it ([#545]).
- **Flow mode hasn't been played on the piano yet.** That check is Eric's ([flow-mode](../changes/flow-mode.md)).
- **Not every take saves right yet.** A Flow take saves as all MISS ([#869]), and the live site has no Supabase keys
  yet, so saving answers 503 there ([#792]).
- **The lights haven't played a song with the game.** The firmware lights the strip on the piano, and the game's
  messages are checked against a simulated board, but the two haven't run together ([led-game](../changes/led-game.md)).
- **We got things wrong and wrote them down.** One playtest ran on a build 9 hours old; its "live check" covered 7 of
  82 finished features ([chapter 4](story.md#chapter-4-the-stale-build)). `main` went red eight times on Saturday; each
  time got an issue, and nothing merges on a red `main` ([chapter 5](story.md#chapter-5-main-went-red-and-we-said-so)).

## How to check it

- The judge on trial: `/veritas`, from [#542]; its tests in
  [players.test.ts](../web/src/veritas/players.test.ts).
- The piano link: [the spike's results](../spikes/piano-midi/RESULTS.md) and its raw logs.
- Flow mode: `/play?mode=flow`, from [#625].
- Saving takes: [#660] lists what's live and how it was checked.
- Every merged feature: its done note in [`changes/`](../changes/).
- The whole build, with a timeline: [docs/story.md](story.md).

[#10]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/10
[#542]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/542
[#545]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/545
[#625]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/625
[#636]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/636
[#639]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/639
[#660]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/660
[#792]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/792
[#869]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/869
